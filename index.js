export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==============================================
    // 🚀 MODE SETTINGS
    // True  = Development (Jab aap changes kar rahe hon - Cache OFF)
    // False = Production  (Jab final ho jaye - Rocket Speed ON)
    const DEV_MODE = true; 
    // ==============================================

    const USERNAME = env.GITHUB_USERNAME;
    const REPO = env.GITHUB_REPO;
    const BRANCH = env.GITHUB_BRANCH || 'main';

    if (!USERNAME || !REPO) {
      return new Response("Error: Wrangler.toml mein Username/Repo set nahi hai.", { status: 500 });
    }

    // --- 1. SINGLE FILE LOGIC ---
    // User chahe "/login" khole ya "/dashboard", hum hamesha index.html hi dikhayenge
    // Kyunki aapka pura app ek hi page par chalta hai (Single Page App)
    const targetUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}/index.html`;

    // --- 2. CACHE CHECK (Speed Boost) ---
    const cacheKey = new Request(targetUrl, request);
    const cache = caches.default;

    if (!DEV_MODE) {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) return cachedResponse;
    }

    // --- 3. GITHUB FETCH ---
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Cloudflare-Worker-ERP' },
      cf: {
        cacheTtl: DEV_MODE ? 0 : 300,
        cacheEverything: !DEV_MODE
      }
    });

    if (!response.ok) {
      return new Response("404: Index.html GitHub par nahi mila. Repo check karein.", { status: 404 });
    }

    // --- 4. HEADERS & SECURITY ---
    const headers = new Headers(response.headers);
    
    // Force browser to read as HTML (Isse Design load hoga)
    headers.set("Content-Type", "text/html; charset=utf-8");
    
    // Auto-fix Mixed Content (Agar aap HTML me meta tag bhool gaye to ye sambhal lega)
    headers.set("Content-Security-Policy", "upgrade-insecure-requests");
    
    // Cache Settings
    if (DEV_MODE) {
      headers.set("Cache-Control", "no-store, no-cache, max-age=0");
    } else {
      // Browser: 2 min, Server: 5 min
      headers.set("Cache-Control", "public, max-age=120, s-maxage=300");
    }

    const finalResponse = new Response(response.body, {
      status: 200,
      headers: headers
    });

    // Save to Cache if in Pro Mode
    if (!DEV_MODE) ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));

    return finalResponse;
  }
};
