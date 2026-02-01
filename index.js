export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==============================================
    // 🚀 SETTINGS (Control Panel)
    // ==============================================
    const DEV_MODE = false; // Kaam pura hone par 'false' karein
    
    const USERNAME = env.GITHUB_USERNAME;
    const REPO = env.GITHUB_REPO;
    const BRANCH = env.GITHUB_BRANCH || 'main';

    if (!USERNAME || !REPO) return new Response("Config Error", { status: 500 });

    let path = url.pathname;

    // --- 1. CLEAN URL LOGIC (Magic Happens Here) ---
    
    // A. Root URL Handling
    if (path === '/' || path === '') {
      path = '/index.html'; // Root hamesha index.html hi rahega
    }

    // B. Agar koi galti se '.html' laga ke aaye, to usse Clean URL par bhej do (Redirect)
    // Example: user ne likha '/staff-app.html' -> hum bhejenge '/staff-app' par
    if (path.endsWith('.html') && path !== '/index.html') {
      const cleanPath = path.replace('.html', '');
      return Response.redirect(url.origin + cleanPath, 301);
    }

    // C. Internal Mapping (Background Match)
    // Agar path mein koi '.' nahi hai (mtlb extension missing hai), to hum '.html' maan lenge
    // User URL: /staff-app
    // GitHub Path: /staff-app.html
    let gitHubPath = path;
    if (!path.includes('.')) {
        gitHubPath = path + '.html';
    }

    // --- 2. GITHUB URL SETUP ---
    const targetUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}${gitHubPath}`;

    // --- 3. CACHE CHECK ---
    const cacheKey = new Request(targetUrl, request); // Cache key me internal path use karein
    const cache = caches.default;

    if (!DEV_MODE) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    // --- 4. FETCH FROM GITHUB ---
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Cloudflare-Worker-CleanURL' },
      cf: { cacheTtl: DEV_MODE ? 0 : 300, cacheEverything: !DEV_MODE }
    });

    // --- 5. ERROR HANDLING ---
    if (!response.ok) {
      // Agar GitHub par file nahi mili (404)
      if (response.status === 404) {
        // Agar humne apni marzi se '.html' lagaya tha aur fail hua, to shayad URL galat hai
        return new Response(`404: Page Not Found\n(Looking for: ${gitHubPath})`, { status: 404 });
      }
      return response;
    }

    // --- 6. CONTENT TYPE & HEADERS ---
    const headers = new Headers(response.headers);
    const extension = gitHubPath.split('.').pop().toLowerCase();

    // Kyunki humne .html chupaya hai, extension check gitHubPath se karenge
    if (extension === 'html') {
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Content-Security-Policy", "upgrade-insecure-requests"); // HTTPS Fix
    } else if (extension === 'css') {
      headers.set("Content-Type", "text/css");
    } else if (extension === 'js') {
      headers.set("Content-Type", "application/javascript");
    } else if (extension === 'json') {
      headers.set("Content-Type", "application/json");
    }

    // Cache Control
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
