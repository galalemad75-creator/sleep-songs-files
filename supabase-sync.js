/**
 * ============================================================
 * SLEEP SONGS — COMPLETE FIX (v1.0)
 * ============================================================
 * 
 * This ONE file replaces supabase-sync.js and fixes everything:
 * - Supabase: Primary database for chapters, settings, favorites
 * - GitHub: File uploads (audio + images) — token saved once
 * - localStorage: Fast cache only (NEVER stores base64)
 * - Smart load: Loads from Supabase → localStorage → defaults
 * 
 * USAGE:
 * 1. Replace your supabase-sync.js with this file
 * 2. Run the SQL below in Supabase Dashboard → SQL Editor
 * 3. Set GitHub token ONCE in Admin Panel → GitHub Settings
 * 4. Hard refresh (Ctrl+Shift+R)
 * 
 * FOR NEW SITES: Just change the SUPABASE_URL and SUPABASE_ANON_KEY
 * in your config.js and run the same SQL.
 * 
 * SQL TO RUN IN SUPABASE (copy-paste this):
 * 
CREATE TABLE IF NOT EXISTS public.chapters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📚',
  songs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "r_ch" ON public.chapters;
DROP POLICY IF EXISTS "w_ch" ON public.chapters;
DROP POLICY IF EXISTS "r_st" ON public.settings;
DROP POLICY IF EXISTS "w_st" ON public.settings;
CREATE POLICY "r_ch" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "w_ch" ON public.chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "r_st" ON public.settings FOR SELECT USING (true);
CREATE POLICY "w_st" ON public.settings FOR ALL USING (true) WITH CHECK (true);
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

  // ===== 3. FILE UPLOAD — GitHub only (Cloudinary preset needs setup) =====
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
      throw new Error('GitHub not configured. Go to Admin → ⚙️ GitHub Settings → enter your Token and Repo.');
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

    // Hash for unique filename
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

  // Cloudinary upload (only if preset allows unsigned uploads)
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

  // Unified upload: Cloudinary → GitHub → error (NO base64 fallback)
  // CRITICAL: Must replace the function declaration in app.v4.js
  // Since 'async function uploadFile()' in app.v4.js creates a global var,
  // we delete it first then reassign
  try { delete window.uploadFile; } catch {}
  window.uploadFile = async function (file, oldUrl) {
    // Try Cloudinary first (if configured)
    if (CLD_NAME && CLD_PRESET) {
      try { return await uploadToCloudinary(file); } catch (e) {
        console.warn('[Upload] Cloudinary:', e.message);
      }
    }
    // GitHub (primary)
    return await uploadToGitHub(file, oldUrl);
  };
  // Also patch GITHUB_CONFIG so original code (if somehow still called) uses fresh token
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

  // ===== 4. SMART LOAD CHAPTERS =====
  window.loadChapters = async function () {
    let loaded = false;

    // Try Supabase first
    if (supaReady) {
      try {
        const sbChapters = await DB.loadChapters();
        if (sbChapters.some(ch => ch.songs && ch.songs.length > 0)) {
          window.chapters = sbChapters;
          localStorage.setItem('chapters', JSON.stringify(window.chapters));
          loaded = true;
          console.log('[DB] ✅ Loaded from Supabase');
        }
      } catch (e) { console.warn('[DB] Load:', e.message); }
    }

    // Fallback: localStorage → defaults
    if (!loaded) {
      const stored = localStorage.getItem('chapters');
      if (stored) {
        try {
          window.chapters = JSON.parse(stored);
          loaded = window.chapters.some(ch => ch.songs && ch.songs.length > 0);
        } catch {}
      }
    }

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

  // ===== 5. SAVE CHAPTERS (sync + async background Supabase) =====
  window.saveChaptersLocal = function () {
    localStorage.setItem('chapters', JSON.stringify(window.chapters));
    if (supaReady && window.chapters) {
      for (const ch of window.chapters) {
        DB.saveChapter(ch).catch(() => {});
      }
    }
  };

  // ===== 6. SETTINGS SYNC =====
  // Ad settings
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

  // Contact info
  window.saveContactInfo = async function () {
    const info = {};
    ['email', 'youtube', 'spotify', 'instagram', 'twitter', 'facebook', 'tiktok', 'website', 'message'].forEach(k => {
      info[k] = document.getElementById('contact' + k.charAt(0).toUpperCase() + k.slice(1))?.value || '';
    });
    localStorage.setItem('contact_info', JSON.stringify(info));
    if (supaReady) try { await DB.setSetting('contact_info', info); } catch {}
    if (typeof toast === 'function') toast('Saved!', 'success');
  };

  // Play counts + favorites
  window.savePlayCounts = function () {
    localStorage.setItem('playCounts', JSON.stringify(window.playCounts || {}));
    if (supaReady) DB.setSetting('play_counts', window.playCounts || {}).catch(() => {});
  };
  window.saveFavorites = function () {
    localStorage.setItem('favorites', JSON.stringify(window.favorites || {}));
    if (supaReady) DB.setSetting('favorites', window.favorites || {}).catch(() => {});
  };

  // ===== 7. CLEANUP base64 from localStorage =====
  try {
    const stored = localStorage.getItem('chapters');
    if (stored) {
      const chs = JSON.parse(stored);
      let clean = false;
      chs.forEach(ch => (ch.songs || []).forEach(sg => {
        if (sg.audio && sg.audio.startsWith('data:')) { sg.audio = ''; clean = true; }
        if (sg.image && sg.image.startsWith('data:')) { sg.image = ''; clean = true; }
      }));
      if (clean) { localStorage.setItem('chapters', JSON.stringify(chs)); console.log('[DB] 🧹 Cleaned base64'); }
    }
    localStorage.removeItem('localAudio');
  } catch {}

  // ===== 8. LOAD SETTINGS FROM SUPABASE =====
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
  console.log('[DB] 🚀 Ready — Supabase: ' + (supaReady ? 'ON' : 'OFF') + ' | GitHub uploads: ON');
})();
