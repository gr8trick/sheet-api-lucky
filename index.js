export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 1. CONFIGURATION ---
    const USERNAME = env.GITHUB_USERNAME;
    const REPO = env.GITHUB_REPO;
    const BRANCH = env.GITHUB_BRANCH || 'main';

    if (!USERNAME || !REPO) {
      return new Response("⚙️ Config Error: GITHUB_USERNAME or REPO missing in wrangler.toml", { status: 500 });
    }

    // --- 2. PATH OPTIMIZATION ---
    let path = url.pathname;
    if (path === '/' || path === '') path = '/index.html';

    // --- 3. CACHE KEY GENERATION ---
    // Har URL ke liye ek unique cache key banate hain
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;

    // STEP A: Check Cloudflare Cache (Sabse tez yahi hai)
    let response = await cache.match(cacheKey);

    if (response) {
      // Agar cache mein mil gaya, wahi se return karo (No GitHub trip needed!)
      return response;
    }

    // STEP B: Agar Cache mein nahi hai, to GitHub se lo
    const targetUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}${path}`;

    const originalResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Cloudflare-Worker-Pro-App' // Professional identification
      }
    });

    // 404 Handling (Agar file nahi mili)
    if (!originalResponse.ok) {
        if (originalResponse.status === 404) {
             return new Response(`404: File Not Found\nCheck path: ${path}`, { status: 404 });
        }
        return originalResponse;
    }

    // --- 4. MIME TYPE HANDLING (High Quality) ---
    const headers = new Headers(originalResponse.headers);
    const extension = path.split('.').pop().toLowerCase();
    
    const mimeTypes = {
      "html": "text/html;charset=UTF-8",
      "css": "text/css;charset=UTF-8",
      "js": "application/javascript;charset=UTF-8",
      "json": "application/json",
      "png": "image/png",
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "svg": "image/svg+xml",
      "ico": "image/x-icon",
      "woff2": "font/woff2", // Fonts ke liye zaroori
      "ttf": "font/ttf",
      "mp4": "video/mp4"     // Video support
    };

    headers.set("Content-Type", mimeTypes[extension] || "text/plain");

    // --- 5. PERFORMANCE HEADERS (Magic Sauce) ---
    
    // a. Browser Cache: User ke browser ko bolo 60 second tak save rakhe
    headers.set("Cache-Control", "public, max-age=60, s-maxage=120"); 
    
    // b. CORS: Taki aapka JS/CSS kisi bhi domain/app se call ho sake
    headers.set("Access-Control-Allow-Origin", "*"); 
    
    // c. Security: Native app standard security
    headers.set("X-Content-Type-Options", "nosniff");

    // --- 6. SAVE TO CACHE & RETURN ---
    // Nayi response banate hain
    response = new Response(originalResponse.body, {
      status: originalResponse.status,
      headers: headers
    });

    // Is response ko Cloudflare Edge Cache mein save karo 2 minute ke liye
    // "ctx.waitUntil" background mein save karega bina user ko wait karaye
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  }
};
