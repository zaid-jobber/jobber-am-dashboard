// AM Hub local proxy.
//  - Weather: OpenWeather (self-serve key).
//  - Gmail + Calendar: via your Zapier account — either the Zapier MCP server
//    (preferred: live, on-demand) or "Storage by Zapier" (fallback). Both
//    sidestep Google OAuth/admin. Read-only; nothing persisted server-side.
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { mcpListTools, mcpCall } from "./mcp.js";
import { sfConfigured, fetchAccounts, fetchActivity } from "./salesforce.js";
import { aiConfigured, generate } from "./ai.js";
import { promosConfigured, fetchPromos } from "./promos.js";
import { slackTileConfigured, fetchChannelMessages } from "./slack.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "6mb" }));
const PORT = process.env.PORT || 3001;

// ---------- Per-AM state persistence ----------
// Each AM's dashboard state (targets, time off, layout, journal, notes…) is
// saved server-side keyed by their identifier, so clearing the browser cache no
// longer wipes anything and the same AM gets their setup back on any device.
// File-based today (one JSON per AM); swap for a DB when RevOps provisions one.
const STATE_DIR = path.join(process.cwd(), "data", "state");
fs.mkdirSync(STATE_DIR, { recursive: true });
const stateFile = (key) => path.join(STATE_DIR, String(key || "").toLowerCase().replace(/[^a-z0-9._@-]/g, "_").slice(0, 160) + ".json");

app.get("/api/state/:key", (req, res) => {
  try {
    const f = stateFile(req.params.key);
    if (!f.startsWith(STATE_DIR) || !fs.existsSync(f)) return res.json({ state: null });
    res.json({ state: JSON.parse(fs.readFileSync(f, "utf8")) });
  } catch { res.json({ state: null }); }
});
app.put("/api/state/:key", (req, res) => {
  try {
    const f = stateFile(req.params.key);
    if (!f.startsWith(STATE_DIR)) return res.status(400).json({ ok: false });
    fs.writeFileSync(f, JSON.stringify(req.body?.state ?? {}));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});
app.delete("/api/state/:key", (req, res) => {
  try {
    const f = stateFile(req.params.key);
    if (f.startsWith(STATE_DIR) && fs.existsSync(f)) fs.unlinkSync(f);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});
const MCP = process.env.ZAPIER_MCP_URL;

// ---------- Zapier Storage (fallback bridge) ----------
// Read one key's value from the store (returns null if that key isn't set yet,
// so the endpoint falls back cleanly). We only read gmail/calendar, never other keys.
async function zapierGet(key) {
  if (!process.env.ZAPIER_SECRET) return null;
  try {
    const r = await fetch("https://store.zapier.com/api/records", { headers: { "X-Secret": process.env.ZAPIER_SECRET } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === "object" && key in j ? j[key] : null;
  } catch { return null; }
}
const asList = (v) => {
  if (!v) return [];
  if (typeof v === "object" && v.list) return Array.isArray(v.list) ? v.list : [v.list];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const j = JSON.parse(v); return Array.isArray(j) ? j : (j?.list ? [j.list].flat() : [v]); } catch { return [v]; } }
  return [];
};
const splitFields = (it) => (typeof it === "string" ? it.split(":::") : it);
const sameLocalDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ---------- coercion (MCP action results → our shapes) ----------
const coerceThread = (x) => typeof x === "string"
  ? { from: "", subject: x, snippet: "" }
  : { from: x.from_name || x.from || x.sender || x.from__name || "", subject: x.subject || x.title || "", snippet: x.body_plain || x.snippet || x.body || x.preview || "" };
const pickStr = (...vals) => { for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim(); return ""; };
const fmtTime = (t) => t.replace(/(\d)\s?AM\b/i, "$1a").replace(/(\d)\s?PM\b/i, "$1p");
const coerceEvent = (x) => {
  if (typeof x === "string") return { when: "", title: x, busy: true };
  const s = (x.start && typeof x.start === "object") ? x.start : (x.when && typeof x.when === "object" ? x.when : {});
  let when;
  if (s.time_pretty) when = fmtTime(s.time_pretty);          // timed event → "10:00a"
  else if (s.date && !s.time) when = "All day";              // all-day event
  else when = fmtTime(pickStr(s.dateTime_pretty, s.date_pretty, typeof x.start === "string" ? x.start : "", typeof x.when === "string" ? x.when : ""));
  return { when, title: pickStr(x.summary, x.event_name, x.title, x.name) || "(busy)", busy: x.busy !== false };
};
// Slack message → feed post. Cleans emoji codes, formats time, keeps permalink.
const coerceSlack = (x) => {
  if (typeof x === "string") return { channel: "", title: x, sub: "", when: "", url: "", icon: "Megaphone", tone: "" };
  const channel = x.channel?.name || x.channel_name || (typeof x.channel === "string" ? x.channel : "") || "";
  const ch = String(channel).toLowerCase();
  let icon = "Megaphone", tone = "";
  if (/war|incident|outage/.test(ch)) { icon = "AlertTriangle"; tone = "warn"; }
  else if (/leaderboard/.test(ch)) icon = "Trophy";
  const ts = parseFloat(x.ts) * 1000;
  let when = "";
  if (!isNaN(ts) && ts > 0) { const d = new Date(ts); when = `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?AM/, "a").replace(/\s?PM/, "p")}`; }
  const title = String(x.text || x.raw_text || x.message?.text || x.title || "")
    .replace(/:[a-z0-9_+'-]+:/gi, "")   // :emoji:
    .replace(/<[^>]+>/g, "")            // <@mentions> / <links>
    .replace(/\\([>_*`~])/g, "$1")      // unescape \> \_ etc.
    .replace(/^[>\s]+/, "")             // leading quote markers
    .replace(/[*_`]/g, "")              // stray markdown
    .replace(/\s+/g, " ").trim().slice(0, 120);
  // A thread reply has a thread_ts that differs from its own ts; main posts don't.
  const threadTs = x.thread_ts || x.message?.thread_ts;
  const isReply = !!(threadTs && String(threadTs) !== String(x.ts)) || x.subtype === "thread_broadcast";
  return { channel: channel.replace(/^#/, ""), title, sub: x.user?.real_name || x.user?.name || x.username || "", when, tsMs: !isNaN(ts) ? ts : 0, url: x.permalink || "", icon, tone, isReply };
};
const pickArray = (p) => Array.isArray(p) ? p : (p?.results || p?.emails || p?.events || p?.messages || p?.items || (p ? [p] : []));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, weather: !!process.env.OPENWEATHER_KEY, mcp: !!MCP, zapierStore: !!process.env.ZAPIER_SECRET, salesforce: sfConfigured(), ai: aiConfigured(), promos: promosConfigured(), slackTile: slackTileConfigured() })
);

// ---------- Live Expansion promos from the Slack canvas (dormant until token) ----------
app.get("/api/promos", async (_req, res) => {
  if (!promosConfigured()) return res.status(401).json({ needsAuth: true, hint: "Add SLACK_BOT_TOKEN + PROMO_CANVAS_ID to .env to pull promos live" });
  try { res.json({ promos: await fetchPromos() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Salesforce sync (build-ahead; dormant until SF_* creds exist) ----------
app.get("/api/salesforce/accounts", async (_req, res) => {
  if (!sfConfigured()) return res.status(401).json({ needsAuth: true, hint: "Add SF_* to .env once you have a Connected App" });
  try { res.json({ accounts: await fetchAccounts() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Salesforce activity (dials/talk/connects/opps — the Ambition source) ----------
app.get("/api/salesforce/activity", async (_req, res) => {
  if (!sfConfigured()) return res.status(401).json({ needsAuth: true, hint: "Add SF_* to .env once you have a Connected App" });
  try { res.json({ activity: await fetchActivity() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- discovery: list the actions your Zapier MCP server exposes ----------
app.get("/api/mcp/tools", async (_req, res) => {
  if (!MCP) return res.status(401).json({ needsAuth: true, hint: "Set ZAPIER_MCP_URL in server/.env" });
  try { res.json({ tools: await mcpListTools(MCP) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Gmail ----------
app.get("/api/gmail/threads", async (_req, res) => {
  // 1) MCP
  if (MCP && process.env.ZAPIER_MCP_GMAIL_TOOL) {
    try {
      const r = await mcpCall(MCP, process.env.ZAPIER_MCP_GMAIL_TOOL, { instructions: "List my most recent inbox emails (sender, subject, snippet).", maxResults: 6 });
      const items = pickArray(r.parsed);
      if (items.length) return res.json({ threads: items.slice(0, 6).map(coerceThread) });
      if (r.raw) return res.json({ threads: [], raw: r.raw }); // surfaced so we can map fields
    } catch (e) { /* fall through */ }
  }
  // 2) Storage fallback. Item shape: "from:::subject:::snippet:::date" (date optional).
  const g = await zapierGet("gmail");
  if (g != null) {
    let items = asList(g).map((it) => {
      const [from = "", subject = "", snippet = "", date = ""] = splitFields(it);
      return { from: String(from).trim(), subject: String(subject).trim(), snippet: String(snippet).trim(), date: String(date).trim() };
    });
    // Show only today's emails (server local day). If no item carries a date yet
    // (Zap not updated), fall back to showing the list so the tile isn't blank.
    const anyDated = items.some((m) => m.date && !isNaN(new Date(m.date)));
    if (anyDated) items = items.filter((m) => m.date && sameLocalDay(new Date(m.date), new Date()));
    return res.json({ threads: items.slice(-6).reverse().map(({ from, subject, snippet }) => ({ from, subject, snippet })) });
  }
  res.status(401).json({ needsAuth: true });
});

// ---------- Calendar ----------
app.get("/api/calendar/today", async (_req, res) => {
  if (MCP && process.env.ZAPIER_MCP_CALENDAR_TOOL) {
    try {
      const r = await mcpCall(MCP, process.env.ZAPIER_MCP_CALENDAR_TOOL, { instructions: "Find my Google Calendar events for today (start time and title)." });
      const items = pickArray(r.parsed);
      if (items.length) return res.json({ events: items.slice(0, 8).map(coerceEvent) });
      if (r.raw) return res.json({ events: [], raw: r.raw });
    } catch (e) { /* fall through */ }
  }
  const c = await zapierGet("calendar");
  if (c != null) {
    return res.json({ events: asList(c).slice(0, 8).map((it) => {
      const [when = "", title = "", busy = ""] = splitFields(it);
      const whenStr = String(when).trim();
      // Format ISO datetime to "9:00a" style
      let display = whenStr;
      try {
        const d = new Date(whenStr);
        if (!isNaN(d)) display = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(" AM", "a").replace(" PM", "p");
      } catch { /* leave as-is */ }
      return { when: display, title: String(title).trim(), busy: String(busy).trim() !== "free" };
    }) });
  }
  res.status(401).json({ needsAuth: true });
});

// ---------- Slack ----------
// Reading two channels via Zapier takes ~10s, so we DON'T do it inside the client
// request (the slow call races with the dashboard's frequent re-polls and gets
// dropped). Instead a background refresher caches the result; /api/slack returns
// the cache instantly. Cache refreshes on first hit and every 90s thereafter.
const SLACK_TTL = 90 * 1000;
let _slackCache = { at: 0, posts: null, raw: null, refreshing: false };

async function refreshSlack() {
  if (_slackCache.refreshing) return;
  _slackCache.refreshing = true;
  try {
    const channelIds = (process.env.SLACK_TILE_CHANNELS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const channelNames = (process.env.SLACK_TILE_CHANNEL_NAMES || "").split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean);
    // Primary: bot-token channel history (reliable, any sender).
    if (slackTileConfigured() && channelIds.length) {
      const posts = (await fetchChannelMessages(channelIds)).slice(0, 6);
      if (posts.length) { _slackCache = { at: Date.now(), posts, raw: null, refreshing: false }; return; }
    }
    // Fallback: Zapier "Find Message" search, one query PER channel BY NAME.
    if (MCP && process.env.ZAPIER_MCP_SLACK_TOOL && channelNames.length) {
      const settled = await Promise.all(channelNames.map((name) =>
        mcpCall(MCP, process.env.ZAPIER_MCP_SLACK_TOOL, { instructions: `Find the most recent message posted by anyone (not just me) in the #${name} Slack channel.` }).catch(() => null)));
      let posts = []; let lastRaw = null;
      for (const r of settled) { if (!r) continue; lastRaw = r.raw || lastRaw; posts.push(...pickArray(r.parsed).map(coerceSlack)); }
      posts = posts.filter((p) => p.title && !p.isReply).sort((a, b) => (b.tsMs || 0) - (a.tsMs || 0)).slice(0, 6);
      _slackCache = { at: Date.now(), posts, raw: posts.length ? null : lastRaw, refreshing: false };
      return;
    }
    _slackCache = { at: Date.now(), posts: [], raw: null, refreshing: false };
  } catch {
    _slackCache.at = Date.now(); _slackCache.refreshing = false;
  }
}

app.get("/api/slack", async (_req, res) => {
  const hasChannels = !!(process.env.SLACK_TILE_CHANNELS || process.env.SLACK_TILE_CHANNEL_NAMES);
  if (hasChannels || MCP) {
    const fresh = Date.now() - _slackCache.at < SLACK_TTL;
    if (_slackCache.posts == null) await refreshSlack();   // first hit: populate synchronously
    else if (!fresh) refreshSlack();                        // stale: refresh in background, serve cache now
    if (_slackCache.posts) return res.json(_slackCache.raw ? { posts: _slackCache.posts, raw: _slackCache.raw } : { posts: _slackCache.posts });
  }
  // Legacy Zapier-storage fallback.
  const v = await zapierGet("slack");
  if (v == null) return res.status(401).json({ needsAuth: true });
  const posts = asList(v).slice(0, 6).map((it) => {
    const [channel = "", title = "", sub = "", when = ""] = splitFields(it);
    const ch = String(channel).toLowerCase();
    let icon = "Megaphone", tone = "";
    if (ch.includes("war") || ch.includes("incident") || ch.includes("outage")) { icon = "AlertTriangle"; tone = "warn"; }
    else if (ch.includes("critical") || ch.includes("sales-crit")) { icon = "Target"; tone = "lead"; }
    else if (ch.includes("leaderboard") || ch.includes("announce-expansion")) icon = "Trophy";
    return { channel: String(channel).trim(), title: String(title).trim(), sub: String(sub).trim(), when: String(when).trim(), icon, tone };
  });
  res.json({ posts });
});

// ---------- Weather ----------
const REGION_CITIES = { ET: "New York,US", CT: "Chicago,US", MT: "Denver,US", PT: "Los Angeles,US", AT: "Halifax,CA" };
const iconFor = (main) => {
  const m = (main || "").toLowerCase();
  if (m.includes("rain") || m.includes("drizzle") || m.includes("thunder") || m.includes("snow")) return { icon: "CloudRain", hot: true };
  if (m.includes("cloud")) return { icon: "Cloud", hot: false };
  return { icon: "Sun", hot: false };
};
app.get("/api/weather", async (_req, res) => {
  const key = process.env.OPENWEATHER_KEY;
  if (!key) return res.status(401).json({ needsAuth: true });
  try {
    const zones = await Promise.all(Object.entries(REGION_CITIES).map(async ([z, city]) => {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${key}`);
      const d = await r.json();
      if (!d.main) return null; // key inactive / error
      const { icon, hot } = iconFor(d.weather?.[0]?.main);
      return { z, icon, t: `${Math.round(d.main.temp)}°`, hot, cond: d.weather?.[0]?.main || "" };
    }));
    if (zones.some((z) => z === null)) return res.status(401).json({ needsAuth: true, hint: "OpenWeather key invalid or still activating (new keys take up to ~2h)." });
    const raining = zones.filter((z) => z.hot).map((z) => z.z);
    const lead = raining.length ? `Raining in ${raining.join(" & ")} — prime day to call your landscaping & irrigation accounts.` : "Clear across regions today — work your hottest signals.";
    res.json({ zones, lead });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- AI generation (OpenAI / ChatGPT Enterprise; dormant until OPENAI_API_KEY) ----------
app.post("/api/ai/generate", async (req, res) => {
  if (!aiConfigured()) return res.status(401).json({ needsAuth: true, hint: "Add OPENAI_API_KEY to .env" });
  try { res.json({ text: await generate(req.body || {}) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Serve the built front-end (so the whole app runs from one process) ----------
// After `pnpm build` in am-hub/, `node index.js` serves the dashboard + API on one
// port. Non-API routes fall back to index.html for client-side routing.
const DIST = path.resolve(process.cwd(), "..", "am-hub", "dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

app.listen(PORT, () => console.log(`AM Hub running on http://localhost:${PORT}`));
