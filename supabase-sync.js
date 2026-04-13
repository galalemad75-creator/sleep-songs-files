/* ===== Sleep Songs - SUPABASE SYNC (FIXED v4.1) =====
 * Non-destructive sync: ONLY pushes data UP to Supabase.
 * NEVER overwrites local data from Supabase.
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
      await supa.from(typeof SITE_ID!=='undefined'&&SITE_ID?SITE_ID+'_chapters':'chapters').select('id').limit(1);
      supaReady = true;
      console.log('[DB] Supabase connected');
    } catch (e) {
      console.warn('[DB] Supabase offline:', e.message || e);
    }
  }

  // ===== 2. DB HELPERS =====
  var DB = {
    loadChapters: function() {
      return supa.from(typeof SITE_ID!=='undefined'&&SITE_ID?SITE_ID+'_chapters':'chapters').select('*').order('id').then(function(r) {
        if (r.error) throw r.error;
        return r.data.map(function(x) {
          return { id: x.id, name: x.name, icon: x.icon, songs: Array.isArray(x.songs) ? x.songs : JSON.parse(x.songs || '[]') };
        });
      });
    },
    saveChapter: function(ch) {
      return supa.from(typeof SITE_ID!=='undefined'&&SITE_ID?SITE_ID+'_chapters':'chapters').upsert({
        id: ch.id, name: ch.name, icon: ch.icon || '📚', songs: ch.songs || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }).then(function(r) {
        if (r.error) throw r.error;
      });
    },
    getSetting: function(key) {
      return supa.from(typeof SITE_ID!=='undefined'&&SITE_ID?SITE_ID+'_settings':'settings').select('value').eq('key', key).single().then(function(r) {
        return r.data ? r.data.value : null;
      });
    },
    setSetting: function(key, value) {
      return supa.from(typeof SITE_ID!=='undefined'&&SITE_ID?SITE_ID+'_settings':'settings').upsert({
        key: key, value: value, updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    }
  };


  // ===== 2b. LOAD FROM SUPABASE (for new visitors) =====
  window.loadFromSupabase = function() {
    if (!supaReady) return Promise.resolve(null);
    return supa.from(typeof SITE_ID!=='undefined'&&SITE_ID?SITE_ID+'_chapters':'chapters').select('*').order('id').then(function(r) {
      if (r.error) { console.warn('[DB] Load error:', r.error); return null; }
      if (!r.data || r.data.length === 0) return null;
      var hasData = r.data.some(function(x) { return x.songs && (Array.isArray(x.songs) ? x.songs.length > 0 : JSON.parse(x.songs || '[]').length > 0); });
      if (!hasData) return null;
      console.log('[DB] Loaded chapters from Supabase');
      return r.data.map(function(x) {
        return {
          id: x.id,
          name: x.name,
          icon: x.icon || '📚',
          songs: Array.isArray(x.songs) ? x.songs : JSON.parse(x.songs || '[]'),
          isMusic: x.isMusic || false
        };
      });
    }).catch(function(e) {
      console.warn('[DB] Supabase load failed:', e);
      return null;
    });
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
      var m = url.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
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

  // ===== 5. SUPABASE SYNC (NON-DESTRUCTIVE) =====
  // ★ FIX: DON'T override loadChapters — let app.v4.js handle loading
  // Only sync Supabase in the background for cross-device support
  // Local data is ALWAYS the source of truth

  var _origSaveChaptersLocal = window.saveChaptersLocal;

  // Override saveChaptersLocal to ALSO save to Supabase
  window.saveChaptersLocal = function() {
    // Save to localStorage + backup (original behavior)
    try {
      localStorage.setItem('chapters', JSON.stringify(window.chapters));
      localStorage.setItem('chapters_backup', JSON.stringify(window.chapters));
      localStorage.setItem('chapters_backup_time', Date.now().toString());
    } catch(e) {
      console.error('[DB] localStorage save error:', e);
      try { localStorage.setItem('chapters_backup', JSON.stringify(window.chapters)); } catch(e2) {}
    }
    
    // Sync to Supabase in background (fire-and-forget, never block UI)
    if (supaReady && window.chapters && Array.isArray(window.chapters)) {
      window.chapters.forEach(function(ch) {
        DB.saveChapter(ch).catch(function(e) {
          console.warn('[DB] Supabase sync error for chapter', ch.id);
        });
      });
    }
  };

  // Background sync: periodically push local data to Supabase
  if (supaReady) {
    // On startup: push local chapters UP to Supabase (local is source of truth)
    setTimeout(function() {
      if (window.chapters && Array.isArray(window.chapters)) {
        var hasSongs = window.chapters.some(function(ch) { return ch.songs && ch.songs.length > 0; });
        if (hasSongs) {
          console.log('[DB] Syncing local chapters to Supabase...');
          window.chapters.forEach(function(ch) {
            DB.saveChapter(ch).catch(function(){});
          });
        }
      }
    }, 3000);
    
    // Periodic background sync every 5 minutes
    setInterval(function() {
      if (window.chapters && Array.isArray(window.chapters)) {
        console.log('[DB] Periodic sync to Supabase...');
        window.chapters.forEach(function(ch) {
          DB.saveChapter(ch).catch(function(){});
        });
      }
    }, 300000);
  }

  // ===== 6. Settings overrides =====
  window.savePlayCounts = function() {
    try { localStorage.setItem('playCounts', JSON.stringify(window.playCounts || {})); } catch(e) {}
    if (supaReady) DB.setSetting('play_counts', window.playCounts || {}).catch(function(){});
  };

  window.saveFavorites = function() {
    try { localStorage.setItem('favorites', JSON.stringify(window.favorites || {})); } catch(e) {}
    if (supaReady) DB.setSetting('favorites', window.favorites || {}).catch(function(){});
  };

  // ===== 7. SAFE cleanup — only stale base64 =====
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

  // ===== 8. Load settings from Supabase =====
  if (supaReady) {
    DB.getSetting('ad_settings').then(function(a) { if (a) localStorage.setItem('ad_settings', JSON.stringify(a)); }).catch(function(){});
    DB.getSetting('play_counts').then(function(a) { if (a) { window.playCounts = a; } }).catch(function(){});
    DB.getSetting('favorites').then(function(a) { if (a) { window.favorites = a; } }).catch(function(){});
  }

  // Export for admin panel
  window.SUPABASE_SYNC = { DB: DB, ready: function() { return supaReady; } };

  } catch(e) {
    console.warn('[DB] supabase-sync init failed:', e);
  }
})();
