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
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
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

		rangeHeader := r.Header.Get("Range")
		resp, err := driveService.DownloadFile(id, rangeHeader)
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

	// Admin Credentials and Session Constants
	const AdminEmail = "Jayaj1843@gmail.com"
	const AdminPassword = "HariHaranG@123"
	const SessionCookieName = "vibe_admin_token"
	const SessionCookieValue = "authenticated_vibe_admin_session_token_2026"

	isAdminAuthenticated := func(r *http.Request) bool {
		cookie, err := r.Cookie(SessionCookieName)
		return err == nil && cookie.Value == SessionCookieValue
	}

	// Admin Auth Routes
	http.HandleFunc("/api/admin/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}

		err := json.NewDecoder(r.Body).Decode(&req)
		if err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Email != AdminEmail || req.Password != AdminPassword {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     SessionCookieName,
			Value:    SessionCookieValue,
			Path:     "/",
			HttpOnly: true,
			MaxAge:   86400, // 24 hours
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	})

	http.HandleFunc("/api/admin/logout", func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     SessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			MaxAge:   -1,
		})
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	})

	getOAuthConfig := func(r *http.Request) *oauth2.Config {
		clientID := os.Getenv("GOOGLE_CLIENT_ID")
		clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
		if clientID == "" || clientSecret == "" {
			return nil
		}

		scheme := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		redirectURL := fmt.Sprintf("%s://%s/api/admin/oauth/callback", scheme, r.Host)

		return &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{"https://www.googleapis.com/auth/drive"},
			Endpoint:     google.Endpoint,
		}
	}

	http.HandleFunc("/api/admin/oauth/login", func(w http.ResponseWriter, r *http.Request) {
		if !isAdminAuthenticated(r) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		config := getOAuthConfig(r)
		if config == nil {
			http.Error(w, "OAuth Client ID or Client Secret not configured on server", http.StatusInternalServerError)
			return
		}

		// Generate auth URL with offline access to get a refresh token
		url := config.AuthCodeURL("state-token", oauth2.AccessTypeOffline, oauth2.ApprovalForce)
		http.Redirect(w, r, url, http.StatusTemporaryRedirect)
	})

	http.HandleFunc("/api/admin/oauth/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Missing authorization code", http.StatusBadRequest)
			return
		}

		config := getOAuthConfig(r)
		if config == nil {
			http.Error(w, "OAuth configuration missing", http.StatusInternalServerError)
			return
		}

		tok, err := config.Exchange(r.Context(), code)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to exchange token: %v", err), http.StatusInternalServerError)
			return
		}

		// Write token.json in root
		f, err := os.OpenFile("token.json", os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to cache token: %v", err), http.StatusInternalServerError)
			return
		}
		defer f.Close()
		json.NewEncoder(f).Encode(tok)

		// Redirect back to main admin panel with a success hash
		http.Redirect(w, r, "/#admin-authorized", http.StatusTemporaryRedirect)
	})

	http.HandleFunc("/api/admin/status", func(w http.ResponseWriter, r *http.Request) {
		authenticated := isAdminAuthenticated(r)
		writable := driveService.writable
		oauthConfigured := os.Getenv("GOOGLE_CLIENT_ID") != "" && os.Getenv("GOOGLE_CLIENT_SECRET") != ""

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated":   authenticated,
			"writable":        writable,
			"oauthConfigured": oauthConfigured,
		})
	})

	// Admin Upload Route
	http.HandleFunc("/api/admin/upload", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if !isAdminAuthenticated(r) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !driveService.writable {
			http.Error(w, "Drive service is read-only (missing service_account.json)", http.StatusForbidden)
			return
		}

		// Parse multipart form
		err := r.ParseMultipartForm(100 << 20) // 100MB limit
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
			return
		}

		artist := r.FormValue("artist")

		targetFolderID := folderID
		if artist != "" && artist != "Unknown Artist" {
			subfolderID, err := driveService.GetOrCreateSubfolder(folderID, artist)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to create/find artist folder: %v", err), http.StatusInternalServerError)
				return
			}
			targetFolderID = subfolderID
		}

		formFiles := r.MultipartForm.File["songs"]
		if len(formFiles) == 0 {
			http.Error(w, "No files uploaded", http.StatusBadRequest)
			return
		}

		var uploadedSongs []Song
		for _, fileHeader := range formFiles {
			file, err := fileHeader.Open()
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to open file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
				return
			}
			defer file.Close()

			song, err := driveService.UploadSong(targetFolderID, fileHeader.Filename, file)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to upload file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
				return
			}
			song.Artist = artist
			uploadedSongs = append(uploadedSongs, song)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"songs":  uploadedSongs,
		})
	})

	// Admin Delete Route
	http.HandleFunc("/api/admin/delete", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if !isAdminAuthenticated(r) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !driveService.writable {
			http.Error(w, "Drive service is read-only (missing service_account.json)", http.StatusForbidden)
			return
		}

		var req struct {
			ID string `json:"id"`
		}

		err := json.NewDecoder(r.Body).Decode(&req)
		if err != nil || req.ID == "" {
			http.Error(w, "Invalid request body or missing ID", http.StatusBadRequest)
			return
		}

		err = driveService.DeleteSong(req.ID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to delete song: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
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
