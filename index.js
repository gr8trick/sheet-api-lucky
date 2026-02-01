export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================================
    // 🚀 CONTROL PANEL (Speed vs Update)
    // ==========================================
    // True = Kaam chal raha hai (Turant update dikhega, no cache)
    // False = Site final hai (Full Speed Rocket Mode 🚀)
    const DEV_MODE = true; 
    // ==========================================

    const USERNAME = env.GITHUB_USERNAME;
    const REPO = env.GITHUB_REPO;
    const BRANCH = env.GITHUB_BRANCH || 'main';

    if (!USERNAME || !REPO) {
      return new Response("⚙️ Config Error: Check wrangler.toml", { status: 500 });
    }

    // --- 1. PATH HANDLING (Smart Routing) ---
    let path = url.pathname;
    
    // Agar root hai to index.html serve karo
    if (path === '/' || path === '') {
      path = '/index.html';
    }

    // --- 2. CACHE CHECK (Only in Speed Mode) ---
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;

    if (!DEV_MODE) {
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        // Cache hit! Server tak jane ki zaroorat hi nahi
        return cachedResponse;
      }
    }

    // --- 3. FETCH FROM GITHUB ---
    const targetUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}${path}`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Cloudflare-Worker-Pro'
      },
      cf: {
        // Dev mode mein cache disable, Pro mode mein enable
        cacheTtl: DEV_MODE ? 0 : 300, 
        cacheEverything: !DEV_MODE
      }
    });

    // --- 4. ERROR HANDLING ---
    if (!response.ok) {
      // Agar file nahi mili (404), to user ko saaf batao
      if (response.status === 404) {
        return new Response(`404: File Not Found\nTrying to load: ${path}`, { status: 404 });
      }
      return response;
    }

    // --- 5. MIME TYPES (Sahi File Pehchanna) ---
    const headers = new Headers(response.headers);
    const extension = path.split('.').pop().toLowerCase();

    const mimeTypes = {
      "html": "text/html;charset=UTF-8",
      "css": "text/css;charset=UTF-8",
      "js": "application/javascript;charset=UTF-8",
      "json": "application/json",
      "png": "image/png",
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "gif": "image/gif",
      "svg": "image/svg+xml",
      "ico": "image/x-icon",
      "woff2": "font/woff2",
      "mp4": "video/mp4"
    };

    // Default to text/plain agar extension match na ho, par HTML ko priority do
    const contentType = mimeTypes[extension] || "text/plain";
    headers.set("Content-Type", contentType);

    // --- 6. SECURITY & PERFORMANCE HEADERS ---
    headers.set("Access-Control-Allow-Origin", "*"); // Doosri site se access allow
    headers.set("X-Content-Type-Options", "nosniff");

    if (DEV_MODE) {
      // Dev Mode: Cache band rakho taaki update turant dikhe
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    } else {
      // 🚀 Rocket Mode: 
      // Browser: 2 minute tak save rakhe
      // Cloudflare Server: 5 minute tak save rakhe
      headers.set("Cache-Control", "public, max-age=120, s-maxage=300");
    }

    // --- 7. FINALIZE & CACHE ---
    const finalResponse = new Response(response.body, {
      status: response.status,
      headers: headers
    });

    // Agar hum Rocket Mode mein hain, to Cloudflare Cache mein save kar lo
    if (!DEV_MODE) {
      ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
    }

    return finalResponse;
  }
};
