/**
 * Enhanced Supabase Sync + Cloudinary Upload
 * - Uploads files to Cloudinary (primary) or GitHub (fallback)
 * - NEVER stores base64 in localStorage
 * - Syncs chapter metadata to Supabase kv_store
 */
(async function () {
  'use strict';

  const PREFIX = location.pathname.replace(/[^a-zA-Z]/g, '_').slice(0, 8) + '_';
  let supa = null;
  let supaOk = false;

  // ===== 1. Supabase Connection =====
  if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) {
    try {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      document.head.appendChild(s);
      await new Promise((r) => (s.onload = r));
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await supa.from('kv_store').select('key').limit(1);
      supaOk = true;
      console.log('[Sync] ✅ Supabase connected');
    } catch (e) {
      console.warn('[Sync] ⚠️ Supabase offline:', e.message);
    }
  }

  // ===== 2. Enhanced localStorage.setItem → sync to Supabase =====
  if (supaOk) {
    const origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      // Don't sync huge base64 blobs — only sync small metadata keys
      if (k === 'localAudio' || k === 'uploadedAudioFiles') return;
      try {
        supa
          .from('kv_store')
          .upsert(
            { key: k, value: JSON.parse(v), updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
          .catch(() => {});
      } catch {
        // non-JSON values (theme, cookies, etc.) — skip sync
      }
    };
    console.log('[Sync] localStorage.setItem patched for Supabase sync');
  }

  // ===== 3. Cloudinary Upload =====
  async function uploadToCloudinary(file) {
    if (typeof CLOUDINARY_CLOUD_NAME === 'undefined' || !CLOUDINARY_CLOUD_NAME) {
      throw new Error('Cloudinary not configured');
    }
    const folder = file.type.startsWith('audio/') ? 'sleep-songs/audio' : 'sleep-songs/images';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET || 'ml_default');
    formData.append('folder', folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Cloudinary upload failed: ${res.status}`);
    }

    const data = await res.json();
    console.log('[Upload] ✅ Cloudinary:', data.secure_url);
    return { url: data.secure_url, public_id: data.public_id };
  }

  // ===== 4. GitHub Upload (fallback) =====
  async function uploadToGitHub(file) {
    const GH_TOKEN = localStorage.getItem('gh_token');
    if (!GH_TOKEN) throw new Error('No GitHub token');

    const GH_REPO = localStorage.getItem('gh_repo') || 'galalemad75-creator/sleep-songs-files';
    const [owner, repo] = GH_REPO.split('/');
    const folder = file.type.startsWith('audio/') ? 'audio' : 'images';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Short hash to avoid collisions
    const fileHash = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arr = new Uint8Array(reader.result);
        let hash = 0;
        for (let i = 0; i < Math.min(arr.length, 1024); i++)
          hash = ((hash << 5) - hash + arr[i]) | 0;
        resolve(Math.abs(hash).toString(36).slice(0, 6));
      };
      reader.readAsArrayBuffer(file.slice(0, 1024));
    });

    const fileName = `${folder}/${fileHash}_${safeName}`;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${GH_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Upload ${fileName}`,
          content: base64,
          branch: 'main',
        }),
      }
    );

    if (!res.ok) throw new Error(`GitHub upload failed: ${res.status}`);
    const data = await res.json();
    console.log('[Upload] ✅ GitHub:', data.content.download_url);
    return { url: data.content.download_url };
  }

  // ===== 5. Delete old file from GitHub =====
  async function deleteOldGithubFile(downloadUrl) {
    const GH_TOKEN = localStorage.getItem('gh_token');
    if (!GH_TOKEN || !downloadUrl) return;
    try {
      const parts = downloadUrl.split('/raw.githubusercontent.com/');
      if (parts.length < 2) return;
      const pathParts = parts[1].split('/');
      const filePath = pathParts.slice(3).join('/');
      if (!filePath.startsWith('audio/') && !filePath.startsWith('images/')) return;

      const GH_REPO = localStorage.getItem('gh_repo') || 'galalemad75-creator/sleep-songs-files';
      const [owner, repo] = GH_REPO.split('/');

      const getRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
        }
      );
      if (getRes.ok) {
        const fileData = await getRes.json();
        await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
          method: 'DELETE',
          headers: {
            Authorization: `token ${GH_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Remove old: ${filePath}`,
            sha: fileData.sha,
            branch: 'main',
          }),
        });
        console.log('[Upload] 🗑️ Deleted old GitHub file:', filePath);
      }
    } catch (e) {
      console.warn('[Upload] Could not delete old file:', e.message);
    }
  }

  // ===== 6. Override window.uploadFile =====
  // Priority: Cloudinary → GitHub → Error (NO base64 fallback)
  window.uploadFile = async function (file, oldUrl) {
    // Delete old GitHub file if replacing
    if (oldUrl && oldUrl.includes('raw.githubusercontent.com')) {
      await deleteOldGithubFile(oldUrl);
    }

    // Try Cloudinary first
    try {
      return await uploadToCloudinary(file);
    } catch (e) {
      console.warn('[Upload] Cloudinary failed, trying GitHub:', e.message);
    }

    // Fallback to GitHub
    try {
      return await uploadToGitHub(file);
    } catch (e) {
      console.error('[Upload] GitHub also failed:', e.message);
      // Return a blob URL as last resort (session-only, no localStorage bloat)
      const blobUrl = URL.createObjectURL(file);
      console.warn('[Upload] ⚠️ Using session-only blob URL');
      return { url: blobUrl };
    }
  };

  // ===== 7. Clean up old base64 from localStorage =====
  try {
    const stored = localStorage.getItem('chapters');
    if (stored) {
      const chapters = JSON.parse(stored);
      let cleaned = false;
      chapters.forEach((ch) => {
        ch.songs.forEach((song) => {
          // Remove base64 audio (data:audio/...)
          if (song.audio && song.audio.startsWith('data:')) {
            song.audio = '';
            cleaned = true;
          }
          // Remove base64 images (data:image/...)
          if (song.image && song.image.startsWith('data:')) {
            song.image = '';
            cleaned = true;
          }
        });
      });
      if (cleaned) {
        localStorage.setItem('chapters', JSON.stringify(chapters));
        console.log('[Sync] 🧹 Cleaned base64 data from chapters');
      }
    }
    // Remove old localAudio blob
    localStorage.removeItem('localAudio');
  } catch (e) {
    console.warn('[Sync] Cleanup failed:', e.message);
  }

  window.SUPABASE_SYNC = supaOk;
  console.log('[Sync] 🚀 Enhanced sync ready (Cloudinary + GitHub + Supabase)');
})();
