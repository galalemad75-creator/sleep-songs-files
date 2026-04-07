// ===== Play/Stop Toggle (v7.6) =====

/* ===== App.js - Sleep Songs ===== */

// ===== Theme Management =====
(function initTheme() {
    var saved = localStorage.getItem('theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
})();

function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var next;
    if (current === 'dark') {
        next = 'light';
    } else if (current === 'light') {
        next = 'dark';
    } else {
        next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

// ===== Default Chapters Data =====
const DEFAULT_CHAPTERS = [
    { id: 1, name: 'Dreamland Clouds', icon: '☁️', songs: [] },
    { id: 2, name: 'Moonlit Dreams', icon: '🌙', songs: [] },
    { id: 3, name: 'Whispering Pines', icon: '🌲', songs: [] },
    { id: 4, name: 'Ocean Breeze', icon: '🌊', songs: [] },
    { id: 5, name: 'Starlight Serenade', icon: '⭐', songs: [] },
    { id: 6, name: 'Gentle Rain', icon: '🌧️', songs: [] },
    { id: 7, name: 'Morning Dew', icon: '🌅', songs: [] },
    { id: 8, name: 'Sunset Glow', icon: '🌇', songs: [] },
    { id: 9, name: 'Night Owl', icon: '🦉', songs: [] },
    { id: 10, name: 'Silent Valley', icon: '🏔️', songs: [] },
    { id: 11, name: 'Forest Walk', icon: '🌳', songs: [] },
    { id: 12, name: 'River Flow', icon: '🏞️', songs: [] },
    { id: 13, name: 'Mountain Echo', icon: '⛰️', songs: [] },
    { id: 14, name: 'Cloud Nine', icon: '☁️', songs: [] },
    { id: 15, name: 'Breeze of Hope', icon: '🍃', songs: [] },
    { id: 16, name: 'Peaceful Mind', icon: '☮️', songs: [] },
    { id: 17, name: 'Harmony', icon: '🎵', songs: [] },
    { id: 18, name: 'Soft Waves', icon: '🌊', songs: [] },
    { id: 19, name: 'Evening Calm', icon: '🌆', songs: [] },
    { id: 20, name: 'Lunar Phase', icon: '🌕', songs: [] },
    { id: 21, name: 'Deep Sleep', icon: '💤', songs: [] },
    { id: 22, name: 'Wind Chimes', icon: '🎐', songs: [] },
    { id: 23, name: 'Starlit Path', icon: '✨', songs: [] },
    { id: 24, name: 'Dream Weaver', icon: '🌀', songs: [] },
    { id: 25, name: 'Calm Waters', icon: '💧', songs: [] },
    { id: 26, name: 'Tranquil Night', icon: '🌃', songs: [] },
    { id: 27, name: 'Healing Rain', icon: '🌧️', songs: [] },
    { id: 28, name: 'Sleepy Town', icon: '🏘️', songs: [] },
    { id: 29, name: 'Night Whisper', icon: '🤫', songs: [] },
    { id: 30, name: 'Sleepy Train', icon: '🚂', songs: [] },
    { id: 31, name: 'Only Music', icon: '🎼', songs: [], isMusic: true }
];

// ===== Default Songs per Chapter =====
const DEFAULT_SONGS = {};

// ===== Default Contact Info =====
const DEFAULT_CONTACT = {
    email: 'Emadh5156@gmail.com',
    youtube: '',
    spotify: '',
    instagram: '',
    twitter: '',
    facebook: '',
    tiktok: '',
    website: '',
    customMessage: 'Feel free to reach out anytime!'
};

// ===== State =====
let chapters = [];
let currentChapter = null;
let currentSongIndex = -1;
let isAdmin = false;
let playCounts = {};
let contactInfo = {};       // editable contact info
let favorites = {};         // { songId: true }

// ===== API Helpers =====
const API = {
    baseUrl: '',
    
    async get(endpoint) {
        const token = localStorage.getItem('admin_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(`${this.baseUrl}/api${endpoint}`, { headers });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },
    
    async post(endpoint, data) {
        const token = localStorage.getItem('admin_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(`${this.baseUrl}/api${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `API Error: ${res.status}`);
        }
        return res.json();
    },
    
    async put(endpoint, data) {
        const token = localStorage.getItem('admin_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(`${this.baseUrl}/api${endpoint}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },
    
    async delete(endpoint) {
        const token = localStorage.getItem('admin_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(`${this.baseUrl}/api${endpoint}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },
    
    async upload(endpoint, formData) {
        const token = localStorage.getItem('admin_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(`${this.baseUrl}/api${endpoint}`, {
            method: 'POST',
            headers,
            body: formData
        });
        if (!res.ok) throw new Error(`Upload Error: ${res.status}`);
        return res.json();
    }
};

const APP_VERSION = '6.1';

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Clear old data if version changed
        if (localStorage.getItem('app_version') !== APP_VERSION) {
            localStorage.setItem('app_version', APP_VERSION);
        }
        createStars();
        loadChapters();
        loadContactInfo();
        loadFavorites();
        initScrollEffects();
        checkAdminSession();
        loadPlayCounts();
        injectAds(); // Load and inject saved ads on page load
        initCookieConsent(); // Show cookie banner if not accepted yet
    } catch (err) {
        console.error('[Init] Error during page load:', err);
        // ✅ FIX: Ensure chapters render even if other init steps fail
        try { loadChapters(); } catch(e2) { console.error('[Init] Critical:', e2); }
    }
});

// ===== Android Hardware Back Button =====


// ===== Cookie Consent =====
function initCookieConsent() {
    if (localStorage.getItem('cookies_accepted') === 'true') {
        const banner = document.getElementById('cookieBanner');
        if (banner) banner.classList.add('hidden');
    }
}
function acceptCookies() {
    localStorage.setItem('cookies_accepted', 'true');
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.add('hidden');
}

// ===== Stars Background =====
function createStars() {
    const container = document.getElementById('stars');
    for (let i = 0; i < 80; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 3 + 1;
        star.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            --duration: ${Math.random() * 3 + 2}s;
            animation-delay: ${Math.random() * 5}s;
        `;
        container.appendChild(star);
    }
}

// ===== Scroll Effects =====
function initScrollEffects() {
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// ===== Load Chapters =====
async function loadChapters() {
    // 1. Try loading from static data.json (GitHub raw URL)
    try {
        var jsonUrl = 'data.json';
        if (location.hostname.includes('github.io')) {
            jsonUrl = 'https://raw.githubusercontent.com/galalemad75-creator/sleep-songs-files/main/data.json';
        }
        const res = await fetch(jsonUrl + '?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.chapters && data.chapters.length > 0) {
                chapters = data.chapters;
                saveChaptersLocal();
                renderChapters();
                updateStats();
                return;
            }
        }
    } catch (e) {
        console.warn('[Load] data.json not found, trying localStorage');
    }

    // 2. Fallback to localStorage
    const stored = localStorage.getItem('chapters');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.length > 0) {
                chapters = parsed;
                renderChapters();
                updateStats();
                return;
            }
        } catch(e) {}
    }

    // 3. Last resort: defaults
    chapters = JSON.parse(JSON.stringify(DEFAULT_CHAPTERS));
    saveChaptersLocal();
    renderChapters();
    updateStats();
}

function saveChaptersLocal() {
    localStorage.setItem('chapters', JSON.stringify(chapters));
}

// ===== Contact Info =====
function loadContactInfo() {
    const stored = localStorage.getItem('contact_info');
    if (stored) {
        contactInfo = JSON.parse(stored);
    } else {
        contactInfo = { ...DEFAULT_CONTACT };
    }
    renderContactInfo();
}

function saveContactInfo() {
    contactInfo = {
        email: document.getElementById('contactEmail')?.value?.trim() || '',
        youtube: document.getElementById('contactYoutube')?.value?.trim() || '',
        spotify: document.getElementById('contactSpotify')?.value?.trim() || '',
        instagram: document.getElementById('contactInstagram')?.value?.trim() || '',
        twitter: document.getElementById('contactTwitter')?.value?.trim() || '',
        facebook: document.getElementById('contactFacebook')?.value?.trim() || '',
        tiktok: document.getElementById('contactTiktok')?.value?.trim() || '',
        website: document.getElementById('contactWebsite')?.value?.trim() || '',
        customMessage: document.getElementById('contactMessage')?.value?.trim() || ''
    };
    localStorage.setItem('contact_info', JSON.stringify(contactInfo));
    renderContactInfo();
    toast('Contact info saved!', 'success');
}

function renderContactInfo() {
    // Update about page contact
    const aboutContact = document.getElementById('aboutContact');
    if (aboutContact) {
        let html = '';
        if (contactInfo.customMessage) html += `<p>${contactInfo.customMessage}</p>`;
        html += `<p><a href="#" onclick="showContact()">📧 Click here to see all contact info</a></p>`;
        aboutContact.innerHTML = html;
    }

    // Update admin form
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
    el('contactEmail', contactInfo.email);
    el('contactYoutube', contactInfo.youtube);
    el('contactSpotify', contactInfo.spotify);
    el('contactInstagram', contactInfo.instagram);
    el('contactTwitter', contactInfo.twitter);
    el('contactFacebook', contactInfo.facebook);
    el('contactTiktok', contactInfo.tiktok);
    el('contactWebsite', contactInfo.website);
    el('contactMessage', contactInfo.customMessage);
}

// ===== Render Chapters =====
function renderChapters() {
    const grid = document.getElementById('chaptersGrid');
    if (!grid) return;

    grid.innerHTML = chapters.map(ch => `
        <div class="chapter-card ${ch.isMusic ? 'music-only' : ''}" onclick="openChapter(${ch.id})">
            <div class="chapter-number">${ch.isMusic ? '🎵' : ch.id}</div>
            <div class="chapter-name">${ch.icon} ${ch.name}</div>
            <div class="chapter-count">${ch.songs.length} ${ch.isMusic ? 'piece' + (ch.songs.length !== 1 ? 's' : '') : 'song' + (ch.songs.length !== 1 ? 's' : '')}</div>
        </div>
    `).join('');

    // Insert middle ad if configured
    insertMiddleAd();
}

// ===== Open Chapter =====
function openChapter(chapterId) {
    currentChapter = chapters.find(c => c.id === chapterId);
    if (!currentChapter) return;

    const grid = document.getElementById('chaptersGrid');
    const section = document.getElementById('chaptersSection');
    const hero = document.getElementById('heroSection');

    hero.style.display = 'none';

    section.innerHTML = `
        <div class="songs-view">
            <button class="back-btn" onclick="goBack()">← Back to Chapters</button>
            <div class="songs-header">
                <div class="chapter-number">${currentChapter.isMusic ? '🎵' : currentChapter.id}</div>
                <h2>${currentChapter.icon} ${currentChapter.name}</h2>
            </div>
            ${currentChapter.songs.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-icon">🎵</div>
                    <p>No ${currentChapter.isMusic ? 'pieces' : 'songs'} in this chapter yet</p>
                    <p style="font-size:0.9rem; margin-top:10px">${currentChapter.isMusic ? 'Pieces' : 'Songs'} will be added soon</p>
                </div>
            ` : `
                <div class="chapter-actions-bar">
                    <button class="btn btn-primary btn-sm" onclick="playAllFromChapter()">▶ Play All</button>
                    <button class="btn btn-secondary btn-sm" onclick="shuffleAllFromChapter()">🔀 Shuffle All</button>
                    <button class="btn btn-secondary btn-sm" onclick="addAllFromChapter()">📋 Add All to Playlist</button>
                </div>
                <div class="songs-grid">
                    ${currentChapter.songs.map((song, idx) => {
                        
                        const songId = song.id || song.title;
                        const liked = isFavorite(songId);
                        return `
                        <div class="song-card " id="song-card-${idx}">
                            <div class="song-card-click" onclick="playSong(${idx})">
                                <img src="${song.image || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231A1744%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>🎵</text></svg>'}" 
                                     alt="${song.title}" class="song-image" loading="lazy">
                                <div class="song-info">
                                    <div class="song-title">${song.title}</div>
                                    <div class="song-meta">${currentChapter.name}</div>
                                </div>
                                <div class="song-play-icon">▶</div>
                            </div>
                            <div class="song-card-actions">
                                <button class="like-btn ${liked ? 'liked' : ''}" data-id="${songId}"
                                        onclick="event.stopPropagation(); toggleFavorite('${songId}')">
                                    ${liked ? '❤️' : '🤍'}
                                </button>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            `}
        </div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
    const section = document.getElementById('chaptersSection');
    const hero = document.getElementById('heroSection');
    
    hero.style.display = 'flex';
    
    section.innerHTML = `
        <h2 class="section-title">
            <span class="title-icon">📚</span>
            Song Chapters
            <span class="title-icon">📚</span>
        </h2>
        <div class="chapters-grid" id="chaptersGrid"></div>
    `;
    
    renderChapters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Audio Player =====
const audioPlayer = document.getElementById('audioPlayer');
const nowPlaying = document.getElementById('nowPlaying');

// ===== Stop Song =====
function stopSong() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    var btn = document.getElementById('npPlayStopBtn');
    if (btn) btn.textContent = '▶';
    document.querySelectorAll('.song-card').forEach(c => c.classList.remove('playing'));
}

function playSong(index) {
    if (!currentChapter || !currentChapter.songs[index]) return;

    currentSongIndex = index;
    const song = currentChapter.songs[index];

    if (!song.audio) {
        toast('No audio file for this song yet', 'error');
        return;
    }

    document.querySelectorAll('.song-card').forEach(c => c.classList.remove('playing'));
    const card = document.getElementById(`song-card-${index}`);
    if (card) card.classList.add('playing');

    // Convert URL for playback
    const playUrl = convertUrl(song.audio);
    audioPlayer.src = playUrl;
    audioPlayer.load();
    audioPlayer.play().catch(e => {
        console.warn('Play failed:', e);
        toast('Could not play audio. Check the link.', 'error');
    });

    document.getElementById('npTitle').textContent = song.title;
    document.getElementById('npChapter').textContent = currentChapter.name;
    document.getElementById('npImage').src = song.image || '';
    document.getElementById('npPlayStopBtn').textContent = '⏸';
    nowPlaying.style.display = 'block';

    trackPlay(song.id || song.title);
}

function togglePlayStop() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        document.getElementById('npPlayStopBtn').textContent = '⏸';
    } else {
        audioPlayer.pause();
        document.getElementById('npPlayStopBtn').textContent = '▶';
    }
}

function nextTrack() {
    if (!currentChapter) return;
    const next = currentSongIndex + 1;
    if (next < currentChapter.songs.length) {
        playSong(next);
    }
}

function prevTrack() {
    if (!currentChapter) return;
    const prev = currentSongIndex - 1;
    if (prev >= 0) {
        playSong(prev);
    }
}

function closePlayer() {
    audioPlayer.pause();
    audioPlayer.src = '';
    nowPlaying.style.display = 'none';
    document.querySelectorAll('.song-card').forEach(c => c.classList.remove('playing'));
    currentSongIndex = -1;
    var btn = document.getElementById('npPlayStopBtn');
    if (btn) btn.textContent = '▶';
}

function seekAudio(e) {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = pct * audioPlayer.duration;
}

audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('npCurrentTime').textContent = formatTime(audioPlayer.currentTime);
        document.getElementById('npDuration').textContent = formatTime(audioPlayer.duration);
    }
});

audioPlayer.addEventListener('ended', () => {
    var btn = document.getElementById('npPlayStopBtn');
    if (btn) btn.textContent = '▶';
    nextTrack();
});

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ===== Playlist Management =====















// ===== Play Counts =====
function loadPlayCounts() {
    const stored = localStorage.getItem('playCounts');
    playCounts = stored ? JSON.parse(stored) : {};
}

function trackPlay(songId) {
    playCounts[songId] = (playCounts[songId] || 0) + 1;
    localStorage.setItem('playCounts', JSON.stringify(playCounts));
    updateStats();
}

function getTotalPlays() {
    return Object.values(playCounts).reduce((a, b) => a + b, 0);
}

// ===== Favorites / Likes =====
function loadFavorites() {
    const stored = localStorage.getItem('favorites');
    favorites = stored ? JSON.parse(stored) : {};
}

function toggleFavorite(songId) {
    if (favorites[songId]) {
        delete favorites[songId];
    } else {
        favorites[songId] = true;
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    // Update the button
    const btn = document.querySelector(`.like-btn[data-id="${songId}"]`);
    if (btn) {
        btn.classList.toggle('liked', !!favorites[songId]);
        btn.innerHTML = favorites[songId] ? '❤️' : '🤍';
    }
    updateStats();
}

function isFavorite(songId) {
    return !!favorites[songId];
}

function getFavoritesCount() {
    return Object.keys(favorites).length;
}

// ===== Navigation =====
function hideAllPages() {
    ['heroSection', 'mainContent', 'aboutPage', 'privacyPage', 'termsPage', 
     'adminLoginPage', 'adminPanel', 'forgotPasswordPage', 'changePasswordSection',
     'githubSettingsSection', 'contactPage', 'statsPage', 'soundSettingsPage'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
}

function showHome() {
    hideAllPages();
    document.getElementById('heroSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('nav-home').classList.add('active');
    goBack();
}

function showAbout() {
    hideAllPages();
    document.getElementById('aboutPage').style.display = 'block';
    document.getElementById('nav-about').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPrivacy() {
    hideAllPages();
    document.getElementById('privacyPage').style.display = 'block';
    document.getElementById('nav-privacy').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showTerms() {
    hideAllPages();
    document.getElementById('termsPage').style.display = 'block';
    document.getElementById('nav-terms').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}




function removeAudioFile(index) {
    const audioFiles = JSON.parse(localStorage.getItem('uploadedAudioFiles') || '[]');
    audioFiles.splice(index, 1);
    localStorage.setItem('uploadedAudioFiles', JSON.stringify(audioFiles));
    renderAudioFilesList();
    showToast('🗑️ File removed');
}


function showContact() {
    hideAllPages();
    document.getElementById('contactPage').style.display = 'block';
    document.getElementById('nav-contact').classList.add('active');
    // Reset form state
    var form = document.getElementById('contactForm');
    if (form) form.reset();
    var status = document.getElementById('contactFormStatus');
    if (status) status.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Contact Form - Vercel API + Resend (3000 emails/month free) =====
// API key is stored in Vercel env vars as RESEND_API_KEY

function handleContactForm(e) {
    e.preventDefault();
    var name = document.getElementById('contactName').value.trim();
    var email = document.getElementById('contactEmail').value.trim();
    var subject = document.getElementById('contactSubject').value.trim() || '';
    var message = document.getElementById('contactMessage').value.trim();
    var statusEl = document.getElementById('contactFormStatus');
    var btn = document.getElementById('contactSubmitBtn');
    var formEl = document.getElementById('contactForm');

    if (!name || !email || !message) {
        statusEl.style.display = 'block';
        statusEl.className = 'contact-form-status error';
        statusEl.textContent = '⚠️ Please fill in all required fields.';
        return;
    }

    // Show loading
    btn.querySelector('.contact-submit-text').style.display = 'none';
    btn.querySelector('.contact-submit-loading').style.display = 'inline';
    btn.disabled = true;
    statusEl.style.display = 'none';

    // API base URL
    var apiBase = '';
    if (location.hostname.includes('github.io')) {
        apiBase = 'https://sleep-songs-site.vercel.app';
    }

    fetch(apiBase + '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, subject: subject, message: message })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            statusEl.style.display = 'block';
            statusEl.className = 'contact-form-status success';
            statusEl.textContent = '✅ Message sent successfully! We\'ll get back to you soon.';
            formEl.reset();
        } else {
            throw new Error(data.error || 'Failed to send');
        }
    })
    .catch(function(err) {
        statusEl.style.display = 'block';
        statusEl.className = 'contact-form-status error';
        statusEl.innerHTML = '❌ ' + (err.message || 'Could not send message') + '<br><small>Or email us at <a href="mailto:emadh5156@gmail.com">emadh5156@gmail.com</a></small>';
    })
    .finally(function() {
        btn.querySelector('.contact-submit-text').style.display = 'inline';
        btn.querySelector('.contact-submit-loading').style.display = 'none';
        btn.disabled = false;
    });
}

function showStats() {
    hideAllPages();
    document.getElementById('statsPage').style.display = 'block';
    document.getElementById('nav-stats').classList.add('active');
    renderStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStats() {
    const container = document.getElementById('statsContent');
    if (!container) return;

    // Most played songs
    const sortedPlays = Object.entries(playCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const favCount = getFavoritesCount();
    const totalPlays = getTotalPlays();
    const totalSongs = chapters.reduce((sum, ch) => sum + ch.songs.length, 0);

    let html = `
        <div class="stats-overview">
            <div class="stat-card-large">
                <span class="stat-number-big">${totalPlays}</span>
                <span class="stat-label-big">Total Plays</span>
            </div>
            <div class="stat-card-large">
                <span class="stat-number-big">${favCount}</span>
                <span class="stat-label-big">❤️ Favorites</span>
            </div>
            <div class="stat-card-large">
                <span class="stat-number-big">${totalSongs}</span>
                <span class="stat-label-big">Total Songs</span>
            </div>
        </div>
    `;

    // Top played
    if (sortedPlays.length > 0) {
        html += `<h3 class="stats-section-title">🏆 Most Played</h3>
        <div class="stats-list">`;
        sortedPlays.forEach(([songId, count], i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            html += `<div class="stats-list-item">
                <span class="stats-rank">${medal}</span>
                <span class="stats-name">${songId}</span>
                <span class="stats-count">${count} plays</span>
            </div>`;
        });
        html += `</div>`;
    }

    // Favorites list
    const favSongs = Object.keys(favorites);
    if (favSongs.length > 0) {
        html += `<h3 class="stats-section-title">❤️ Favorites (${favSongs.length})</h3>
        <div class="stats-list">`;
        favSongs.forEach(songId => {
            html += `<div class="stats-list-item">
                <span class="stats-rank">❤️</span>
                <span class="stats-name">${songId}</span>
                <button class="btn btn-sm btn-danger" onclick="toggleFavorite('${songId}'); renderStats();">Remove</button>
            </div>`;
        });
        html += `</div>`;
    }

    if (sortedPlays.length === 0 && favSongs.length === 0) {
        html += `<div class="empty-state"><div class="empty-icon">📊</div><p>No data yet — start listening!</p></div>`;
    }

    container.innerHTML = html;
}

function showAdminLogin() {
    if (isAdmin) {
        showAdminPanel();
        return;
    }
    hideAllPages();
    document.getElementById('adminLoginPage').style.display = 'block';
    document.getElementById('nav-admin').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => document.getElementById('adminPassword').focus(), 100);
}

function showForgotPassword() {
    hideAllPages();
    document.getElementById('forgotPasswordPage').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToChapters() {
    const section = document.getElementById('chaptersSection');
    section.scrollIntoView({ behavior: 'smooth' });
}

// ===== Mobile Menu =====
function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('open');
}

function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.remove('open');
}

// ===== Admin Auth =====
async function adminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');
    
    try {
        const result = await API.post('/auth/login', { password });
        localStorage.setItem('admin_token', result.token);
        isAdmin = true;
        showAdminPanel();
        toast('Login successful!', 'success');
    } catch (err) {
        const storedHash = localStorage.getItem('admin_password_hash');
        if (storedHash) {
            const hash = await hashPassword(password);
            if (hash === storedHash) {
                isAdmin = true;
                localStorage.setItem('admin_token', 'local_' + hash);
                showAdminPanel();
                toast('Login successful!', 'success');
                return;
            }
        }
        if (!storedHash) {
            const hash = await hashPassword(password);
            localStorage.setItem('admin_password_hash', hash);
            localStorage.setItem('recovery_key_hash', await hashPassword('sleep2026'));
            localStorage.setItem('admin_token', 'local_' + hash);
            isAdmin = true;
            showAdminPanel();
            toast('Password set successfully!', 'success');
            return;
        }
        
        errorEl.style.display = 'block';
        errorEl.textContent = 'Incorrect password';
    }
}

function adminLogout() {
    isAdmin = false;
    localStorage.removeItem('admin_token');
    showHome();
    toast('Logged out successfully', 'success');
}

function checkAdminSession() {
    const token = localStorage.getItem('admin_token');
    if (token && token.startsWith('local_')) {
        isAdmin = true;
    }
}

async function hashPassword(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + 'sleep_songs_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function recoverPassword(e) {
    e.preventDefault();
    const key = document.getElementById('recoveryKey').value;
    const resultEl = document.getElementById('recoveryResult');
    
    const storedHash = localStorage.getItem('recovery_key_hash');
    if (storedHash) {
        const hash = await hashPassword(key);
        if (hash === storedHash) {
            const newPass = Math.random().toString(36).substring(2, 10);
            const newHash = await hashPassword(newPass);
            localStorage.setItem('admin_password_hash', newHash);
            resultEl.style.display = 'block';
            resultEl.innerHTML = `New password: <br><code style="font-size:1.5rem;direction:ltr;display:block;margin-top:8px">${newPass}</code><br><small>Save it carefully!</small>`;
            return;
        }
    }
    
    try {
        const result = await API.post('/auth/recover', { key });
        resultEl.style.display = 'block';
        resultEl.innerHTML = `New password: <br><code style="font-size:1.5rem;direction:ltr;display:block;margin-top:8px">${result.newPassword}</code>`;
    } catch (err) {
        toast('Invalid recovery key', 'error');
    }
}

// ===== Admin Panel =====
function showAdminPanel() {
    hideAllPages();
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('nav-admin').classList.add('active');
    renderAdminChapters();
    updateStats();
    loadAdSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStats() {
    const el1 = document.getElementById('totalChapters');
    const el2 = document.getElementById('totalSongs');
    const el3 = document.getElementById('totalPlays');
    if (el1) el1.textContent = chapters.length;
    if (el2) el2.textContent = chapters.reduce((sum, ch) => sum + ch.songs.length, 0);
    if (el3) el3.textContent = getTotalPlays();
}

function renderAdminChapters() {
    const container = document.getElementById('adminChaptersList');
    container.innerHTML = `
        <div class="admin-chapters-add-bar">
            <button class="btn btn-primary btn-sm" onclick="showAddChapter()">➕ Add New Chapter</button>
            <button class="btn btn-secondary btn-sm" onclick="removeEmptyChapters()">🧹 Remove Empty</button>
        </div>
    ` + chapters.map(ch => `
        <div class="admin-chapter-item">
            <div class="admin-chapter-header" onclick="toggleChapterSongs(${ch.id})">
                <div class="admin-chapter-info">
                    <div class="admin-chapter-num">${ch.isMusic ? '🎵' : ch.id}</div>
                    <span class="admin-chapter-name">${ch.icon} ${ch.name}</span>
                    <span class="admin-chapter-songs">${ch.songs.length} song${ch.songs.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="admin-chapter-actions">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); showRenameChapter(${ch.id})" title="Rename">✏️</button>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); showAddSong(${ch.id})">➕ Add Song</button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteChapter(${ch.id})" title="Delete Chapter">🗑️</button>
                </div>
            </div>
            <div class="admin-songs-list" id="songs-${ch.id}">
                ${ch.songs.map((song, idx) => `
                    <div class="admin-song-item">
                        <img src="${song.image || ''}" alt="" class="admin-song-thumb" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231A1744%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2230%22>🎵</text></svg>'">
                        <div class="admin-song-details">
                            <div class="admin-song-name">${song.title}</div>
                            <div class="admin-song-meta">Plays: ${playCounts[song.id || song.title] || 0}</div>
                        </div>
                        <div class="admin-song-actions">
                            <button class="btn btn-icon btn-secondary" onclick="showEditSong(${ch.id}, ${idx})" title="Edit">✏️</button>
                            <button class="btn btn-icon btn-danger" onclick="deleteSong(${ch.id}, ${idx})" title="Delete">🗑️</button>
                        </div>
                    </div>
                `).join('')}
                ${ch.songs.length === 0 ? '<p style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.9rem">No songs yet</p>' : ''}
            </div>
        </div>
    `).join('');
}

function toggleChapterSongs(chapterId) {
    const el = document.getElementById(`songs-${chapterId}`);
    el.classList.toggle('open');
}

// ===== Chapter CRUD =====
function showAddChapter() {
    const name = prompt('Enter new chapter name:');
    if (!name || !name.trim()) return;
    // Prevent duplicate chapter names
    if (chapters.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
        toast('A chapter with this name already exists!', 'error');
        return;
    }
    const icon = prompt('Enter an emoji icon for this chapter:', '🎵') || '🎵';
    const maxId = chapters.reduce((max, c) => Math.max(max, c.id), 0);
    chapters.push({ id: maxId + 1, name: name.trim(), icon: icon.trim(), songs: [] });
    saveChaptersLocal();
    renderAdminChapters();
    updateStats();
    toast('Chapter added!', 'success');
}

function removeEmptyChapters() {
    const emptyCount = chapters.filter(c => c.songs.length === 0).length;
    if (emptyCount === 0) {
        toast('No empty chapters to remove', 'info');
        return;
    }
    if (!confirm(`Remove ${emptyCount} empty chapter(s)?`)) return;
    chapters = chapters.filter(c => c.songs.length > 0);
    saveChaptersLocal();
    renderAdminChapters();
    updateStats();
    toast(`${emptyCount} empty chapter(s) removed!`, 'success');
}

function showRenameChapter(chapterId) {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    const newName = prompt('Rename chapter:', chapter.name);
    if (newName === null || !newName.trim()) return;
    const newIcon = prompt('Change icon (emoji):', chapter.icon) || chapter.icon;
    chapter.name = newName.trim();
    chapter.icon = newIcon.trim();
    saveChaptersLocal();
    renderAdminChapters();
    toast('Chapter updated!', 'success');
}

function deleteChapter(chapterId) {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    if (!confirm(`Delete "${chapter.name}" and all its ${chapter.songs.length} songs?`)) return;
    chapters = chapters.filter(c => c.id !== chapterId);
    saveChaptersLocal();
    renderAdminChapters();
    updateStats();
    toast('Chapter deleted', 'success');
}

// ===== Song CRUD =====
function showAddSong(chapterId) {
    document.getElementById('songFormSection').style.display = 'block';
    document.getElementById('songFormTitle').textContent = '➕ Add New Song';
    document.getElementById('songId').value = '';
    document.getElementById('songChapterId').value = chapterId;
    document.getElementById('songTitle').value = '';
    document.getElementById('songAudio').value = '';
    document.getElementById('songImage').value = '';
    document.getElementById('songAudioUrl').value = '';
    document.getElementById('currentAudio').textContent = '';
    document.getElementById('currentImage').textContent = '';
    document.getElementById('songFormSection').scrollIntoView({ behavior: 'smooth' });
}

function showEditSong(chapterId, songIndex) {
    const chapter = chapters.find(c => c.id === chapterId);
    const song = chapter.songs[songIndex];

    document.getElementById('songFormSection').style.display = 'block';
    document.getElementById('songFormTitle').textContent = '✏️ Edit Song';
    document.getElementById('songId').value = songIndex;
    document.getElementById('songChapterId').value = chapterId;
    document.getElementById('songTitle').value = song.title;
    document.getElementById('songAudio').value = '';
    document.getElementById('songImage').value = '';
    document.getElementById('songAudioUrl').value = '';
    document.getElementById('currentAudio').textContent = song.audio ? '✅ Audio uploaded' : '';
    document.getElementById('currentImage').textContent = song.image ? '✅ Image uploaded' : '';
    document.getElementById('songFormSection').scrollIntoView({ behavior: 'smooth' });
}

function cancelSongForm() {
    document.getElementById('songFormSection').style.display = 'none';
}

// ===== URL Converter =====
function convertUrl(url) {
    if (!url) return url;

    // ✅ FIX: Google Drive → direct download link (no proxy needed)
    if (url.includes('drive.google.com')) {
        // Format: https://drive.google.com/file/d/FILE_ID/view
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
        // Format: https://drive.google.com/open?id=FILE_ID
        const params = new URLSearchParams(url.split('?')[1] || '');
        const id = params.get('id');
        if (id) {
            return `https://drive.google.com/uc?export=download&id=${id}`;
        }
    }

    // Dropbox: dl=0 → dl=1 (direct download)
    if (url.includes('dropbox.com')) {
        return url.replace('dl=0', 'dl=1').replace('?dl=0', '?dl=1');
    }

    return url;
}

async function saveSong(e) {
    e.preventDefault();

    const songIndex = document.getElementById('songId').value;
    const chapterId = parseInt(document.getElementById('songChapterId').value);
    const title = document.getElementById('songTitle').value.trim();
    const audioFile = document.getElementById('songAudio').files[0];
    const imageFile = document.getElementById('songImage').files[0];
    const audioUrlInput = document.getElementById('songAudioUrl').value.trim();

    if (!title) {
        toast('Please enter a song title', 'error');
        return;
    }

    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) { toast('Chapter not found', 'error'); return; }

    let songData;
    if (songIndex !== '') {
        songData = { ...chapter.songs[parseInt(songIndex)] };
        songData.title = title;
    } else {
        songData = { id: Date.now().toString(), title: title, audio: '', image: '' };
    }

    // Show saving state
    const saveBtn = document.querySelector('#songForm button[type="submit"]');
    const origText = saveBtn.textContent;
    saveBtn.textContent = '⏳ Uploading...';
    saveBtn.disabled = true;

    try {
        // Upload audio file (pass old URL to delete duplicates)
        if (audioFile) {
            const oldAudioUrl = songData.audio || '';
            const audioResult = await uploadFile(audioFile, oldAudioUrl);
            songData.audio = audioResult.url;
        } else if (audioUrlInput) {
            songData.audio = convertUrl(audioUrlInput);
        }

        // Upload image file (pass old URL to delete duplicates)
        if (imageFile) {
            const oldImageUrl = songData.image || '';
            const imgResult = await uploadFile(imageFile, oldImageUrl);
            songData.image = imgResult.url;
        }

        if (songIndex !== '') {
            chapter.songs[parseInt(songIndex)] = songData;
        } else {
            chapter.songs.push(songData);
        }

        saveChaptersLocal();
        renderAdminChapters();
        updateStats();
        cancelSongForm();
        toast('Song saved!', 'success');

        const songsList = document.getElementById(`songs-${chapterId}`);
        if (songsList) songsList.classList.add('open');

    } catch (err) {
        console.error('Save error:', err);
        toast('Upload failed: ' + err.message, 'error');
    } finally {
        saveBtn.textContent = origText;
        saveBtn.disabled = false;
    }
}

// ===== GitHub Upload Config =====
const GITHUB_CONFIG = {
    token: localStorage.getItem('gh_token') || '',
    owner: localStorage.getItem('gh_repo') ? localStorage.getItem('gh_repo').split('/')[0] : 'galalemad75-creator',
    repo: localStorage.getItem('gh_repo') ? localStorage.getItem('gh_repo').split('/')[1] : 'sleep-songs-files',
    branch: 'main'
};

// Delete old file from GitHub (by download URL)
async function deleteOldGithubFile(downloadUrl) {
    if (!GITHUB_CONFIG.token || !downloadUrl) return;
    try {
        // Extract path from download URL: https://raw.githubusercontent.com/owner/repo/branch/path
        const parts = downloadUrl.split('/raw.githubusercontent.com/');
        if (parts.length < 2) return;
        const pathParts = parts[1].split('/');
        // skip owner, repo, branch → get the file path
        const filePath = pathParts.slice(3).join('/');
        if (!filePath.startsWith('audio/') && !filePath.startsWith('images/')) return;
        // Get file SHA
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`, {
            headers: { "Authorization": `token ${GITHUB_CONFIG.token}`, "Accept": "application/vnd.github.v3+json" }
        });
        if (getRes.ok) {
            const fileData = await getRes.json();
            await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`, {
                method: "DELETE",
                headers: { "Authorization": `token ${GITHUB_CONFIG.token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
                body: JSON.stringify({ message: `Remove old: ${filePath}`, sha: fileData.sha, branch: GITHUB_CONFIG.branch })
            });
            console.log('[Upload] Deleted old file:', filePath);
        }
    } catch(e) { console.warn('[Upload] Could not delete old file:', e.message); }
}

async function uploadFile(file, oldUrl) {
    // Try GitHub first if token exists
    if (GITHUB_CONFIG.token) {
        try {
            const folder = file.type.startsWith("audio/") ? "audio" : "images";
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            // Use consistent filename: folder/safename (no timestamp) to avoid duplicates
            // Add short hash to handle different files with same name
            const fileHash = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const arr = new Uint8Array(reader.result);
                    let hash = 0;
                    for (let i = 0; i < Math.min(arr.length, 1024); i++) hash = ((hash << 5) - hash + arr[i]) | 0;
                    resolve(Math.abs(hash).toString(36).slice(0, 6));
                };
                reader.readAsArrayBuffer(file.slice(0, 1024));
            });
            const fileName = `${folder}/${fileHash}_${safeName}`;

            // Delete old file if replacing
            if (oldUrl) await deleteOldGithubFile(oldUrl);

            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const res = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${fileName}`, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${GITHUB_CONFIG.token}`,
                    "Accept": "application/vnd.github.v3+json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: `Upload ${fileName}`,
                    content: base64,
                    branch: GITHUB_CONFIG.branch
                })
            });
            if (res.ok) {
                const data = await res.json();
                console.log('[Upload] ✅ Uploaded:', fileName);
                return { url: data.content.download_url };
            }
        } catch(e) { console.warn("GitHub upload failed, using local storage", e); }
    }
    // Fallback: store as base64 data URL in localStorage
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            // Store in localStorage for persistence
            const localAudio = JSON.parse(localStorage.getItem("localAudio") || "{}");
            const key = "audio_" + Date.now();
            localAudio[key] = dataUrl;
            try {
                localStorage.setItem("localAudio", JSON.stringify(localAudio));
                resolve({ url: dataUrl });
            } catch(e) {
                // localStorage full, return URL anyway for this session
                resolve({ url: dataUrl });
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function deleteSong(chapterId, songIndex) {
    if (!confirm('Are you sure you want to delete this song?')) return;
    
    const chapter = chapters.find(c => c.id === chapterId);
    
    try {
        chapter.songs.splice(songIndex, 1);
        await API.put(`/chapters/${chapterId}`, chapter);
    } catch (err) {
        chapter.songs.splice(songIndex, 1);
        saveChaptersLocal();
    }
    
    renderAdminChapters();
    updateStats();
    toast('Song deleted', 'success');
}

// ===== GitHub Settings =====
function showGithubSettings() {
    const section = document.getElementById('githubSettingsSection');
    section.style.display = 'block';
    // Load saved values
    const savedToken = localStorage.getItem('gh_token') || '';
    const savedRepo = localStorage.getItem('gh_repo') || 'galalemad75-creator/sleep-songs-files';
    document.getElementById('githubTokenInput').value = savedToken;
    document.getElementById('githubRepoInput').value = savedRepo;
    if (savedToken) {
        document.getElementById('githubStatus').innerHTML = '<span style="color:#4caf50">✅ Token configured</span>';
    }
    section.scrollIntoView({ behavior: 'smooth' });
}

function hideGithubSettings() {
    document.getElementById('githubSettingsSection').style.display = 'none';
}

async function saveGithubSettings() {
    const token = document.getElementById('githubTokenInput').value.trim();
    const repoFull = document.getElementById('githubRepoInput').value.trim();
    const statusEl = document.getElementById('githubStatus');

    if (!token) { toast('Please enter a GitHub token', 'error'); return; }
    if (!repoFull.includes('/')) { toast('Repo format: owner/repo-name', 'error'); return; }

    const [owner, repo] = repoFull.split('/');
    statusEl.innerHTML = '<span style="color:#ffa726">⏳ Verifying...</span>';

    try {
        // Verify token and repo access
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!res.ok) {
            throw new Error(res.status === 404 ? 'Repo not found or token has no access' : 'Invalid token');
        }

        // Save settings
        localStorage.setItem('gh_token', token);
        localStorage.setItem('gh_repo', repoFull);
        GITHUB_CONFIG.token = token;
        GITHUB_CONFIG.owner = owner;
        GITHUB_CONFIG.repo = repo;

        statusEl.innerHTML = '<span style="color:#4caf50">✅ Connected! You can now upload songs directly.</span>';
        toast('GitHub settings saved!', 'success');

        // Create folders if they don't exist
        await ensureGithubFolders(token, owner, repo);

    } catch (err) {
        statusEl.innerHTML = `<span style="color:#f44336">❌ ${err.message}</span>`;
    }
}

async function ensureGithubFolders(token, owner, repo) {
    const folders = ['audio', 'images'];
    for (const folder of folders) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${folder}/.gitkeep`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (res.status === 404) {
                // Create the folder by adding a .gitkeep file
                await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${folder}/.gitkeep`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Create ${folder} folder`,
                        content: btoa('# keep this folder'),
                        branch: 'main'
                    })
                });
            }
        } catch (e) { /* ignore */ }
    }
}

// ===== Password Management =====
function showChangePassword() {
    document.getElementById('changePasswordSection').style.display = 'block';
    document.getElementById('changePasswordSection').scrollIntoView({ behavior: 'smooth' });
}

function hideChangePassword() {
    document.getElementById('changePasswordSection').style.display = 'none';
}

async function changePassword(e) {
    e.preventDefault();
    
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm_ = document.getElementById('confirmNewPassword').value;
    
    if (newPass !== confirm_) {
        toast('Passwords do not match', 'error');
        return;
    }
    
    if (newPass.length < 6) {
        toast('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        await API.post('/auth/change-password', {
            currentPassword: current,
            newPassword: newPass
        });
    } catch (err) {
        // fallback to local
    }
    
    const currentHash = localStorage.getItem('admin_password_hash');
    const inputHash = await hashPassword(current);
    
    if (currentHash && inputHash !== currentHash) {
        toast('Current password is incorrect', 'error');
        return;
    }
    
    const newHash = await hashPassword(newPass);
    localStorage.setItem('admin_password_hash', newHash);
    localStorage.setItem('admin_token', 'local_' + newHash);
    
    hideChangePassword();
    toast('Password changed successfully!', 'success');
}

// ===== Utility: File to Base64 =====
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== Toast Notification =====
function toast(message, type = '') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show ' + type;
    setTimeout(() => el.className = 'toast', 3000);
}

// ===== Ad Management =====
const AD_POSITIONS = [
    { id: 'Header', container: 'adContainerHeader' },
    { id: 'BeforeChapters', container: 'adContainerBeforeChapters' },
    { id: 'Middle', container: 'adContainerMiddle' },
    { id: 'AfterChapters', container: 'adContainerAfterChapters' },
    { id: 'Footer', container: 'adContainerFooter' },
    { id: 'Global', container: null }
];

function loadAdSettings() {
    const stored = localStorage.getItem('ad_settings');
    if (!stored) return;
    try {
        const settings = JSON.parse(stored);
        AD_POSITIONS.forEach(pos => {
            const codeEl = document.getElementById(`ad${pos.id}Code`);
            const enabledEl = document.getElementById(`ad${pos.id}Enabled`);
            if (codeEl && settings[pos.id]) {
                codeEl.value = settings[pos.id].code || '';
            }
            if (enabledEl && settings[pos.id]) {
                enabledEl.checked = settings[pos.id].enabled || false;
            }
        });
    } catch (e) {
        console.warn('Failed to load ad settings:', e);
    }
}

function saveAdSettings() {
    const settings = {};
    AD_POSITIONS.forEach(pos => {
        const codeEl = document.getElementById(`ad${pos.id}Code`);
        const enabledEl = document.getElementById(`ad${pos.id}Enabled`);
        settings[pos.id] = {
            code: codeEl ? codeEl.value : '',
            enabled: enabledEl ? enabledEl.checked : false
        };
    });
    localStorage.setItem('ad_settings', JSON.stringify(settings));
    injectAds(settings);
}

function getAdSettings() {
    const stored = localStorage.getItem('ad_settings');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (e) {
        return null;
    }
}

function injectAds(settings) {
    if (!settings) settings = getAdSettings();
    if (!settings) return;

    // Clear existing ad containers
    AD_POSITIONS.forEach(pos => {
        if (pos.container) {
            const el = document.getElementById(pos.container);
            if (el) {
                el.innerHTML = '';
                el.style.display = 'none';
            }
        }
    });

    // Remove previously injected global scripts
    document.querySelectorAll('.ad-global-script').forEach(el => el.remove());

    // Inject ads into containers
    AD_POSITIONS.forEach(pos => {
        const data = settings[pos.id];
        if (!data || !data.enabled || !data.code.trim()) return;

        if (pos.id === 'Global') {
            // Inject into <head>
            injectGlobalScripts(data.code);
        } else {
            const container = document.getElementById(pos.container);
            if (container) {
                container.innerHTML = data.code;
                container.style.display = 'block';
                // Execute any scripts in the ad code
                executeScriptsInElement(container);
            }
        }
    });
}

function injectGlobalScripts(code) {
    const temp = document.createElement('div');
    temp.innerHTML = code;
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(script => {
        const newScript = document.createElement('script');
        newScript.className = 'ad-global-script';
        if (script.src) {
            newScript.src = script.src;
            newScript.async = script.async;
            newScript.crossOrigin = script.crossOrigin;
        } else {
            newScript.textContent = script.textContent;
        }
        // Copy attributes
        Array.from(script.attributes).forEach(attr => {
            if (attr.name !== 'src' && attr.name !== 'type') {
                newScript.setAttribute(attr.name, attr.value);
            }
        });
        document.head.appendChild(newScript);
    });
    // Also handle non-script elements (like meta tags, link tags)
    temp.querySelectorAll('meta, link').forEach(el => {
        const clone = el.cloneNode(true);
        clone.className = (clone.className + ' ad-global-script').trim();
        document.head.appendChild(clone);
    });
}

function executeScriptsInElement(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
            newScript.src = script.src;
            newScript.async = script.async;
        } else {
            newScript.textContent = script.textContent;
        }
        Array.from(script.attributes).forEach(attr => {
            if (attr.name !== 'src') {
                newScript.setAttribute(attr.name, attr.value);
            }
        });
        script.parentNode.replaceChild(newScript, script);
    });
}

function clearAllAds() {
    if (!confirm('Are you sure you want to clear all ad codes?')) return;
    AD_POSITIONS.forEach(pos => {
        const codeEl = document.getElementById(`ad${pos.id}Code`);
        const enabledEl = document.getElementById(`ad${pos.id}Enabled`);
        if (codeEl) codeEl.value = '';
        if (enabledEl) enabledEl.checked = false;
        if (pos.container) {
            const el = document.getElementById(pos.container);
            if (el) {
                el.innerHTML = '';
                el.style.display = 'none';
            }
        }
    });
    document.querySelectorAll('.ad-global-script').forEach(el => el.remove());
    localStorage.removeItem('ad_settings');
    toast('All ads cleared', 'success');
}

function previewAds() {
    saveAdSettings();
    showHome();
    toast('Ads injected — preview the site', 'success');
}

// ===== Middle Ad in Chapters Grid =====
function insertMiddleAd() {
    const settings = getAdSettings();
    if (!settings || !settings.Middle || !settings.Middle.enabled || !settings.Middle.code.trim()) return;

    const grid = document.getElementById('chaptersGrid');
    if (!grid) return;

    // Remove existing middle ad
    const existing = grid.querySelector('.ad-middle-wrapper');
    if (existing) existing.remove();

    const cards = grid.querySelectorAll('.chapter-card');
    if (cards.length < 6) return;

    const midIndex = Math.floor(cards.length / 2);
    const adWrapper = document.createElement('div');
    adWrapper.className = 'ad-middle-wrapper';
    adWrapper.style.cssText = 'grid-column: 1 / -1; padding: 10px 0;';
    adWrapper.innerHTML = `<div id="adContainerMiddle" class="ad-container">${settings.Middle.code}</div>`;

    cards[midIndex].parentNode.insertBefore(adWrapper, cards[midIndex]);
    executeScriptsInElement(adWrapper);
}

// ===== Sound Settings =====
function showSoundSettings() {
    // Nuke ALL injected content by completely rebuilding the page
    var page = document.getElementById('soundSettingsPage');
    var inner = page.querySelector('.page-inner') || page;
    inner.innerHTML = `
        <h1 class="page-title">🔊 Sound Settings</h1>
        <div class="page-body">
            <div class="sound-settings-container">
                <button class="btn btn-primary btn-block" onclick="document.getElementById('audioFileInput').click()">
                    📤 Upload audio files
                </button>
                <input type="file" id="audioFileInput" accept="audio/*" multiple style="display:none" onchange="handleAudioUpload(event)">
                <div class="audio-list-box">
                    <div class="audio-list-header">Audio files list will appear here</div>
                    <div id="audioFilesList" class="audio-files-list">
                        <div class="empty-list-msg">No audio files uploaded yet</div>
                    </div>
                </div>
                <button class="btn btn-danger btn-block" onclick="clearAllAudioData()">
                    🗑️ Clear All Data
                </button>
            </div>
        </div>
    `;
    hideAllPages();
    page.style.display = 'block';
    document.getElementById('nav-sound').classList.add('active');
    renderAudioFilesList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAudioFilesList() {
    const container = document.getElementById('audioFilesList');
    const audioFiles = JSON.parse(localStorage.getItem('uploadedAudioFiles') || '[]');
    
    if (audioFiles.length === 0) {
        container.innerHTML = '<div class="empty-list-msg">No audio files uploaded yet</div>';
        return;
    }
    
    container.innerHTML = audioFiles.map((file, idx) => `
        <div class="audio-file-item">
            <span class="audio-file-name">🎵 ${file.name}</span>
            <button class="btn btn-sm btn-danger" onclick="removeAudioFile(${idx})">✕</button>
        </div>
    `).join('');
}

function handleAudioUpload(event) {
    const files = event.target.files;
    if (!files.length) return;
    
    const audioFiles = JSON.parse(localStorage.getItem('uploadedAudioFiles') || '[]');
    
    for (const file of files) {
        audioFiles.push({
            name: file.name,
            size: file.size,
            uploadedAt: Date.now()
        });
    }
    
    localStorage.setItem('uploadedAudioFiles', JSON.stringify(audioFiles));
    renderAudioFilesList();
    showToast('✅ Audio files added!');
    event.target.value = '';
}

function removeAudioFile(index) {
    const audioFiles = JSON.parse(localStorage.getItem('uploadedAudioFiles') || '[]');
    audioFiles.splice(index, 1);
    localStorage.setItem('uploadedAudioFiles', JSON.stringify(audioFiles));
    renderAudioFilesList();
}

function clearAllAudioData() {
    if (confirm('Are you sure you want to clear all audio data?')) {
        localStorage.removeItem('uploadedAudioFiles');
        renderAudioFilesList();
        showToast('🗑️ All audio data cleared');
    }
}

// ===== Missing Playback Functions =====
function playAllFromChapter() {
    if (!currentChapter || currentChapter.songs.length === 0) return;
    currentSongIndex = 0;
    playSong(0);
    toast('Playing all songs', 'success');
}

function shuffleAllFromChapter() {
    if (!currentChapter || currentChapter.songs.length === 0) return;
    currentSongIndex = Math.floor(Math.random() * currentChapter.songs.length);
    playSong(currentSongIndex);
    toast('Shuffle mode ON', 'success');
}

function addAllFromChapter() {
    if (!currentChapter) return;
    toast(currentChapter.songs.length + ' songs added to queue', 'success');
}

function showToast(msg) {
    toast(msg, 'info');
}

// ===== Anti-Injection Observer =====
// Watches for and removes any injected "Quick Sound Control" dialogs
(function() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    const text = node.textContent || '';
                    const cls = (node.className || '').toString();
                    const id = node.id || '';
                    // Remove Quick Sound Control dialog
                    if (text.includes('Quick Sound') || text.includes('🎧') || 
                        cls.includes('quick-sound') || cls.includes('QuickSound') ||
                        id.includes('quick-sound') || id.includes('QuickSound')) {
                        console.warn('[Anti-Injection] Removed injected element:', node);
                        node.remove();
                    }
                    // Remove floating fixed-position elements that aren't ours
                    if (node.style && getComputedStyle(node).position === 'fixed') {
                        const knownIds = ['navbar', 'toast', 'cookieBanner', 'stars', 'nowPlaying'];
                        if (!knownIds.includes(node.id) && !node.closest('.navbar')) {
                            console.warn('[Anti-Injection] Removed unknown fixed element:', node);
                            node.remove();
                        }
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[Anti-Injection] Observer active');
})();

// ===== Periodic Cleanup =====
setInterval(function() {
    // Remove any element with Quick Sound Control text
    document.querySelectorAll('*').forEach(function(el) {
        var text = el.textContent || '';
        var cls = (el.className || '').toString().toLowerCase();
        if ((text.includes('Quick Sound') || text.includes('🎧')) && el.children.length < 10) {
            console.warn('[Cleanup] Removing:', el.tagName, el.className);
            el.remove();
        }
    });
}, 2000);
// ===== Export Data for GitHub =====
function exportDataJson() {
    const data = {
        version: 1,
        chapters: chapters.map(ch => ({
            id: ch.id,
            name: ch.name,
            icon: ch.icon,
            songs: (ch.songs || []).map(sg => ({
                id: sg.id || ('song_' + ch.id + '_' + Date.now()),
                title: sg.title,
                audio: sg.audio || '',
                image: sg.image || ''
            })),
            ...(ch.isMusic ? { isMusic: true } : {})
        }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('data.json downloaded! Upload it to your GitHub repo.', 'success');
}
