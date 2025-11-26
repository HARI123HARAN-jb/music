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

		resp, err := driveService.GetFileStream(id)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get file stream: %v", err), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		// Set headers for streaming
		w.Header().Set("Content-Type", "audio/mpeg")

		_, err = io.Copy(w, resp.Body)
		if err != nil {
			log.Printf("Error streaming file: %v", err)
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
