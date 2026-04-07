/**
 * ============================================================
 * SLEEP SONGS — SUPABASE SYNC (v2.0 FIXED)
 * ============================================================
 * 
 * Fixes from v1.0:
 * 1. ✅ Restored base64 localStorage fallback when GitHub not configured
 * 2. ✅ Only clean base64 from localStorage when song has valid external URL
 * 3. ✅ Fixed convertUrl for Google Drive (direct download link)
 * 4. ✅ Better error messages for upload failures
 * 5. ✅ GITHUB_CONFIG synced with localStorage token
 * 6. ✅ loadChapters always loads chapters (even if empty)
 * 
 * ============================================================
 */
(async function () {
  'use strict';

  // ===== CONFIG =====
  const SB_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
  const SB_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
  const CLD_NAME = typeof CLOUDINARY_CLOUD_NAME !== 'undefined' ? CLOUDINARY_CLOUD_NAME : '';
  const CLD_PRESET = typeof CLOUDINARY_UPLOAD_PRESET !== 'undefined' ? CLOUDINARY_UPLOAD_PRESET : '';

  let supa = null;
  let supaReady = false;

  // ===== 1. INIT SUPABASE =====
  if (SB_URL && SB_KEY) {
    try {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      document.head.appendChild(s);
      await new Promise((r, j) => { s.onload = r; s.onerror = j; });
      supa = window.supabase.createClient(SB_URL, SB_KEY);
      await supa.from('chapters').select('id').limit(1);
      supaReady = true;
      console.log('[DB] ✅ Supabase connected');
    } catch (e) {
      console.warn('[DB] ⚠️ Supabase offline:', e.message);
    }
  }

  // ===== 2. DB HELPERS =====
  const DB = {
    async loadChapters() {
      const { data, error } = await supa.from('chapters').select('*').order('id');
      if (error) throw error;
      return data.map(r => ({
        id: r.id, name: r.name, icon: r.icon,
        songs: Array.isArray(r.songs) ? r.songs : JSON.parse(r.songs || '[]')
      }));
    },
    async saveChapter(ch) {
      const { error } = await supa.from('chapters').upsert({
        id: ch.id, name: ch.name, icon: ch.icon || '📚', songs: ch.songs,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw error;
    },
    async getSetting(key) {
      const { data } = await supa.from('settings').select('value').eq('key', key).single();
      return data ? data.value : null;
    },
    async setSetting(key, value) {
      await supa.from('settings').upsert({
        key, value, updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    }
  };

  // ===== 3. FILE UPLOAD =====
  function getGH() {
    return {
      token: localStorage.getItem('gh_token') || '',
      repo: localStorage.getItem('gh_repo') || '',
      owner: (localStorage.getItem('gh_repo') || '/').split('/')[0],
      name: (localStorage.getItem('gh_repo') || '/').split('/')[1]
    };
  }

  async function uploadToGitHub(file, oldUrl) {
    const gh = getGH();
    if (!gh.token || !gh.owner || !gh.name) {
      throw new Error('NO_GITHUB_TOKEN');
    }

    // Delete old file if replacing
    if (oldUrl && oldUrl.includes('raw.githubusercontent.com')) {
      try {
        const parts = oldUrl.split('/raw.githubusercontent.com/');
        if (parts.length >= 2) {
          const filePath = parts[1].split('/').slice(3).join('/');
          const gRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.name}/contents/${filePath}`, {
            headers: { Authorization: `token ${gh.token}`, Accept: 'application/vnd.github.v3+json' }
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            await fetch(`https://api.github.com/repos/${gh.owner}/${gh.name}/contents/${filePath}`, {
              method: 'DELETE',
              headers: { Authorization: `token ${gh.token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: `Remove: ${filePath}`, sha: gData.sha, branch: 'main' })
            });
          }
        }
      } catch {}
    }

    const folder = file.type.startsWith('audio/') ? 'audio' : 'images';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

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

    const resp = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.name}/contents/${fileName}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${gh.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `Upload ${fileName}`, content: base64, branch: 'main' })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub upload failed: ${resp.status}`);
    }

    const data = await resp.json();
    console.log('[Upload] ✅ GitHub:', data.content.download_url);
    return { url: data.content.download_url };
  }

  async function uploadToCloudinary(file) {
    if (!CLD_NAME || !CLD_PRESET) throw new Error('Cloudinary not configured');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLD_NAME}/auto/upload`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Cloudinary preset not whitelisted for unsigned uploads');
    const data = await res.json();
    return { url: data.secure_url };
  }

  // ✅ FIX: base64 fallback RESTORED
  function uploadToLocal(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        console.log('[Upload] ✅ Saved to localStorage (base64)');
        resolve({ url: dataUrl });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ✅ FIX: Upload chain: Cloudinary → GitHub → base64 fallback
  try { delete window.uploadFile; } catch {}
  window.uploadFile = async function (file, oldUrl) {
    // Try Cloudinary first (if configured)
    if (CLD_NAME && CLD_PRESET) {
      try { return await uploadToCloudinary(file); } catch (e) {
        console.warn('[Upload] Cloudinary:', e.message);
      }
    }
    // Try GitHub (if token configured)
    try {
      return await uploadToGitHub(file, oldUrl);
    } catch (e) {
      console.warn('[Upload] GitHub:', e.message);
      // ✅ FIX: Fallback to base64 localStorage instead of throwing
      if (e.message === 'NO_GITHUB_TOKEN') {
        console.log('[Upload] No GitHub token — falling back to localStorage');
      }
      return await uploadToLocal(file);
    }
  };

  // ✅ FIX: Sync GITHUB_CONFIG with localStorage
  if (typeof GITHUB_CONFIG !== 'undefined') {
    const freshToken = localStorage.getItem('gh_token') || '';
    const freshRepo = localStorage.getItem('gh_repo') || '';
    if (freshToken) GITHUB_CONFIG.token = freshToken;
    if (freshRepo) {
      GITHUB_CONFIG.owner = freshRepo.split('/')[0];
      GITHUB_CONFIG.repo = freshRepo.split('/')[1];
    }
  }
  console.log('[DB] uploadFile overridden ✅');

  // ===== 4. FIX convertUrl for Google Drive =====
  const origConvertUrl = window.convertUrl;
  window.convertUrl = function (url) {
    if (!url) return url;

    // ✅ FIX: Google Drive → proper direct download link
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

    // Dropbox: dl=0 → dl=1
    if (url.includes('dropbox.com')) {
      return url.replace('dl=0', 'dl=1').replace('?dl=0', '?dl=1');
    }

    return url;
  };

  // ===== 5. LOAD CHAPTERS — ✅ FIX: always load even if empty =====
  window.loadChapters = async function () {
    let loaded = false;

    // Try Supabase first
    if (supaReady) {
      try {
        const sbChapters = await DB.loadChapters();
        if (sbChapters.length > 0) {
          // ✅ FIX: accept chapters even if all songs are empty
          window.chapters = sbChapters;
          localStorage.setItem('chapters', JSON.stringify(window.chapters));
          loaded = true;
          console.log('[DB] ✅ Loaded from Supabase (' + sbChapters.length + ' chapters)');
        }
      } catch (e) { console.warn('[DB] Load:', e.message); }
    }

    // Fallback: localStorage
    if (!loaded) {
      const stored = localStorage.getItem('chapters');
      if (stored) {
        try {
          window.chapters = JSON.parse(stored);
          loaded = window.chapters.length > 0;
        } catch {}
      }
    }

    // Final fallback: defaults
    if (!loaded && typeof DEFAULT_CHAPTERS !== 'undefined') {
      window.chapters = JSON.parse(JSON.stringify(DEFAULT_CHAPTERS));
      if (typeof DEFAULT_SONGS !== 'undefined') {
        window.chapters.forEach(ch => {
          if (DEFAULT_SONGS[ch.id] && ch.songs.length === 0) {
            ch.songs = JSON.parse(JSON.stringify(DEFAULT_SONGS[ch.id]));
          }
        });
      }
      localStorage.setItem('chapters', JSON.stringify(window.chapters));
      // Sync defaults to Supabase
      if (supaReady) {
        for (const ch of window.chapters) {
          try { await DB.saveChapter(ch); } catch {}
        }
        console.log('[DB] ✅ Defaults synced');
      }
    }

    if (typeof renderChapters === 'function') renderChapters();
    if (typeof updateStats === 'function') updateStats();
  };

  // ===== 6. SAVE CHAPTERS =====
  window.saveChaptersLocal = function () {
    localStorage.setItem('chapters', JSON.stringify(window.chapters));
    if (supaReady && window.chapters) {
      for (const ch of window.chapters) {
        DB.saveChapter(ch).catch(() => {});
      }
    }
  };

  // ===== 7. SETTINGS SYNC =====
  window.saveAdSettings = async function () {
    const s = {};
    ['Header', 'BeforeChapters', 'Middle', 'AfterChapters', 'Footer', 'Global'].forEach(pos => {
      const key = pos === 'Header' ? 'header' : pos === 'BeforeChapters' ? 'beforeChapters' : pos.toLowerCase();
      s[key] = {
        enabled: document.getElementById('ad' + pos + 'Enabled')?.checked,
        code: document.getElementById('ad' + pos + 'Code')?.value || ''
      };
    });
    localStorage.setItem('ad_settings', JSON.stringify(s));
    if (supaReady) try { await DB.setSetting('ad_settings', s); } catch {}
  };

  window.saveContactInfo = async function () {
    const info = {};
    ['email', 'youtube', 'spotify', 'instagram', 'twitter', 'facebook', 'tiktok', 'website', 'message'].forEach(k => {
      info[k] = document.getElementById('contact' + k.charAt(0).toUpperCase() + k.slice(1))?.value || '';
    });
    localStorage.setItem('contact_info', JSON.stringify(info));
    if (supaReady) try { await DB.setSetting('contact_info', info); } catch {}
    if (typeof toast === 'function') toast('Saved!', 'success');
  };

  window.savePlayCounts = function () {
    localStorage.setItem('playCounts', JSON.stringify(window.playCounts || {}));
    if (supaReady) DB.setSetting('play_counts', window.playCounts || {}).catch(() => {});
  };
  window.saveFavorites = function () {
    localStorage.setItem('favorites', JSON.stringify(window.favorites || {}));
    if (supaReady) DB.setSetting('favorites', window.favorites || {}).catch(() => {});
  };

  // ===== 8. ✅ FIX: Only clean base64 if song has a valid external URL =====
  try {
    const stored = localStorage.getItem('chapters');
    if (stored) {
      const chs = JSON.parse(stored);
      let clean = false;
      chs.forEach(ch => (ch.songs || []).forEach(sg => {
        // ✅ FIX: Only clean base64 audio if there's also a valid HTTP URL
        if (sg.audio && sg.audio.startsWith('data:')) {
          // Check if there's an alternative valid URL — if not, KEEP the base64
          const hasValidUrl = sg.audioUrl && sg.audioUrl.startsWith('http');
          if (hasValidUrl) {
            sg.audio = sg.audioUrl;
            clean = true;
          }
          // else: keep base64 — it's the only source we have!
        }
        if (sg.image && sg.image.startsWith('data:')) {
          const hasValidUrl = sg.imageUrl && sg.imageUrl.startsWith('http');
          if (hasValidUrl) {
            sg.image = sg.imageUrl;
            clean = true;
          }
        }
      }));
      if (clean) {
        localStorage.setItem('chapters', JSON.stringify(chs));
        console.log('[DB] 🧹 Cleaned stale base64 (had valid URLs)');
      }
    }
    // ✅ FIX: Don't remove localAudio — it may contain the only copy of uploaded files
    // localStorage.removeItem('localAudio'); // REMOVED
  } catch {}

  // ===== 9. LOAD SETTINGS FROM SUPABASE =====
  if (supaReady) {
    try {
      const ads = await DB.getSetting('ad_settings');
      if (ads) localStorage.setItem('ad_settings', JSON.stringify(ads));
      const contact = await DB.getSetting('contact_info');
      if (contact) localStorage.setItem('contact_info', JSON.stringify(contact));
    } catch {}
  }

  // ===== EXPORTS =====
  window.DB = DB;
  window.SUPABASE_SYNC = supaReady;
  console.log('[DB] 🚀 Ready — Supabase: ' + (supaReady ? 'ON' : 'OFF') + ' | Upload: GitHub → base64 fallback');
})();
