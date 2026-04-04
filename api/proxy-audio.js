// /api/proxy-audio - CORS proxy for Google Drive audio files
// Fixes 402/404 errors when playing audio from Google Drive

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Validate URL - only allow Google Drive and known storage
    const parsedUrl = new URL(url);
    const allowedHosts = [
      'drive.google.com',
      'docs.google.com',
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
      'drive.usercontent.google.com',
      'dl.dropboxusercontent.com',
      'dl.dropbox.com',
    ];

    if (!allowedHosts.some(h => parsedUrl.hostname.endsWith(h))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    // Build the direct download URL for Google Drive
    let fetchUrl = url;

    // Convert Google Drive share/view URLs to direct download
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gdMatch) {
      fetchUrl = `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;
    }

    const gdOpen = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (gdOpen) {
      fetchUrl = `https://drive.google.com/uc?export=download&id=${gdOpen[1]}`;
    }

    // Extract file ID for alternative download methods
    const fileIdMatch = fetchUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = fileIdMatch ? fileIdMatch[1] : null;

    // Forward Range header for seeking support
    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    // Try primary download URL
    let response = await fetch(fetchUrl, {
      headers,
      redirect: 'follow',
    });

    // If Google returns HTML (virus scan warning), try alternative methods
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') && fileId) {
      // Method 1: Use drive.usercontent.google.com (bypasses virus scan)
      response = await fetch(
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`,
        { headers, redirect: 'follow' }
      );
    }

    // Check if still HTML (error page)
    const finalContentType = response.headers.get('content-type') || '';
    if (finalContentType.includes('text/html') && fileId) {
      // Method 2: Use Google Docs direct link
      response = await fetch(
        `https://docs.google.com/uc?export=download&id=${fileId}`,
        { headers, redirect: 'follow' }
      );
    }

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({
        error: `Upstream returned ${response.status}`,
        url: fetchUrl,
      });
    }

    // Set proper audio headers
    const audioContentType = finalContentType.includes('text/html')
      ? 'audio/mpeg'
      : finalContentType || 'audio/mpeg';

    res.setHeader('Content-Type', audioContentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Forward content-length and content-range if present
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    // Set status (206 for partial content, 200 for full)
    res.status(response.status === 206 ? 206 : 200);

    // Stream the response
    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
      }
    };
    await pump();

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Failed to proxy audio',
      message: error.message,
    });
  }
}
