export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==============================================
    // 🚀 SETTINGS
    // ==============================================
    const DEV_MODE = true; // Kaam khatam hone par 'false' kar dena
    
    const USERNAME = env.GITHUB_USERNAME;
    const REPO = env.GITHUB_REPO;
    const BRANCH = env.GITHUB_BRANCH || 'main';

    if (!USERNAME || !REPO) return new Response("Config Error", { status: 500 });

    // --- 1. PATH DETECTION (Ye Naya Hai) ---
    // Agar URL '/' hai to 'index.html', warna jo manga hai wo file
    let path = url.pathname;
    if (path === '/' || path === '') {
      path = '/index.html';
    }

    // --- 2. URL BANANA ---
    // Ab ye dynamic hai: .../repo/main/staff-app.html
    const targetUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}${path}`;

    // --- 3. CACHE CHECK ---
    const cacheKey = new Request(targetUrl, request);
    const cache = caches.default;

    if (!DEV_MODE) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    // --- 4. FETCH FROM GITHUB ---
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Cloudflare-Worker-App' },
      cf: { cacheTtl: DEV_MODE ? 0 : 300, cacheEverything: !DEV_MODE }
    });

    if (!response.ok) {
      return new Response(`404: File Not Found.\nGitHub par ye file nahi mili: ${path}`, { status: 404 });
    }

    // --- 5. HEADERS & MIME TYPES ---
    const headers = new Headers(response.headers);
    const extension = path.split('.').pop().toLowerCase();

    // Browser ko batana zaroori hai ki ye HTML hai
    if (extension === 'html') {
      headers.set("Content-Type", "text/html; charset=utf-8");
      // Mixed Content Fix
      headers.set("Content-Security-Policy", "upgrade-insecure-requests");
    } else if (extension === 'css') {
      headers.set("Content-Type", "text/css");
    } else if (extension === 'js') {
      headers.set("Content-Type", "application/javascript");
    }

    // Cache Headers
    if (DEV_MODE) {
      headers.set("Cache-Control", "no-store, no-cache, max-age=0");
    } else {
      headers.set("Cache-Control", "public, max-age=120, s-maxage=300");
    }

    const finalResponse = new Response(response.body, { status: 200, headers: headers });

    if (!DEV_MODE) ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));

    return finalResponse;
  }
};
