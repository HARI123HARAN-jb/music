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

// Navigation Elements
const navHome = document.getElementById('navHome');
const navFavorites = document.getElementById('navFavorites');
const navLibrary = document.getElementById('navLibrary');

let songs = [];
let currentSongIndex = -1;
let isPlaying = false;
let currentView = 'home'; // 'home', 'favorites', 'library'

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
    if (!songsToRender || songsToRender.length === 0) {
        songListEl.innerHTML = '<li>No songs found</li>';
        return;
    }

    // Group songs by Artist
    const groupedSongs = {};
    songsToRender.forEach(song => {
        const artist = song.artist || 'Unknown Artist';
        if (!groupedSongs[artist]) {
            groupedSongs[artist] = [];
        }
        groupedSongs[artist].push(song);
    });

    // Iterate through groups and render
    for (const [artist, artistSongs] of Object.entries(groupedSongs)) {
        // Create Artist Header
        const header = document.createElement('li');
        header.className = 'artist-header';
        header.textContent = artist;
        songListEl.appendChild(header);

        artistSongs.forEach(song => {
            const li = document.createElement('li');
            li.className = 'song-item';
            if (songs.indexOf(song) === currentSongIndex) {
                li.classList.add('active');
            }

            const likedClass = isLiked(song.id) ? 'fa-solid' : 'fa-regular';

            li.innerHTML = `
                <div class="icon"><i class="fa-solid fa-music"></i></div>
                <div class="info">
                    <span class="title">${song.name}</span>
                    <span class="artist">${song.artist}</span>
                </div>
                <div class="actions">
                    <i class="${likedClass} fa-heart like-btn" data-id="${song.id}"></i>
                </div>
            `;

            // Click on song to play
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('like-btn')) return; // Ignore clicks on heart
                const originalIndex = songs.indexOf(song);
                playSong(originalIndex);
            });

            // Click on heart to like
            const likeBtn = li.querySelector('.like-btn');
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLike(song.id);
                // Re-render if in Favorites view to remove unliked song immediately
                if (currentView === 'favorites') {
                    filterAndRender();
                } else {
                    // Just update icon
                    const isNowLiked = isLiked(song.id);
                    likeBtn.classList.toggle('fa-solid', isNowLiked);
                    likeBtn.classList.toggle('fa-regular', !isNowLiked);
                }
            });

            songListEl.appendChild(li);
        });
    }
}

// Favorites Logic
function getFavorites() {
    const stored = localStorage.getItem('favorites');
    return stored ? JSON.parse(stored) : [];
}

function isLiked(id) {
    const favorites = getFavorites();
    return favorites.includes(id);
}

function toggleLike(id) {
    let favorites = getFavorites();
    if (favorites.includes(id)) {
        favorites = favorites.filter(favId => favId !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Navigation Logic
function setView(view) {
    currentView = view;
    // Update Active Nav State
    document.querySelectorAll('.sidebar nav li').forEach(el => el.classList.remove('active'));

    if (view === 'home') navHome.classList.add('active');
    else if (view === 'favorites') navFavorites.classList.add('active');
    else if (view === 'library') navLibrary.classList.add('active');

    filterAndRender();
}

function filterAndRender() {
    let filteredSongs = songs;

    if (currentView === 'favorites') {
        const favorites = getFavorites();
        filteredSongs = songs.filter(song => favorites.includes(song.id));
    }

    // Apply search filter if exists
    const term = searchInput.value.toLowerCase();
    if (term) {
        filteredSongs = filteredSongs.filter(song =>
            song.name.toLowerCase().includes(term) ||
            song.artist.toLowerCase().includes(term)
        );
    }

    renderSongs(filteredSongs);
}

// Play a specific song
function playSong(index) {
    if (index < 0 || index >= songs.length) return;

    currentSongIndex = index;
    const song = songs[currentSongIndex];

    // Update UI
    currentTitle.textContent = song.name;
    currentArtist.textContent = song.artist;

    // Highlight active song (simple re-render to ensure correctness)
    filterAndRender();

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

        // Update background gradient to show progress
        progressBar.style.background = `linear-gradient(to right, var(--text-primary) ${progressPercent}%, #535353 ${progressPercent}%)`;

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

searchInput.addEventListener('input', () => {
    filterAndRender();
});

// Navigation Listeners
navHome.addEventListener('click', () => setView('home'));
navFavorites.addEventListener('click', () => setView('favorites'));
navLibrary.addEventListener('click', () => setView('library')); // Library behaves same as Home for now

// Initialize
fetchSongs();
