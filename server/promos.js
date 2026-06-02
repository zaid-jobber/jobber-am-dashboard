// Live Expansion promos from a Slack Canvas (BUILD-AHEAD — dormant until creds
// exist in .env). The Promos page calls /api/promos; until configured it returns
// { needsAuth:true } and the client falls back to its built-in promo list.
//
// .env needed:
//   SLACK_BOT_TOKEN   (xoxb-… ; scopes: files:read, canvases:read if available)
//   PROMO_CANVAS_ID   (the canvas file id; from the canvas URL …/docs/<team>/<ID>)
//
// NOTE: the markdown→promo parser below targets the canvas's current structure
// (an "Expansion" section with one promo per heading/bullet). It will be tuned
// against the real canvas on first successful read — the section heading and
// field layout drive the mapping.

const SLACK_API = "https://slack.com/api";
const DEFAULT_CANVAS = "F08QJTU0F4Z"; // the Expansion promos canvas from the shared link

export function promosConfigured() {
  return !!process.env.SLACK_BOT_TOKEN;
}

async function slack(method, params = {}) {
  const url = `${SLACK_API}/${method}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } });
  if (!r.ok) throw new Error(`Slack ${method} ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(`Slack ${method}: ${j.error}`);
  return j;
}

// Fetch the raw canvas markdown. Slack returns canvas content as a downloadable
// file (url_private); we pull it with the bot token.
async function canvasMarkdown(canvasId) {
  const info = await slack("files.info", { file: canvasId });
  const f = info.file || {};
  // Newer canvases expose markdown directly; older ones via url_private.
  if (typeof f.canvas?.content === "string") return f.canvas.content;
  const url = f.url_private_download || f.url_private;
  if (!url) return "";
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } });
  return r.ok ? await r.text() : "";
}

// Best-effort markdown parser: take the "Expansion" section, turn each bullet or
// sub-heading into a promo { title, terms, elig, tags }.
export function parsePromos(md) {
  if (!md) return [];
  const lines = md.split(/\r?\n/);
  const out = [];
  let inExpansion = false;
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading) {
      inExpansion = /expansion/i.test(heading[1]);
      continue;
    }
    if (!inExpansion || !line) continue;
    const bullet = line.replace(/^[-*•]\s+/, "");
    if (bullet === line && !/[:–-]/.test(line)) continue; // skip prose lines
    // "30x3 — 30% off for 3 months (no stacking)" → title / terms split on — or :
    const m = bullet.match(/^(.+?)\s*[—:–-]\s*(.*)$/);
    const title = (m ? m[1] : bullet).trim();
    const terms = (m ? m[2] : "").trim();
    if (title) out.push({ title, terms, elig: "", tags: ["Expansion"] });
  }
  return out;
}

export async function fetchPromos() {
  const id = process.env.PROMO_CANVAS_ID || DEFAULT_CANVAS;
  const md = await canvasMarkdown(id);
  return parsePromos(md);
}
