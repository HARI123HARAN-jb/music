package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

//go:embed static/*
var staticFiles embed.FS

func main() {
	// Load .env file if it exists
	_ = godotenv.Load()

	// Load configuration
	folderID := os.Getenv("DRIVE_FOLDER_ID")
	if folderID == "" {
		log.Fatal("DRIVE_FOLDER_ID environment variable is not set")
	}

	// Initialize Drive Service
	driveService, err := NewDriveService()
	if err != nil {
		log.Fatalf("Failed to create Drive service: %v", err)
	}

	// API Endpoints
	http.HandleFunc("/api/songs", func(w http.ResponseWriter, r *http.Request) {
		songs, err := driveService.ListSongs(folderID, "Unknown Artist")
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to list songs: %v", err), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(songs)
	})

	http.HandleFunc("/api/stream", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "Missing id parameter", http.StatusBadRequest)
			return
		}

		apiKey := os.Getenv("GOOGLE_API_KEY")
		url := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s?alt=media&key=%s", id, apiKey)

		req, err := http.NewRequestWithContext(r.Context(), "GET", url, nil)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create stream request: %v", err), http.StatusInternalServerError)
			return
		}

		// Forward the Range header if requested by the client (browser)
		if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
			req.Header.Set("Range", rangeHeader)
		}

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get file stream: %v", err), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		// Copy key headers back to client
		if val := resp.Header.Get("Content-Range"); val != "" {
			w.Header().Set("Content-Range", val)
		}
		if val := resp.Header.Get("Content-Length"); val != "" {
			w.Header().Set("Content-Length", val)
		}
		if val := resp.Header.Get("Content-Type"); val != "" {
			w.Header().Set("Content-Type", val)
		} else {
			w.Header().Set("Content-Type", "audio/mpeg")
		}
		w.Header().Set("Accept-Ranges", "bytes")

		// Write status code (usually 206 for ranges, or 200)
		w.WriteHeader(resp.StatusCode)

		_, err = io.Copy(w, resp.Body)
		if err != nil {
			log.Printf("Error streaming file range: %v", err)
		}
	})

	// Serve Static Files from Embed
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server listening on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
