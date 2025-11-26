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
	ID   string `json:"id"`
	Name string `json:"name"`
	Mime string `json:"mimeType"`
}

// ListSongs retrieves MP3 files from the specified folder
func (d *DriveService) ListSongs(folderID string) ([]Song, error) {
	var songs []Song
	query := fmt.Sprintf("'%s' in parents and mimeType = 'audio/mpeg' and trashed = false", folderID)

	// We need to include 'webContentLink' or ensure we can stream it.
	// For API key access, we rely on the files being publicly accessible or accessible to the key context.
	// Note: API Key access usually requires files to be public or shared with the project.
	// If the user wants private access, we'd need Service Account or OAuth.
	// Assuming API Key is sufficient as per plan, but warning: API Keys are restricted.
	// Actually, for personal Drive access, OAuth/Service Account is better.
	// But let's stick to the plan: API Key. If that fails, we might need to pivot to OAuth (token).

	call := d.srv.Files.List().Q(query).Fields("files(id, name, mimeType)")

	fileList, err := call.Do()
	if err != nil {
		return nil, err
	}

	for _, f := range fileList.Files {
		songs = append(songs, Song{
			ID:   f.Id,
			Name: f.Name,
			Mime: f.MimeType,
		})
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
