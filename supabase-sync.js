/**
 * Sleep Songs — Final Data Layer
 * 
 * Architecture:
 *   Cloudinary  → file uploads (audio + images)
 *   Supabase    → data storage (chapters, settings, favorites, playCounts)
 *   localStorage → fast cache only (not source of truth)
 *   GitHub      → optional backup for files
 *
 * This script replaces ALL localStorage-first logic with Supabase-first.
 */
(async function () {
  'use strict';

  // ===== Config =====
  const SB_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
  const SB_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
  let supa = null;
  let supaReady = false;

  // ===== 1. Init Supabase =====
  if (SB_URL && SB_KEY) {
    try {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      document.head.appendChild(s);
      await new Promise((r, j) => { s.onload = r; s.onerror = j; });
      supa = window.supabase.createClient(SB_URL, SB_KEY);

      // Test connection
      await supa.from('chapters').select('id').limit(1);
      supaReady = true;
      console.log('[DB] ✅ Supabase connected');
    } catch (e) {
      console.warn('[DB] ⚠️ Supabase offline:', e.message);
    }
  }

  // ===== 2. DB Helpers =====
  const DB = {
    // --- Chapters ---
    async loadChapters() {
      if (!supaReady) throw new Error('Supabase not ready');
      const { data, error } = await supa
        .from('chapters')
        .select('*')
        .order('id');
      if (error) throw error;
      return data.map(row => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        songs: Array.isArray(row.songs) ? row.songs : JSON.parse(row.songs || '[]')
      }));
    },

    async saveChapter(chapter) {
      if (!supaReady) throw new Error('Supabase not ready');
      const { error } = await supa
        .from('chapters')
        .upsert({
          id: chapter.id,
          name: chapter.name,
          icon: chapter.icon || '📚',
          songs: chapter.songs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      if (error) throw error;
    },

    async deleteChapter(id) {
      if (!supaReady) throw new Error('Supabase not ready');
      const { error } = await supa.from('chapters').delete().eq('id', id);
      if (error) throw error;
    },

    async addChapter(id, name, icon) {
      if (!supaReady) throw new Error('Supabase not ready');
      const { error } = await supa
        .from('chapters')
        .insert({ id, name, icon: icon || '📚', songs: [] });
      if (error) throw error;
    },

    // --- Settings ---
    async getSetting(key) {
      if (!supaReady) return null;
      const { data, error } = await supa
        .from('settings')
        .select('value')
        .eq('key', key)
        .single();
      if (error) return null;
      return data.value;
    },

    async setSetting(key, value) {
      if (!supaReady) throw new Error('Supabase not ready');
      const { error } = await supa
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    }
  };

  // ===== 3. Cloudinary Upload =====
  async function uploadToCloudinary(file) {
    const cloudName = typeof CLOUDINARY_CLOUD_NAME !== 'undefined' ? CLOUDINARY_CLOUD_NAME : '';
    const preset = typeof CLOUDINARY_UPLOAD_PRESET !== 'undefined' ? CLOUDINARY_UPLOAD_PRESET : 'ml_default';
    if (!cloudName) throw new Error('Cloudinary not configured');

    const folder = file.type.startsWith('audio/') ? 'sleep-songs/audio' : 'sleep-songs/images';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    fd.append('folder', folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: fd
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Cloudinary: ${res.status}`);
    }
    const data = await res.json();
    console.log('[Upload] ✅ Cloudinary:', data.secure_url);
    return data.secure_url;
  }

  // ===== 4. GitHub Upload (fallback) =====
  async function uploadToGitHub(file) {
    const token = localStorage.getItem('gh_token');
    if (!token) throw new Error('No GitHub token');

    const repoStr = localStorage.getItem('gh_repo') || 'galalemad75-creator/sleep-songs-files';
    const [owner, repo] = repoStr.split('/');
    const folder = file.type.startsWith('audio/') ? 'audio' : 'images';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Quick hash for unique filename
    const hash = await new Promise(res => {
      const r = new FileReader();
      r.onload = () => {
        const a = new Uint8Array(r.result);
        let h = 0;
        for (let i = 0; i < Math.min(a.length, 1024); i++) h = ((h << 5) - h + a[i]) | 0;
        res(Math.abs(h).toString(36).slice(0, 6));
      };
      r.readAsArrayBuffer(file.slice(0, 1024));
    });

    const fileName = `${folder}/${hash}_${safeName}`;
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `Upload ${fileName}`, content: base64, branch: 'main' })
    });
    if (!resp.ok) throw new Error(`GitHub: ${resp.status}`);
    const data = await resp.json();
    console.log('[Upload] ✅ GitHub:', data.content.download_url);
    return data.content.download_url;
  }

  // ===== 5. Unified Upload (Cloudinary → GitHub → error) =====
  window.uploadFile = async function (file, oldUrl) {
    // Delete old GitHub file if replacing
    if (oldUrl && oldUrl.includes('raw.githubusercontent.com') && localStorage.getItem('gh_token')) {
      try {
        const parts = oldUrl.split('/raw.githubusercontent.com/');
        if (parts.length >= 2) {
          const pathParts = parts[1].split('/');
          const filePath = pathParts.slice(3).join('/');
          const repoStr = localStorage.getItem('gh_repo') || 'galalemad75-creator/sleep-songs-files';
          const [o, r] = repoStr.split('/');
          const token = localStorage.getItem('gh_token');
          const gRes = await fetch(`https://api.github.com/repos/${o}/${r}/contents/${filePath}`, {
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            await fetch(`https://api.github.com/repos/${o}/${r}/contents/${filePath}`, {
              method: 'DELETE',
              headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: `Remove: ${filePath}`, sha: gData.sha, branch: 'main' })
            });
          }
        }
      } catch (e) { console.warn('[Upload] Cleanup old file:', e.message); }
    }

    // Try Cloudinary first
    try {
      return { url: await uploadToCloudinary(file) };
    } catch (e) {
      console.warn('[Upload] Cloudinary failed, trying GitHub:', e.message);
    }

    // Fallback: GitHub
    try {
      return { url: await uploadToGitHub(file) };
    } catch (e) {
      console.error('[Upload] All uploads failed:', e.message);
      throw new Error('Upload failed. Check Cloudinary config or GitHub token.');
    }
  };

  // ===== 6. Smart loadChapters =====
  // Logic: Supabase has data? → use it. Otherwise → let original load defaults → sync up.
  window.loadChapters = async function () {
    let usedSupabase = false;

    if (supaReady) {
      try {
        const sbChapters = await DB.loadChapters();
        // Only use Supabase data if it has actual songs (not all empty)
        const hasSongs = sbChapters.some(ch => ch.songs && ch.songs.length > 0);
        if (hasSongs) {
          window.chapters = sbChapters;
          localStorage.setItem('chapters', JSON.stringify(window.chapters));
          usedSupabase = true;
          console.log('[DB] ✅ Loaded', sbChapters.length, 'chapters with songs from Supabase');
        } else {
          console.log('[DB] Supabase has empty chapters, loading defaults...');
        }
      } catch (e) {
        console.warn('[DB] Supabase load failed:', e.message);
      }
    }

    if (!usedSupabase) {
      // Original logic: try localStorage cache first, then defaults
      const stored = localStorage.getItem('chapters');
      if (stored) {
        try {
          window.chapters = JSON.parse(stored);
        } catch {
          window.chapters = [];
        }
      } else {
        window.chapters = [];
      }

      // If still empty, populate from DEFAULT_SONGS (defined in app.v4.js)
      if (window.chapters.length === 0 && typeof DEFAULT_CHAPTERS !== 'undefined') {
        window.chapters = JSON.parse(JSON.stringify(DEFAULT_CHAPTERS));
        if (typeof DEFAULT_SONGS !== 'undefined') {
          window.chapters.forEach(ch => {
            if (DEFAULT_SONGS[ch.id] && ch.songs.length === 0) {
              ch.songs = JSON.parse(JSON.stringify(DEFAULT_SONGS[ch.id]));
            }
          });
        }
      }

      localStorage.setItem('chapters', JSON.stringify(window.chapters));

      // Sync defaults to Supabase for next time
      if (supaReady && window.chapters.length > 0) {
        console.log('[DB] Syncing default chapters to Supabase...');
        for (const ch of window.chapters) {
          try { await DB.saveChapter(ch); } catch {}
        }
        console.log('[DB] ✅ Default chapters synced');
      }
    }

    if (typeof renderChapters === 'function') renderChapters();
    if (typeof updateStats === 'function') updateStats();
  };

  // ===== 7. Enhanced saveChaptersLocal (sync + async Supabase) =====
  window.saveChaptersLocal = function () {
    // Always save to localStorage immediately (sync - like original)
    localStorage.setItem('chapters', JSON.stringify(window.chapters));

    // Sync to Supabase in background (fire-and-forget)
    if (supaReady && window.chapters) {
      for (const ch of window.chapters) {
        DB.saveChapter(ch).catch(e => console.warn('[DB] Save chapter', ch.id, ':', e.message));
      }
      console.log('[DB] 📤 Syncing to Supabase...');
    }
  };

  // ===== 8. Override settings functions =====
  // Save ad settings
  const origSaveAd = window.saveAdSettings;
  window.saveAdSettings = async function () {
    const settings = {
      header: { enabled: document.getElementById('adHeaderEnabled')?.checked, code: document.getElementById('adHeaderCode')?.value || '' },
      beforeChapters: { enabled: document.getElementById('adBeforeChaptersEnabled')?.checked, code: document.getElementById('adBeforeChaptersCode')?.value || '' },
      middle: { enabled: document.getElementById('adMiddleEnabled')?.checked, code: document.getElementById('adMiddleCode')?.value || '' },
      afterChapters: { enabled: document.getElementById('adAfterChaptersEnabled')?.checked, code: document.getElementById('adAfterChaptersCode')?.value || '' },
      footer: { enabled: document.getElementById('adFooterEnabled')?.checked, code: document.getElementById('adFooterCode')?.value || '' },
      global: { enabled: document.getElementById('adGlobalEnabled')?.checked, code: document.getElementById('adGlobalCode')?.value || '' }
    };
    localStorage.setItem('ad_settings', JSON.stringify(settings));
    if (supaReady) {
      try { await DB.setSetting('ad_settings', settings); } catch (e) { console.warn('[DB] Ad save:', e.message); }
    }
  };

  // Save contact info
  const origSaveContact = window.saveContactInfo;
  window.saveContactInfo = async function () {
    const info = {
      email: document.getElementById('contactEmail')?.value || '',
      youtube: document.getElementById('contactYoutube')?.value || '',
      spotify: document.getElementById('contactSpotify')?.value || '',
      instagram: document.getElementById('contactInstagram')?.value || '',
      twitter: document.getElementById('contactTwitter')?.value || '',
      facebook: document.getElementById('contactFacebook')?.value || '',
      tiktok: document.getElementById('contactTiktok')?.value || '',
      website: document.getElementById('contactWebsite')?.value || '',
      message: document.getElementById('contactMessage')?.value || ''
    };
    localStorage.setItem('contact_info', JSON.stringify(info));
    if (supaReady) {
      try { await DB.setSetting('contact_info', info); } catch (e) { console.warn('[DB] Contact save:', e.message); }
    }
    if (typeof origSaveContact === 'function') origSaveContact();
    if (typeof toast === 'function') toast('Contact info saved!', 'success');
  };

  // Save play counts
  const origSavePlayCounts = window.savePlayCounts;
  window.savePlayCounts = async function () {
    localStorage.setItem('playCounts', JSON.stringify(window.playCounts || {}));
    if (supaReady) {
      try { await DB.setSetting('play_counts', window.playCounts || {}); } catch {}
    }
  };

  // Save favorites
  const origSaveFavorites = window.saveFavorites;
  window.saveFavorites = async function () {
    localStorage.setItem('favorites', JSON.stringify(window.favorites || {}));
    if (supaReady) {
      try { await DB.setSetting('favorites', window.favorites || {}); } catch {}
    }
  };

  // ===== 9. Load settings from Supabase =====
  async function loadSettingsFromDB() {
    if (!supaReady) return;
    try {
      const adSettings = await DB.getSetting('ad_settings');
      if (adSettings) {
        localStorage.setItem('ad_settings', JSON.stringify(adSettings));
        console.log('[DB] ✅ Loaded ad settings');
      }
      const contactInfo = await DB.getSetting('contact_info');
      if (contactInfo) {
        localStorage.setItem('contact_info', JSON.stringify(contactInfo));
        console.log('[DB] ✅ Loaded contact info');
      }
      const playCounts = await DB.getSetting('play_counts');
      if (playCounts) localStorage.setItem('playCounts', JSON.stringify(playCounts));
      const favorites = await DB.getSetting('favorites');
      if (favorites) localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch (e) {
      console.warn('[DB] Settings load:', e.message);
    }
  }

  // ===== 10. Cleanup old base64 data =====
  function cleanupLocalStorage() {
    try {
      const stored = localStorage.getItem('chapters');
      if (stored) {
        const chapters = JSON.parse(stored);
        let cleaned = false;
        chapters.forEach(ch => {
          (ch.songs || []).forEach(song => {
            if (song.audio && song.audio.startsWith('data:')) { song.audio = ''; cleaned = true; }
            if (song.image && song.image.startsWith('data:')) { song.image = ''; cleaned = true; }
          });
        });
        if (cleaned) {
          localStorage.setItem('chapters', JSON.stringify(chapters));
          console.log('[DB] 🧹 Cleaned base64 from chapters');
        }
      }
      localStorage.removeItem('localAudio');
    } catch (e) {
      console.warn('[DB] Cleanup error:', e.message);
    }
  }

  // ===== 11. Init =====
  cleanupLocalStorage();
  await loadSettingsFromDB();

  // Export DB helper globally
  window.DB = DB;
  window.SUPABASE_SYNC = supaReady;

  console.log('[DB] 🚀 Sleep Songs data layer ready (Supabase: ' + (supaReady ? 'ON' : 'OFF') + ', Cloudinary: ON)');
})();
