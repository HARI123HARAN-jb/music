package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// DriveService handles interactions with Google Drive
type DriveService struct {
	srv      *drive.Service
	writable bool
}

// NewDriveService creates a new DriveService.
// It will try to load OAuth 2.0 credentials from token.json first.
// If missing, it falls back to service_account.json.
// If both are missing, it falls back to the GOOGLE_API_KEY environment variable in read-only mode.
func NewDriveService() (*DriveService, error) {
	var srv *drive.Service
	var err error
	writable := false
	ctx := context.Background()

	// 1. Try OAuth 2.0 Client credentials first
	if _, statErr := os.Stat("token.json"); statErr == nil {
		clientID := os.Getenv("GOOGLE_CLIENT_ID")
		clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
		if clientID != "" && clientSecret != "" {
			fmt.Println("Initializing Drive Service with OAuth 2.0 User Credentials (token.json)...")
			config := &oauth2.Config{
				ClientID:     clientID,
				ClientSecret: clientSecret,
				Scopes:       []string{drive.DriveScope},
				Endpoint:     google.Endpoint,
			}
			f, fileErr := os.Open("token.json")
			if fileErr == nil {
				defer f.Close()
				tok := &oauth2.Token{}
				jsonErr := json.NewDecoder(f).Decode(tok)
				if jsonErr == nil {
					client := config.Client(ctx, tok)
					srv, err = drive.NewService(ctx, option.WithHTTPClient(client))
					if err == nil {
						writable = true
					} else {
						fmt.Printf("Failed to create Drive client with OAuth2 token: %v\n", err)
					}
				}
			}
		}
	}

	// 2. Fallback to Service Account
	if !writable {
		credsPath := ""
		checkFiles := []string{"service_account.json", "service_account.json.json"}

		if pathEnv := os.Getenv("SERVICE_ACCOUNT_PATH"); pathEnv != "" {
			if _, statErr := os.Stat(pathEnv); statErr == nil {
				credsPath = pathEnv
			}
		}
		if credsPath == "" {
			for _, f := range checkFiles {
				if _, statErr := os.Stat(f); statErr == nil {
					credsPath = f
					break
				}
			}
		}
		if credsPath == "" {
			if exePath, exeErr := os.Executable(); exeErr == nil {
				for _, f := range checkFiles {
					exeCredsPath := filepath.Join(filepath.Dir(exePath), f)
					if _, statErr := os.Stat(exeCredsPath); statErr == nil {
						credsPath = exeCredsPath
						break
					}
				}
			}
		}
		if credsPath == "" {
			for _, f := range checkFiles {
				parentCredsPath := filepath.Join("..", f)
				if _, statErr := os.Stat(parentCredsPath); statErr == nil {
					credsPath = parentCredsPath
					break
				}
			}
		}

		if credsPath != "" {
			fmt.Printf("Initializing Drive Service with Service Account from: %s\n", credsPath)
			srv, err = drive.NewService(ctx, option.WithCredentialsFile(credsPath), option.WithScopes(drive.DriveScope))
			if err == nil {
				writable = true
			} else {
				fmt.Printf("Failed to load credentials file %s: %v. Falling back to API Key...\n", credsPath, err)
			}
		}
	}

	// 3. Fallback to API Key
	if !writable {
		apiKey := os.Getenv("GOOGLE_API_KEY")
		if apiKey == "" {
			return nil, fmt.Errorf("neither a valid token.json, service_account.json, nor GOOGLE_API_KEY environment variable is configured")
		}
		fmt.Println("Initializing Drive Service with API Key (Read-Only)...")
		srv, err = drive.NewService(ctx, option.WithAPIKey(apiKey))
	}

	if err != nil {
		return nil, fmt.Errorf("unable to retrieve Drive client: %v", err)
	}

	return &DriveService{srv: srv, writable: writable}, nil
}

// Song represents a music file in Drive
type Song struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Mime   string `json:"mimeType"`
	Artist string `json:"artist"`
}

// ListSongs retrieves MP3 files from the specified folder and its subfolders
func (d *DriveService) ListSongs(folderID string, artistName string) ([]Song, error) {
	var songs []Song

	// Query for both MP3 files and folders
	query := fmt.Sprintf("'%s' in parents and (mimeType = 'audio/mpeg' or mimeType = 'application/vnd.google-apps.folder') and trashed = false", folderID)

	call := d.srv.Files.List().Q(query).Fields("nextPageToken, files(id, name, mimeType)")

	// Iterate through all pages
	err := call.Pages(context.Background(), func(page *drive.FileList) error {
		for _, f := range page.Files {
			if f.MimeType == "application/vnd.google-apps.folder" {
				// Recursively scan subfolder, using the folder name as the artist name
				subSongs, err := d.ListSongs(f.Id, f.Name)
				if err == nil {
					songs = append(songs, subSongs...)
				}
			} else if f.MimeType == "audio/mpeg" {
				songs = append(songs, Song{
					ID:     f.Id,
					Name:   f.Name,
					Mime:   f.MimeType,
					Artist: artistName,
				})
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return songs, nil
}

// GetOrCreateSubfolder searches for a subfolder by name under parentID.
// If it doesn't exist, it creates a new one.
func (d *DriveService) GetOrCreateSubfolder(parentID string, folderName string) (string, error) {
	query := fmt.Sprintf("'%s' in parents and name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", parentID, folderName)
	list, err := d.srv.Files.List().Q(query).Fields("files(id)").Do()
	if err != nil {
		return "", err
	}
	if len(list.Files) > 0 {
		return list.Files[0].Id, nil
	}

	// Create a new folder
	f := &drive.File{
		Name:     folderName,
		MimeType: "application/vnd.google-apps.folder",
		Parents:  []string{parentID},
	}
	res, err := d.srv.Files.Create(f).Fields("id").Do()
	if err != nil {
		return "", err
	}
	return res.Id, nil
}

// UploadSong uploads a song file directly into the specified parent folder
func (d *DriveService) UploadSong(parentID string, filename string, fileReader io.Reader) (Song, error) {
	f := &drive.File{
		Name:     filename,
		MimeType: "audio/mpeg",
		Parents:  []string{parentID},
	}
	res, err := d.srv.Files.Create(f).Media(fileReader).Fields("id, name, mimeType").Do()
	if err != nil {
		return Song{}, err
	}
	return Song{
		ID:   res.Id,
		Name: res.Name,
		Mime: res.MimeType,
	}, nil
}

// DeleteSong deletes a file from Google Drive by its file ID
func (d *DriveService) DeleteSong(fileID string) error {
	return d.srv.Files.Delete(fileID).Do()
}

// DownloadFile retrieves file content and supports Range headers for streaming seeking
func (d *DriveService) DownloadFile(fileID string, rangeHeader string) (*http.Response, error) {
	call := d.srv.Files.Get(fileID)
	if rangeHeader != "" {
		call.Header().Set("Range", rangeHeader)
	}
	return call.Download()
}

// GetFileStream retrieves the file content from Drive (non-seeking fallback)
func (d *DriveService) GetFileStream(fileID string) (*http.Response, error) {
	return d.srv.Files.Get(fileID).Download()
}

// StreamFile copies the file content directly to the writer (legacy fallback)
func (d *DriveService) StreamFile(w io.Writer, fileID string) error {
	resp, err := d.srv.Files.Get(fileID).Download()
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = io.Copy(w, resp.Body)
	return err
}
