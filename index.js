export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 1. Setup: Apni details yahan replace karein ya wrangler.toml ke vars use karein
    const USERNAME = env.GITHUB_USERNAME || 'RajKumarDev'; // Example username
    const REPO = env.GITHUB_REPO || 'my-website';         // Example repo
    const BRANCH = env.GITHUB_BRANCH || 'main';
    
    // 2. Path handle karna (Agar url khali hai to index.html uthao)
    let path = url.pathname;
    if (path === '/' || path === '') {
      path = '/index.html';
    }

    // 3. GitHub Raw URL create karna
    // Format: https://raw.githubusercontent.com/{user}/{repo}/{branch}/{path}
    const targetUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}${path}`;

    // 4. GitHub se content fetch karna
    const response = await fetch(targetUrl);

    // Agar file nahi mili (404), to error show karein
    if (!response.ok) {
      return new Response("404: File Not Found on GitHub", { status: 404 });
    }

    // 5. Sahi Content-Type set karna taaki browser code na dikhaye, balki run kare
    const headers = new Headers(response.headers);
    
    // Extension check karke header set karna
    if (path.endsWith('.html')) headers.set('Content-Type', 'text/html;charset=UTF-8');
    else if (path.endsWith('.css')) headers.set('Content-Type', 'text/css');
    else if (path.endsWith('.js')) headers.set('Content-Type', 'application/javascript');
    else if (path.endsWith('.json')) headers.set('Content-Type', 'application/json');
    else if (path.endsWith('.png')) headers.set('Content-Type', 'image/png');
    else if (path.endsWith('.jpg')) headers.set('Content-Type', 'image/jpeg');

    // Final response return karna
    return new Response(response.body, {
      status: response.status,
      headers: headers
    });
  }
};
