/**
 * SLEEP SONGS — SUPABASE SYNC (v4.0 BULLETPROOF)
 * Everything wrapped in try-catch. NEVER crashes the page.
 */
(async function () {
  'use strict';

  try {

  const SB_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
  const SB_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
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
      console.log('[DB] Supabase connected');
    } catch (e) {
      console.warn('[DB] Supabase offline:', e.message || e);
    }
  }

  // ===== 2. DB HELPERS =====
  var DB = {
    loadChapters: function() {
      return supa.from('chapters').select('*').order('id').then(function(r) {
        if (r.error) throw r.error;
        return r.data.map(function(x) {
          return { id: x.id, name: x.name, icon: x.icon, songs: Array.isArray(x.songs) ? x.songs : JSON.parse(x.songs || '[]') };
        });
      });
    },
    saveChapter: function(ch) {
      return supa.from('chapters').upsert({
        id: ch.id, name: ch.name, icon: ch.icon || '📚', songs: ch.songs || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }).then(function(r) {
        if (r.error) throw r.error;
      });
    },
    getSetting: function(key) {
      return supa.from('settings').select('value').eq('key', key).single().then(function(r) {
        return r.data ? r.data.value : null;
      });
    },
    setSetting: function(key, value) {
      return supa.from('settings').upsert({
        key: key, value: value, updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    }
  };

  // ===== 3. GITHUB UPLOAD =====
  function getGH() {
    return {
      token: localStorage.getItem('gh_token') || '',
      owner: (localStorage.getItem('gh_repo') || '/').split('/')[0],
      name: (localStorage.getItem('gh_repo') || '/').split('/')[1]
    };
  }

  function uploadToGitHub(file) {
    var gh = getGH();
    if (!gh.token || !gh.owner || !gh.name) return Promise.reject('NO_TOKEN');

    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var arr = new Uint8Array(reader.result);
        var hash = 0;
        for (var i = 0; i < Math.min(arr.length, 1024); i++) hash = ((hash << 5) - hash + arr[i]) | 0;
        var folder = file.type.startsWith('audio/') ? 'audio' : 'images';
        var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var fileName = folder + '/' + Math.abs(hash).toString(36).slice(0, 6) + '_' + safeName;

        var reader2 = new FileReader();
        reader2.onload = function() {
          var base64 = reader2.result.split(',')[1];
          fetch('https://api.github.com/repos/' + gh.owner + '/' + gh.name + '/contents/' + fileName, {
            method: 'PUT',
            headers: { Authorization: 'token ' + gh.token, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Upload ' + fileName, content: base64, branch: 'main' })
          }).then(function(res) {
            if (!res.ok) return res.json().then(function(e) { throw new Error(e.message || 'Upload failed: ' + res.status); });
            return res.json();
          }).then(function(data) {
            console.log('[Upload] GitHub:', fileName);
            resolve({ url: data.content.download_url });
          }).catch(reject);
        };
        reader2.onerror = reject;
        reader2.readAsDataURL(file);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(0, 1024));
    });
  }

  function uploadToLocal(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        console.log('[Upload] localStorage fallback');
        resolve({ url: reader.result });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Override uploadFile: GitHub → base64 fallback
  try { delete window.uploadFile; } catch(e) {}
  window.uploadFile = function(file, oldUrl) {
    return uploadToGitHub(file).catch(function(err) {
      console.warn('[Upload] GitHub failed:', err);
      return uploadToLocal(file);
    });
  };

  // Sync GITHUB_CONFIG
  if (typeof GITHUB_CONFIG !== 'undefined') {
    var gt = localStorage.getItem('gh_token') || '';
    var gr = localStorage.getItem('gh_repo') || '';
    if (gt) GITHUB_CONFIG.token = gt;
    if (gr) { GITHUB_CONFIG.owner = gr.split('/')[0]; GITHUB_CONFIG.repo = gr.split('/')[1]; }
  }

  // ===== 4. FIX convertUrl =====
  window.convertUrl = function(url) {
    if (!url) return url;
    if (url.indexOf('drive.google.com') !== -1) {
      var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) return 'https://drive.google.com/uc?export=download&id=' + m[1];
      var p = new URLSearchParams((url.split('?')[1] || ''));
      var id = p.get('id');
      if (id) return 'https://drive.google.com/uc?export=download&id=' + id;
    }
    if (url.indexOf('dropbox.com') !== -1) {
      return url.replace('dl=0', 'dl=1').replace('?dl=0', '?dl=1');
    }
    return url;
  };

  // ===== 5. SAFE loadChapters override =====
  var _origLoadChapters = window.loadChapters;

  window.loadChapters = function() {
    // If already loaded with data, just sync
    if (window.chapters && Array.isArray(window.chapters) && window.chapters.length > 0) {
      var hasData = window.chapters.some(function(ch) { return ch.songs && ch.songs.length > 0; });
      if (hasData) {
        // Sync to Supabase in background
        if (supaReady) {
          window.chapters.forEach(function(ch) { DB.saveChapter(ch).catch(function(){}); });
        }
        return; // Don't re-render, data is already there
      }
    }

    // Try Supabase
    if (supaReady) {
      DB.loadChapters().then(function(sbChapters) {
        if (sbChapters && sbChapters.length > 0) {
          var localHasSongs = window.chapters && window.chapters.some(function(ch) { return ch.songs && ch.songs.length > 0; });
          var sbHasSongs = sbChapters.some(function(ch) { return ch.songs && ch.songs.length > 0; });

          // Only use Supabase data if it has songs OR local has no songs
          if (sbHasSongs || !localHasSongs) {
            window.chapters = sbChapters;
            try { localStorage.setItem('chapters', JSON.stringify(window.chapters)); } catch(e) {}
          } else {
            // Local has songs, Supabase doesn't — sync local UP
            window.chapters.forEach(function(ch) { DB.saveChapter(ch).catch(function(){}); });
          }
          if (typeof renderChapters === 'function') renderChapters();
          if (typeof updateStats === 'function') updateStats();
        }
      }).catch(function(e) {
        console.warn('[DB] Load error:', e);
      });
      return; // Original loadChapters already ran, don't duplicate
    }
  };

  // ===== 6. Override saveChaptersLocal =====
  window.saveChaptersLocal = function() {
    try {
      localStorage.setItem('chapters', JSON.stringify(window.chapters));
    } catch(e) {
      console.error('[DB] localStorage full!', e);
    }
    if (supaReady && window.chapters) {
      window.chapters.forEach(function(ch) { DB.saveChapter(ch).catch(function(){}); });
    }
  };

  // ===== 7. Settings overrides =====
  window.savePlayCounts = function() {
    try { localStorage.setItem('playCounts', JSON.stringify(window.playCounts || {})); } catch(e) {}
    if (supaReady) DB.setSetting('play_counts', window.playCounts || {}).catch(function(){});
  };

  window.saveFavorites = function() {
    try { localStorage.setItem('favorites', JSON.stringify(window.favorites || {})); } catch(e) {}
    if (supaReady) DB.setSetting('favorites', window.favorites || {}).catch(function(){});
  };

  // ===== 8. SAFE cleanup — only stale base64 =====
  try {
    var stored = localStorage.getItem('chapters');
    if (stored) {
      var chs = JSON.parse(stored);
      var cleaned = false;
      chs.forEach(function(ch) {
        (ch.songs || []).forEach(function(sg) {
          if (sg.audio && sg.audio.indexOf('data:') === 0) {
            // Only remove if there's also a valid HTTP URL
            if (sg.audioUrl && sg.audioUrl.indexOf('http') === 0) {
              sg.audio = sg.audioUrl;
              cleaned = true;
            }
            // Otherwise KEEP the base64
          }
        });
      });
      if (cleaned) {
        localStorage.setItem('chapters', JSON.stringify(chs));
        console.log('[DB] Cleaned stale base64');
      }
    }
  } catch(e) {}

  // ===== 9. Load settings from Supabase =====
  if (supaReady) {
    DB.getSetting('ad_settings').then(function(a) { if (a) localStorage.setItem('ad_settings', JSON.stringify(a)); }).catch(function(){});
    DB.getSetting('contact_info').then(function(c) { if (c) localStorage.setItem('contact_info', JSON.stringify(c)); }).catch(function(){});
  }

  window.DB = DB;
  window.SUPABASE_SYNC = supaReady;
  console.log('[DB] v4.0 Ready — Supabase: ' + (supaReady ? 'ON' : 'OFF'));

  } catch (FATAL) {
    // ===== CATCH EVERYTHING — NEVER CRASH THE PAGE =====
    console.error('[DB] Fatal error (non-critical):', FATAL);
  }
})();
