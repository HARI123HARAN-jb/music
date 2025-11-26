const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressBar = document.getElementById('progressBar');
const volumeBar = document.getElementById('volumeBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const songListEl = document.getElementById('songList');
const searchInput = document.getElementById('searchInput');
const currentTitle = document.getElementById('currentTitle');
const currentArtist = document.getElementById('currentArtist');

let songs = [];
let currentSongIndex = -1;
let isPlaying = false;

// Fetch songs from API
async function fetchSongs() {
    try {
        const response = await fetch('/api/songs');
        if (!response.ok) throw new Error('Failed to fetch songs');
        songs = await response.json();
        renderSongs(songs);
    } catch (error) {
        console.error(error);
        songListEl.innerHTML = '<li class="error">Error loading songs. Check API Key and Folder ID.</li>';
    }
}

// Render songs to the list
function renderSongs(songsToRender) {
    songListEl.innerHTML = '';
    if (songsToRender.length === 0) {
        songListEl.innerHTML = '<li>No songs found</li>';
        return;
    }

    songsToRender.forEach((song, index) => {
        const li = document.createElement('li');
        li.className = 'song-item';
        if (songs.indexOf(song) === currentSongIndex) {
            li.classList.add('active');
        }

        li.innerHTML = `
            <div class="icon"><i class="fa-solid fa-music"></i></div>
            <div class="info">
                <span class="title">${song.name}</span>
                <span class="artist">Google Drive</span>
            </div>
        `;

        li.addEventListener('click', () => {
            // Find the original index in the main 'songs' array
            const originalIndex = songs.indexOf(song);
            playSong(originalIndex);
        });

        songListEl.appendChild(li);
    });
}

// Play a specific song
function playSong(index) {
    if (index < 0 || index >= songs.length) return;

    currentSongIndex = index;
    const song = songs[currentSongIndex];

    // Update UI
    currentTitle.textContent = song.name;
    currentArtist.textContent = "Google Drive Audio";

    // Highlight active song
    const items = document.querySelectorAll('.song-item');
    items.forEach(item => item.classList.remove('active'));
    // Note: This simple highlighting assumes the list hasn't been re-rendered/filtered differently.
    // For a robust app, we'd re-render or find by ID.
    // Re-rendering to ensure correctness with search filters:
    renderSongs(songs); // Reset filter to show all or keep current filter? 
    // Let's keep it simple: if searching, we might lose the active class if we don't handle it carefully.
    // For now, we just play.

    // Set audio source
    audioPlayer.src = `/api/stream?id=${song.id}`;
    audioPlayer.play();
    isPlaying = true;
    updatePlayButton();
}

function togglePlay() {
    if (currentSongIndex === -1 && songs.length > 0) {
        playSong(0);
        return;
    }

    if (audioPlayer.paused) {
        audioPlayer.play();
        isPlaying = true;
    } else {
        audioPlayer.pause();
        isPlaying = false;
    }
    updatePlayButton();
}

function updatePlayButton() {
    playBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
}

function prevSong() {
    if (currentSongIndex > 0) {
        playSong(currentSongIndex - 1);
    }
}

function nextSong() {
    if (currentSongIndex < songs.length - 1) {
        playSong(currentSongIndex + 1);
    }
}

// Event Listeners
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', nextSong);

audioPlayer.addEventListener('timeupdate', () => {
    const { currentTime, duration } = audioPlayer;
    if (duration) {
        const progressPercent = (currentTime / duration) * 100;
        progressBar.value = progressPercent;

        // Format time
        const formatTime = (time) => {
            const min = Math.floor(time / 60);
            const sec = Math.floor(time % 60);
            return `${min}:${sec < 10 ? '0' + sec : sec}`;
        };

        currentTimeEl.textContent = formatTime(currentTime);
        durationEl.textContent = formatTime(duration);
    }
});

audioPlayer.addEventListener('ended', nextSong);

progressBar.addEventListener('input', () => {
    const duration = audioPlayer.duration;
    audioPlayer.currentTime = (progressBar.value / 100) * duration;
});

volumeBar.addEventListener('input', (e) => {
    audioPlayer.volume = e.target.value;
});

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = songs.filter(song => song.name.toLowerCase().includes(term));
    renderSongs(filtered);
});

// Initialize
fetchSongs();
