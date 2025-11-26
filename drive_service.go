package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// DriveService handles interactions with Google Drive
type DriveService struct {
	srv *drive.Service
}

// NewDriveService creates a new DriveService using the API key from environment
func NewDriveService() (*DriveService, error) {
	apiKey := os.Getenv("GOOGLE_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GOOGLE_API_KEY environment variable is not set")
	}

	ctx := context.Background()
	srv, err := drive.NewService(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("unable to retrieve Drive client: %v", err)
	}

	return &DriveService{srv: srv}, nil
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

// GetFileStream retrieves the file content from Drive
func (d *DriveService) GetFileStream(fileID string) (*http.Response, error) {
	// For downloading/streaming, we use the Files.Get method with Alt("media")
	resp, err := d.srv.Files.Get(fileID).Download()
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// StreamFile copies the file content to the writer
func (d *DriveService) StreamFile(w io.Writer, fileID string) error {
	resp, err := d.srv.Files.Get(fileID).Download()
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	_, err = io.Copy(w, resp.Body)
	return err
}
