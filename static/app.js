// DOM Elements
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const loopBtn = document.getElementById('loopBtn');
const muteBtn = document.getElementById('muteBtn');
const progressBar = document.getElementById('progressBar');
const volumeBar = document.getElementById('volumeBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const searchInput = document.getElementById('searchInput');

// Sidebar Nav Elements
const navHome = document.getElementById('navHome');
const navFavorites = document.getElementById('navFavorites');
const navQueue = document.getElementById('navQueue');
const navAdmin = document.getElementById('navAdmin');
const playlistsListEl = document.getElementById('playlistsList');
const addPlaylistBtn = document.getElementById('addPlaylistBtn');

// View Panels
const viewHome = document.getElementById('viewHome');
const viewFavorites = document.getElementById('viewFavorites');
const viewQueue = document.getElementById('viewQueue');
const viewPlaylist = document.getElementById('viewPlaylist');
const viewAdmin = document.getElementById('viewAdmin');

// View Sub-elements
const songsGrid = document.getElementById('songsGrid');
const favoritesList = document.getElementById('favoritesList');
const favoritesCount = document.getElementById('favoritesCount');
const queueList = document.getElementById('queueList');
const queueCount = document.getElementById('queueCount');
const clearQueueBtn = document.getElementById('clearQueueBtn');

// Playlist View Sub-elements
const playlistTitle = document.getElementById('playlistTitle');
const playlistMeta = document.getElementById('playlistMeta');
const playlistSongsList = document.getElementById('playlistSongsList');
const deletePlaylistBtn = document.getElementById('deletePlaylistBtn');

// Now Playing Widget elements
const nowPlayingArt = document.getElementById('nowPlayingArt');
const playerArtCanvas = document.getElementById('playerArtCanvas');
const currentTitle = document.getElementById('currentTitle');
const currentArtist = document.getElementById('currentArtist');
const playerLikeBtn = document.getElementById('playerLikeBtn');

// Modal Elements
const playlistModal = document.getElementById('playlistModal');
const modalPlaylistsList = document.getElementById('modalPlaylistsList');
const closeModalBtn = document.getElementById('closeModalBtn');

// ----------------------------------------------------
// STATE MANAGEMENT & LOCAL STORAGE
// ----------------------------------------------------
let allSongs = [];            // Flat list of all songs fetched from server
let currentSongsContext = []; // Active list of songs (from currently played view)
let playbackQueue = [];       // Queue of songs to play sequentially
let currentQueueIndex = -1;   // Pointer to active index in playbackQueue
let isPlaying = false;
let currentView = 'home';     // 'home', 'favorites', 'queue', 'playlist'
let activePlaylistId = null;  // Active playlist ID (if currentView === 'playlist')
let loopState = 0;            // 0: No loop, 1: Loop context/queue, 2: Loop song
let shuffleState = false;
let originalQueueOrder = [];  // Used to restore order when turning shuffle off
let preMuteVolume = 1.0;
let songPendingPlaylistAdd = null; // Stored song ID when modal is active

let isAdminAuthenticated = false;
let isDriveWritable = false;
let isOauthConfigured = false;

// Local Storage Databases
function getFavorites() {
    const stored = localStorage.getItem('favorites');
    return stored ? JSON.parse(stored) : [];
}

function saveFavorites(favorites) {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function getPlaylists() {
    const stored = localStorage.getItem('playlists');
    return stored ? JSON.parse(stored) : {};
}

function savePlaylists(playlists) {
    localStorage.setItem('playlists', JSON.stringify(playlists));
}

// ----------------------------------------------------
// DYNAMIC GEOMETRIC ALBUM ART ENGINE
// ----------------------------------------------------
const ART_PALETTES = [
    { bg: ['#121026', '#261b4d'], primary: '#1db954', secondary: '#9b51e0' },
    { bg: ['#1c0f18', '#3d1629'], primary: '#ff2a68', secondary: '#ff5e3a' },
    { bg: ['#0f1c1c', '#163d3a'], primary: '#00f2fe', secondary: '#4facfe' },
    { bg: ['#1c1a0f', '#3d3416'], primary: '#f9d423', secondary: '#ff4e50' },
    { bg: ['#170f1c', '#2c163d'], primary: '#b300af', secondary: '#ff007f' },
    { bg: ['#0f101c', '#151c3d'], primary: '#38ef7d', secondary: '#11998e' }
];

function stringHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

function drawAlbumArt(canvas, title, artist) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 300; // Render resolution
    canvas.width = size;
    canvas.height = size;

    const seed = stringHashCode(title + artist);
    const palette = ART_PALETTES[seed % ART_PALETTES.length];

    // Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, palette.bg[0]);
    gradient.addColorStop(1, palette.bg[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Decorative Geometric Shapes
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';

    const shapesCount = 3 + (seed % 4);
    for (let i = 0; i < shapesCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? palette.primary : palette.secondary;
        ctx.strokeStyle = i % 2 === 0 ? palette.secondary : palette.primary;
        ctx.lineWidth = 4 + (seed % 6);

        ctx.save();
        ctx.translate(size / 2, size / 2);
        // Rotate shape based on seed and loop index
        ctx.rotate((seed * (i + 1) * Math.PI) / 180);

        const shapeType = (seed + i) % 4;
        const radius = size * 0.15 + (i * 18);

        if (shapeType === 0) {
            // Draw circle outline
            ctx.beginPath();
            ctx.arc(radius * 0.3, radius * 0.3, radius * 0.5, 0, Math.PI * 2);
            ctx.stroke();
        } else if (shapeType === 1) {
            // Draw filled rounded square
            ctx.fillRect(-radius / 2, -radius / 2, radius, radius);
        } else if (shapeType === 2) {
            // Draw abstract lines
            ctx.beginPath();
            ctx.moveTo(-radius, 0);
            ctx.lineTo(radius, 0);
            ctx.stroke();
        } else {
            // Concentric rings
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Centered Vinyl Inner Ring Look
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Glossy Highlights Overlay
    const gloss = ctx.createLinearGradient(0, 0, 0, size);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gloss.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, size, size);
}

// ----------------------------------------------------
// VIEW ROUTING
// ----------------------------------------------------
function setView(view, playlistId = null) {
    currentView = view;
    activePlaylistId = playlistId;

    // Remove active sidebar tabs styling
    navHome.classList.remove('active');
    navFavorites.classList.remove('active');
    navQueue.classList.remove('active');
    navAdmin.classList.remove('active');
    document.querySelectorAll('.playlist-sidebar-item').forEach(el => el.classList.remove('active'));

    // Hide all view panels
    viewHome.classList.remove('active');
    viewFavorites.classList.remove('active');
    viewQueue.classList.remove('active');
    viewPlaylist.classList.remove('active');
    viewAdmin.classList.remove('active');

    if (view === 'home') {
        navHome.classList.add('active');
        viewHome.classList.add('active');
    } else if (view === 'favorites') {
        navFavorites.classList.add('active');
        viewFavorites.classList.add('active');
    } else if (view === 'queue') {
        navQueue.classList.add('active');
        viewQueue.classList.add('active');
    } else if (view === 'playlist') {
        const playlists = getPlaylists();
        if (playlists[playlistId]) {
            viewPlaylist.classList.add('active');
            const plItem = document.getElementById(`playlist-sidebar-${playlistId}`);
            if (plItem) plItem.classList.add('active');
        } else {
            setView('home');
            return;
        }
    } else if (view === 'admin') {
        navAdmin.classList.add('active');
        viewAdmin.classList.add('active');
        checkAdminStatus();
    }
    filterAndRender();
}

// ----------------------------------------------------
// DATA FETCHING & RENDERING ENGINE
// ----------------------------------------------------
async function fetchSongs() {
    try {
        const response = await fetch('/api/songs');
        if (!response.ok) throw new Error('Failed to load songs');
        allSongs = await response.json();
        
        // Populate Playlists sidebar
        renderPlaylistsSidebar();
        setView('home');
    } catch (error) {
        console.error(error);
        songsGrid.innerHTML = `
            <div class="song-card" style="grid-column: 1 / -1; align-items: center; justify-content: center; padding: 40px; border-color: rgba(235, 87, 87, 0.3);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: #eb5757; margin-bottom: 12px;"></i>
                <h4 style="margin-bottom: 4px;">Failed to Load Library</h4>
                <p style="color: var(--text-secondary); font-size: 13px; text-align: center;">Ensure GOOGLE_API_KEY and DRIVE_FOLDER_ID are set correctly in your .env file.</p>
            </div>
        `;
    }
}

function filterAndRender() {
    const term = searchInput.value.trim().toLowerCase();
    
    if (currentView === 'home') {
        let filtered = allSongs;
        if (term) {
            filtered = allSongs.filter(s => 
                s.name.toLowerCase().includes(term) || 
                (s.artist && s.artist.toLowerCase().includes(term))
            );
        }
        renderHomeGrid(filtered);
    } else if (currentView === 'favorites') {
        const favIds = getFavorites();
        let filtered = allSongs.filter(s => favIds.includes(s.id));
        if (term) {
            filtered = filtered.filter(s => 
                s.name.toLowerCase().includes(term) || 
                (s.artist && s.artist.toLowerCase().includes(term))
            );
        }
        renderSongsList(favoritesList, filtered);
        favoritesCount.textContent = `${filtered.length} songs`;
    } else if (currentView === 'queue') {
        // Queue is local, rendering currently playing next
        let upcoming = playbackQueue.slice(currentQueueIndex + 1);
        if (term) {
            upcoming = upcoming.filter(s => 
                s.name.toLowerCase().includes(term) || 
                (s.artist && s.artist.toLowerCase().includes(term))
            );
        }
        renderSongsList(queueList, upcoming, true);
        queueCount.textContent = `${upcoming.length} songs in queue`;
    } else if (currentView === 'playlist') {
        const playlists = getPlaylists();
        const playlist = playlists[activePlaylistId];
        let filtered = allSongs.filter(s => playlist.songIds.includes(s.id));
        if (term) {
            filtered = filtered.filter(s => 
                s.name.toLowerCase().includes(term) || 
                (s.artist && s.artist.toLowerCase().includes(term))
            );
        }
        playlistTitle.textContent = playlist.name;
        playlistMeta.textContent = `Created by You • ${filtered.length} songs`;
        renderSongsList(playlistSongsList, filtered);
    }
}

// Render discovers grid cards
function renderHomeGrid(songs) {
    songsGrid.innerHTML = '';
    if (songs.length === 0) {
        songsGrid.innerHTML = `<p style="grid-column:1/-1; color: var(--text-secondary); text-align:center;">No matching songs found.</p>`;
        return;
    }

    songs.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';
        
        // Find if this song is playing right now
        const isCurrentActive = isSongCurrentlyActive(song.id);
        if (isCurrentActive) {
            card.classList.add('active-card');
            card.style.borderColor = 'var(--accent-color)';
        }

        card.innerHTML = `
            <div class="song-card-art">
                <canvas id="canvas-grid-${song.id}"></canvas>
                <button class="card-play-btn" data-id="${song.id}"><i class="fa-solid fa-play"></i></button>
            </div>
            <div class="song-card-info">
                <h4>${song.name}</h4>
                <p>${song.artist || 'Unknown Artist'}</p>
            </div>
        `;

        // Render dynamic canvas album art
        const canvas = card.querySelector('canvas');
        setTimeout(() => drawAlbumArt(canvas, song.name, song.artist || 'Unknown Artist'), 0);

        // Click play button to play
        card.querySelector('.card-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            playSongFromContext(song.id, songs);
        });

        // Click card to open/play
        card.addEventListener('click', () => {
            playSongFromContext(song.id, songs);
        });

        songsGrid.appendChild(card);
    });
}

// Render dynamic song list rows
function renderSongsList(container, songs, isQueueView = false) {
    container.innerHTML = '';
    if (songs.length === 0) {
        container.innerHTML = `<li style="padding: 20px; color: var(--text-secondary); text-align:center; font-size:14px;">No tracks in this view.</li>`;
        return;
    }

    songs.forEach((song, idx) => {
        const li = document.createElement('li');
        li.className = 'song-row';
        
        const isCurrentActive = isSongCurrentlyActive(song.id);
        if (isCurrentActive && !isQueueView) {
            li.classList.add('active');
        }

        const favorites = getFavorites();
        const isLiked = favorites.includes(song.id);
        const likedClass = isLiked ? 'liked' : '';
        const likedIcon = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';

        li.innerHTML = `
            <div class="row-index">
                <span class="index-num">${idx + 1}</span>
                <div class="equalizer-container">
                    <div class="equalizer-bar"></div>
                    <div class="equalizer-bar"></div>
                    <div class="equalizer-bar"></div>
                </div>
            </div>
            <div class="row-meta-info">
                <div class="row-art-small">
                    <canvas id="canvas-row-${isQueueView ? 'q-' : ''}${song.id}"></canvas>
                </div>
                <div class="row-title-block">
                    <span class="row-title">${song.name}</span>
                    <span class="row-subtitle">${song.artist || 'Unknown Artist'}</span>
                </div>
            </div>
            <div class="row-album">${song.artist || 'Unknown Folder'}</div>
            <div class="row-controls">
                <button class="row-like-btn ${likedClass}" data-id="${song.id}"><i class="${likedIcon}"></i></button>
                <button class="row-menu-btn" data-id="${song.id}"><i class="fa-solid fa-ellipsis"></i></button>
            </div>
        `;

        // Render Canvas album art
        const canvas = li.querySelector('canvas');
        setTimeout(() => drawAlbumArt(canvas, song.name, song.artist || 'Unknown Artist'), 0);

        // Click row to play
        li.addEventListener('click', (e) => {
            // Ignore button actions
            if (e.target.closest('.row-like-btn') || e.target.closest('.row-menu-btn')) return;
            if (isQueueView) {
                // Play from upcoming index
                const qIdx = playbackQueue.indexOf(song);
                if (qIdx !== -1) playQueueIndex(qIdx);
            } else {
                playSongFromContext(song.id, songs);
            }
        });

        // Click like
        li.querySelector('.row-like-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(song.id);
        });

        // Click menu button (Add to playlist)
        li.querySelector('.row-menu-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openPlaylistModal(song.id);
        });

        container.appendChild(li);
    });
}

function isSongCurrentlyActive(songId) {
    if (currentQueueIndex === -1 || playbackQueue.length === 0) return false;
    return playbackQueue[currentQueueIndex].id === songId;
}

// ----------------------------------------------------
// PLAYLISTS OPERATIONS
// ----------------------------------------------------
function renderPlaylistsSidebar() {
    playlistsListEl.innerHTML = '';
    const playlists = getPlaylists();
    
    Object.entries(playlists).forEach(([id, pl]) => {
        const li = document.createElement('li');
        li.className = 'playlist-sidebar-item';
        li.id = `playlist-sidebar-${id}`;
        li.innerHTML = `<i class="fa-solid fa-music-note"></i> ${pl.name}`;
        
        li.addEventListener('click', () => setView('playlist', id));
        playlistsListEl.appendChild(li);
    });
}

addPlaylistBtn.addEventListener('click', () => {
    const name = prompt('Enter new playlist name:');
    if (!name || name.trim() === '') return;
    
    const playlists = getPlaylists();
    const id = 'pl_' + Date.now();
    playlists[id] = {
        name: name.trim(),
        songIds: []
    };
    savePlaylists(playlists);
    renderPlaylistsSidebar();
    setView('playlist', id);
});

deletePlaylistBtn.addEventListener('click', () => {
    if (!activePlaylistId) return;
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    const playlists = getPlaylists();
    delete playlists[activePlaylistId];
    savePlaylists(playlists);
    renderPlaylistsSidebar();
    setView('home');
});

// Modal Logic
function openPlaylistModal(songId) {
    songPendingPlaylistAdd = songId;
    modalPlaylistsList.innerHTML = '';
    const playlists = getPlaylists();
    
    const entries = Object.entries(playlists);
    if (entries.length === 0) {
        modalPlaylistsList.innerHTML = `<li style="padding: 10px 0; color: var(--text-secondary); text-align:center; font-size:13px;">No playlists created yet. Create one in the sidebar first!</li>`;
    } else {
        entries.forEach(([id, pl]) => {
            const li = document.createElement('li');
            li.className = 'modal-playlist-option';
            li.textContent = pl.name;
            li.addEventListener('click', () => {
                addSongToPlaylist(songId, id);
                closePlaylistModal();
            });
            modalPlaylistsList.appendChild(li);
        });
    }
    
    playlistModal.style.display = 'flex';
}

function closePlaylistModal() {
    playlistModal.style.display = 'none';
    songPendingPlaylistAdd = null;
}

function addSongToPlaylist(songId, playlistId) {
    const playlists = getPlaylists();
    const pl = playlists[playlistId];
    if (!pl.songIds.includes(songId)) {
        pl.songIds.push(songId);
        savePlaylists(playlists);
        if (currentView === 'playlist' && activePlaylistId === playlistId) {
            filterAndRender();
        }
    }
}

closeModalBtn.addEventListener('click', closePlaylistModal);

// ----------------------------------------------------
// FAVORITES / LIKED SONGS
// ----------------------------------------------------
function toggleLike(songId) {
    let favorites = getFavorites();
    if (favorites.includes(songId)) {
        favorites = favorites.filter(id => id !== songId);
    } else {
        favorites.push(songId);
    }
    saveFavorites(favorites);

    // Sync playing card if it is this one
    updateLikeButtonState();

    // Re-render
    filterAndRender();
}

function updateLikeButtonState() {
    if (currentQueueIndex === -1 || playbackQueue.length === 0) {
        playerLikeBtn.style.display = 'none';
        return;
    }
    playerLikeBtn.style.display = 'block';
    const activeSong = playbackQueue[currentQueueIndex];
    const favorites = getFavorites();
    const isLiked = favorites.includes(activeSong.id);
    
    playerLikeBtn.classList.toggle('liked', isLiked);
    playerLikeBtn.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
}

playerLikeBtn.addEventListener('click', () => {
    if (currentQueueIndex !== -1 && playbackQueue.length > 0) {
        const activeSong = playbackQueue[currentQueueIndex];
        toggleLike(activeSong.id);
    }
});

// ----------------------------------------------------
// PLAYBACK ENGINE (QUEUE & MEDIA PLAYER)
// ----------------------------------------------------
function playSongFromContext(songId, contextList) {
    currentSongsContext = [...contextList];
    
    // Copy context list as default queue
    if (shuffleState) {
        originalQueueOrder = [...contextList];
        playbackQueue = shuffleArray([...contextList]);
    } else {
        playbackQueue = [...contextList];
    }
    
    const index = playbackQueue.findIndex(s => s.id === songId);
    if (index !== -1) {
        playQueueIndex(index);
    }
}

function playQueueIndex(index) {
    if (index < 0 || index >= playbackQueue.length) return;

    currentQueueIndex = index;
    const song = playbackQueue[currentQueueIndex];

    // Load URL in Audio element (Go HTTP 206 backend)
    audioPlayer.src = `/api/stream?id=${song.id}`;
    audioPlayer.load(); // Forces fresh request
    
    audioPlayer.play()
        .then(() => {
            isPlaying = true;
            updatePlayBtnIcon();
        })
        .catch(err => {
            console.error('Playback failed:', err);
            isPlaying = false;
            updatePlayBtnIcon();
        });

    // Update Bottom Bar UI
    currentTitle.textContent = song.name;
    currentArtist.textContent = song.artist || 'Unknown Artist';
    updateLikeButtonState();
    
    // Render Album art on player
    drawAlbumArt(playerArtCanvas, song.name, song.artist || 'Unknown Artist');

    // Update active visual rows
    filterAndRender();
}

function togglePlay() {
    if (playbackQueue.length === 0) {
        // Fallback: load flat allSongs list as context
        if (allSongs.length > 0) {
            playSongFromContext(allSongs[0].id, allSongs);
        }
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
    } else {
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
            })
            .catch(err => console.error(err));
    }
    updatePlayBtnIcon();
}

function updatePlayBtnIcon() {
    playBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
}

function nextSong() {
    if (playbackQueue.length === 0) return;

    if (loopState === 2) {
        // Loop active song
        playQueueIndex(currentQueueIndex);
    } else if (currentQueueIndex < playbackQueue.length - 1) {
        playQueueIndex(currentQueueIndex + 1);
    } else if (loopState === 1) {
        // Loop back to start of context/queue
        playQueueIndex(0);
    } else {
        isPlaying = false;
        updatePlayBtnIcon();
    }
}

function prevSong() {
    if (playbackQueue.length === 0) return;

    if (audioPlayer.currentTime > 3.0) {
        // Rewind to beginning of song
        audioPlayer.currentTime = 0;
    } else if (currentQueueIndex > 0) {
        playQueueIndex(currentQueueIndex - 1);
    } else if (loopState === 1) {
        // Loop to end
        playQueueIndex(playbackQueue.length - 1);
    }
}

// Shuffle implementation
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

shuffleBtn.addEventListener('click', () => {
    if (playbackQueue.length === 0) return;
    
    shuffleState = !shuffleState;
    shuffleBtn.classList.toggle('active', shuffleState);

    const activeSong = playbackQueue[currentQueueIndex];

    if (shuffleState) {
        // Shuffle queue, preserving currently playing song at index 0
        originalQueueOrder = [...playbackQueue];
        const remaining = playbackQueue.filter(s => s.id !== activeSong.id);
        const shuffledRemaining = shuffleArray(remaining);
        playbackQueue = [activeSong, ...shuffledRemaining];
        currentQueueIndex = 0;
    } else {
        // Restore order
        playbackQueue = [...originalQueueOrder];
        currentQueueIndex = playbackQueue.findIndex(s => s.id === activeSong.id);
    }
    
    if (currentView === 'queue') filterAndRender();
});

// Loop/Repeat Mode switcher
loopBtn.addEventListener('click', () => {
    loopState = (loopState + 1) % 3;
    
    // Cycle classes & icons
    if (loopState === 0) {
        loopBtn.classList.remove('active');
        loopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
        loopBtn.title = "Repeat Off";
    } else if (loopState === 1) {
        loopBtn.classList.add('active');
        loopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
        loopBtn.title = "Repeat Queue";
    } else if (loopState === 2) {
        loopBtn.classList.add('active');
        loopBtn.innerHTML = '<i class="fa-solid fa-repeat" style="position:relative;"></i><span style="font-size:8px; font-weight:800; position:absolute; top:-3px; right:-3px; background:#1db954; color:#000; border-radius:50%; width:10px; height:10px; display:flex; align-items:center; justify-content:center;">1</span>';
        loopBtn.title = "Repeat One";
    }
});

// ----------------------------------------------------
// VOLUME & SEEKING CONTROLS (HTTP 206 SUPPORTED)
// ----------------------------------------------------
audioPlayer.addEventListener('timeupdate', () => {
    const { currentTime, duration } = audioPlayer;
    if (duration) {
        const percent = (currentTime / duration) * 100;
        progressBar.value = percent;
        
        // Dynamic seekbar styling
        progressBar.style.background = `linear-gradient(to right, var(--accent-color) ${percent}%, rgba(255,255,255,0.1) ${percent}%)`;
        
        // Time labels
        currentTimeEl.textContent = formatTime(currentTime);
        durationEl.textContent = formatTime(duration);
    }
});

audioPlayer.addEventListener('durationchange', () => {
    if (audioPlayer.duration) {
        durationEl.textContent = formatTime(audioPlayer.duration);
    }
});

audioPlayer.addEventListener('ended', nextSong);

function formatTime(time) {
    if (isNaN(time)) return '0:00';
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
}

// Flawless Seeking (Triggers standard HTTP 206 range requests)
progressBar.addEventListener('input', () => {
    const duration = audioPlayer.duration;
    if (duration) {
        const targetTime = (progressBar.value / 100) * duration;
        audioPlayer.currentTime = targetTime;
    }
});

// Volume adjustment
volumeBar.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audioPlayer.volume = val;
    updateVolumeIcon(val);
});

function updateVolumeIcon(vol) {
    if (vol === 0) {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else if (vol < 0.4) {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
    } else {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
}

muteBtn.addEventListener('click', () => {
    if (audioPlayer.volume > 0) {
        preMuteVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        volumeBar.value = 0;
    } else {
        audioPlayer.volume = preMuteVolume;
        volumeBar.value = preMuteVolume;
    }
    updateVolumeIcon(audioPlayer.volume);
});

// ----------------------------------------------------
// EVENT LISTENERS & NAVIGATION HOOKS
// ----------------------------------------------------
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', nextSong);

searchInput.addEventListener('input', () => {
    filterAndRender();
});

navHome.addEventListener('click', () => setView('home'));
navFavorites.addEventListener('click', () => setView('favorites'));
navQueue.addEventListener('click', () => setView('queue'));
navAdmin.addEventListener('click', () => setView('admin'));
document.getElementById('logoClick').addEventListener('click', () => setView('home'));

clearQueueBtn.addEventListener('click', () => {
    if (playbackQueue.length > 0) {
        const activeSong = playbackQueue[currentQueueIndex];
        playbackQueue = [activeSong];
        currentQueueIndex = 0;
        filterAndRender();
    }
});

// ==========================================================================
// ADMIN PORTAL STATE & ACTION HANDLERS
// ==========================================================================

async function checkAdminStatus() {
    try {
        const res = await fetch('/api/admin/status');
        if (res.ok) {
            const data = await res.json();
            isAdminAuthenticated = data.authenticated;
            isDriveWritable = data.writable;
            isOauthConfigured = data.oauthConfigured;
            updateAdminUI();
        }
    } catch (err) {
        console.error('Failed to check admin status:', err);
    }
}

function updateAdminUI() {
    const adminLoginCard = document.getElementById('adminLoginCard');
    const adminDashboard = document.getElementById('adminDashboard');
    const driveWriteStatus = document.getElementById('driveWriteStatus');
    const oauthPromptBanner = document.getElementById('oauthPromptBanner');

    if (isAdminAuthenticated) {
        adminLoginCard.style.display = 'none';
        adminDashboard.style.display = 'block';
        
        if (isDriveWritable) {
            driveWriteStatus.textContent = 'Active (Write-Enabled)';
            driveWriteStatus.className = 'badge-status';
            if (oauthPromptBanner) oauthPromptBanner.style.display = 'none';
        } else {
            driveWriteStatus.textContent = 'Read-Only (API Key)';
            driveWriteStatus.className = 'badge-status read-only';
            if (oauthPromptBanner) {
                if (isOauthConfigured) {
                    oauthPromptBanner.style.display = 'block';
                } else {
                    oauthPromptBanner.style.display = 'none';
                }
            }
        }
        
        populateArtistFolders();
        renderAdminSongsList();
    } else {
        adminLoginCard.style.display = 'flex';
        adminDashboard.style.display = 'none';
    }
}

function populateArtistFolders() {
    const select = document.getElementById('uploadArtistSelect');
    const currentValue = select.value;
    select.innerHTML = '<option value="Unknown Artist">-- Unknown Artist (Root Folder) --</option>';
    
    const artists = new Set();
    allSongs.forEach(s => {
        if (s.artist && s.artist !== 'Unknown Artist') {
            artists.add(s.artist);
        }
    });

    Array.from(artists).sort().forEach(artist => {
        const opt = document.createElement('option');
        opt.value = artist;
        opt.textContent = artist;
        select.appendChild(opt);
    });

    select.value = currentValue || 'Unknown Artist';
}

function renderAdminSongsList() {
    const list = document.getElementById('adminSongsList');
    const filterTerm = document.getElementById('adminSongSearch').value.trim().toLowerCase();
    list.innerHTML = '';

    let filtered = allSongs;
    if (filterTerm) {
        filtered = allSongs.filter(s => 
            s.name.toLowerCase().includes(filterTerm) || 
            (s.artist && s.artist.toLowerCase().includes(filterTerm))
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = '<li style="padding:16px; text-align:center; color:var(--text-secondary); font-size:13px;">No matching songs in library.</li>';
        return;
    }

    filtered.forEach(song => {
        const item = document.createElement('li');
        item.className = 'admin-song-item';
        item.innerHTML = `
            <div class="admin-song-meta">
                <div class="admin-song-title">${song.name}</div>
                <div class="admin-song-artist">${song.artist || 'Unknown Artist'}</div>
            </div>
            <button class="btn-delete-song" title="Delete Song From Google Drive" data-id="${song.id}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        item.querySelector('.btn-delete-song').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSong(song.id, song.name);
        });

        list.appendChild(item);
    });
}

async function deleteSong(id, name) {
    if (!isDriveWritable) {
        alert('Cannot delete: Google Drive service is in Read-Only mode. Please connect your Google Account in the Library Administration header to authorize writing.');
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete "${name}" from Google Drive? This cannot be undone!`)) {
        return;
    }

    try {
        const btn = document.querySelector(`.btn-delete-song[data-id="${id}"]`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        const res = await fetch('/api/admin/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
        });

        if (!res.ok) {
            const errMsg = await res.text();
            throw new Error(errMsg || 'Failed to delete song');
        }

        // Successfully deleted. Reload songs!
        await fetchSongs();
        renderAdminSongsList();
        populateArtistFolders();
    } catch (err) {
        console.error('Failed to delete song:', err);
        alert(`Error deleting song: ${err.message}`);
        const btn = document.querySelector(`.btn-delete-song[data-id="${id}"]`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        }
    }
}

async function uploadFiles(files) {
    if (files.length === 0) return;

    if (!isDriveWritable) {
        alert('Cannot upload: Google Drive service is in Read-Only mode. Please connect your Google Account in the Library Administration header to authorize writing.');
        return;
    }

    let artist = document.getElementById('uploadArtistSelect').value;
    const newArtist = document.getElementById('newArtistInput').value.trim();
    if (newArtist) {
        artist = newArtist;
    }

    const progressContainer = document.getElementById('uploadProgressList');
    const progressListScroll = document.getElementById('progressListScroll');
    progressContainer.style.display = 'block';

    const fileListArray = Array.from(files);

    for (let i = 0; i < fileListArray.length; i++) {
        const file = fileListArray[i];
        
        // Match both mime and extension for robustness
        if (file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) {
            console.warn(`Skipping non-MP3 file: ${file.name}`);
            continue;
        }

        const progressId = 'upload_' + Date.now() + '_' + i;
        const progressItem = document.createElement('div');
        progressItem.className = 'upload-progress-item';
        progressItem.id = progressId;
        progressItem.innerHTML = `
            <div class="upload-progress-info">
                <span class="upload-file-name" title="${file.name}">${file.name}</span>
                <span class="upload-file-percent" id="${progressId}_percent">0%</span>
            </div>
            <div class="upload-progress-bar-container">
                <div class="upload-progress-bar" id="${progressId}_bar"></div>
            </div>
        `;
        progressListScroll.appendChild(progressItem);
        progressListScroll.scrollTop = progressListScroll.scrollHeight;

        try {
            await uploadSingleFile(file, artist, progressId);
        } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
            const percentEl = document.getElementById(`${progressId}_percent`);
            if (percentEl) {
                percentEl.textContent = 'Failed';
                percentEl.style.color = '#eb5757';
            }
        }
    }

    document.getElementById('newArtistInput').value = '';
    await fetchSongs();
    populateArtistFolders();
    renderAdminSongsList();
}

function uploadSingleFile(file, artist, progressId) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/upload');

        const formData = new FormData();
        formData.append('songs', file);
        formData.append('artist', artist);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                const percentEl = document.getElementById(`${progressId}_percent`);
                const barEl = document.getElementById(`${progressId}_bar`);
                if (percentEl) percentEl.textContent = `${percent}%`;
                if (barEl) {
                    barEl.style.width = `${percent}%`;
                }
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const percentEl = document.getElementById(`${progressId}_percent`);
                const barEl = document.getElementById(`${progressId}_bar`);
                if (percentEl) {
                    percentEl.textContent = 'Completed';
                    percentEl.style.color = 'var(--accent-color)';
                }
                if (barEl) barEl.style.width = '100%';
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(xhr.responseText || `Upload failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during upload'));
        };

        xhr.send(formData);
    });
}

// ----------------------------------------------------
// DOM EVENT LISTENERS FOR ADMIN PORTAL
// ----------------------------------------------------

const adminLoginForm = document.getElementById('adminLoginForm');
adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginErrorMsg');
    
    errorEl.style.display = 'none';

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            throw new Error('Invalid administrative credentials');
        }

        isAdminAuthenticated = true;
        document.getElementById('adminEmail').value = '';
        document.getElementById('adminPassword').value = '';
        checkAdminStatus();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
});

const adminLogoutBtn = document.getElementById('adminLogoutBtn');
adminLogoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/admin/logout');
        isAdminAuthenticated = false;
        setView('home');
    } catch (err) {
        console.error('Logout failed:', err);
    }
});

const refreshArtistsBtn = document.getElementById('refreshArtistsBtn');
refreshArtistsBtn.addEventListener('click', () => {
    populateArtistFolders();
});

const adminSongSearch = document.getElementById('adminSongSearch');
adminSongSearch.addEventListener('input', () => {
    renderAdminSongsList();
});

const uploadDropzone = document.getElementById('uploadDropzone');
const fileInput = document.getElementById('fileInput');

uploadDropzone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    uploadFiles(e.target.files);
});

uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
});

uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
});

uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files) {
        uploadFiles(e.dataTransfer.files);
    }
});

// Initialize App
fetchSongs();
checkAdminStatus(); // Check persistent administrative session on load

// Check for successful OAuth authorization callback hash
if (window.location.hash === '#admin-authorized') {
    alert('Google Drive Account connected successfully! Write access is now fully active.');
    window.history.replaceState(null, null, ' ');
}

volumeBar.style.background = `linear-gradient(to right, var(--accent-color) ${volumeBar.value * 100}%, rgba(255,255,255,0.1) ${volumeBar.value * 100}%)`;
volumeBar.addEventListener('input', () => {
    volumeBar.style.background = `linear-gradient(to right, var(--accent-color) ${volumeBar.value * 100}%, rgba(255,255,255,0.1) ${volumeBar.value * 100}%)`;
});
