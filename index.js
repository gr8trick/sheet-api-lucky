const API_KEY = "Rajbgs851211";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFNyWPImIZ3V9Ev2Agc1ztyuUTHLbgsNclhMRE4CXvB6LDnBTLLsz0KthL-spfiQ9O/exec";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") return cors();

    // API key security
    if (req.headers.get("x-api-key") !== API_KEY) {
      return json({ error: "Unauthorized" }, 401);
    }

    // -------- LOGS ENDPOINT --------
    if (url.pathname === "/logs" && req.method === "GET") {
      return getLogs(req, env);
    }

    // -------- MAIN CRUD API --------
    if (req.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }

    const body = await req.json();

    // Forward request to Google Apps Script
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await res.text();

    // Async log (KV, auto delete in 7 days)
    log(env.LOGS, {
      t: Date.now(),
      action: body.action,
      sheet: body.sheetName,
      id: body.id || null,
      ip: req.headers.get("cf-connecting-ip")
    });

    return new Response(text, {
      headers: { ...corsH(), "Content-Type": "application/json" }
    });
  }
};

// -------- LOGS READER --------
async function getLogs(req, env) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || 50);
  const cursor = url.searchParams.get("cursor");

  const list = await env.LOGS.list({ limit, cursor });
  const logs = [];

  for (const k of list.keys) {
    const v = await env.LOGS.get(k.name);
    if (v) logs.push(JSON.parse(v));
  }

  logs.sort((a, b) => b.t - a.t); // newest first

  return json({
    logs,
    nextCursor: list.cursor || null
  });
}

// -------- KV LOGGER --------
async function log(KV, data) {
  await KV.put(
    `log:${data.t}:${crypto.randomUUID()}`,
    JSON.stringify(data),
    { expirationTtl: 60 * 60 * 24 * 7 } // ✅ 7 days
  );
}

// -------- HELPERS --------
const corsH = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
});

const cors = () => new Response("", { headers: corsH() });

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsH(), "Content-Type": "application/json" }
  });
