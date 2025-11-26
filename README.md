# Music App Walkthrough

## Prerequisites
- **Google Cloud API Key**: You need an API Key with Google Drive API enabled.
- **Drive Folder ID**: The ID of the Google Drive folder containing your MP3 files.

## Setup & Run

1.  **Set Environment Variables**:
    You need to set the `GOOGLE_API_KEY` and `DRIVE_FOLDER_ID` environment variables.
    
    **PowerShell**:
    ```powershell
    $env:GOOGLE_API_KEY="your_api_key_here"
    $env:DRIVE_FOLDER_ID="your_folder_id_here"
    ```

    **CMD**:
    ```cmd
    set GOOGLE_API_KEY=your_api_key_here
    set DRIVE_FOLDER_ID=your_folder_id_here
    ```

2.  **Run the Application**:
    ```bash
    go run .
    ```
    Or if you built the executable:
    ```bash
    ./music_app.exe
    ```

3.  **Access the App**:
    Open your browser and navigate to: [http://localhost:8080](http://localhost:8080)

## Verification
- **Song List**: You should see a list of MP3 files from your Drive folder.
- **Playback**: Click on a song to play it. The audio should stream directly from Drive.
- **Search**: Type in the search bar to filter songs.
- **Controls**: Play, Pause, Next, Previous, and Volume controls should work smoothly.

## Deployment (Render)

This application is ready to be deployed on Render as a Web Service.

1.  **Create New Web Service**:
    - Go to your [Render Dashboard](https://dashboard.render.com/).
    - Click **New +** -> **Web Service**.
    - Connect your GitHub repository: `https://github.com/HARI123HARAN-jb/music`.

2.  **Configure Service**:
    - **Name**: `music-app` (or any name you like).
    - **Runtime**: `Go`.
    - **Build Command**: `go build -o app .`
    - **Start Command**: `./app`

3.  **Environment Variables**:
    - Scroll down to the **Environment Variables** section.
    - Add the following keys:
        - `GOOGLE_API_KEY`: Your Google Cloud API Key.
            - *Example*: `AIzaSyD-5...` (starts with `AIza`)
        - `DRIVE_FOLDER_ID`: The ID of the Google Drive folder containing your music.
            - *Example*: `1A2B3C4D5E6F7G8H9I0J` (the last part of the folder URL)
            - *URL*: `drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J` -> ID is `1A2B3C4D5E6F7G8H9I0J`

4.  **Deploy**:
    - Click **Create Web Service**.
    - Render will build your app and deploy it. Once finished, you will get a URL (e.g., `https://music-app.onrender.com`) to access your player!
