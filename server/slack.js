// Slack tile reader — pulls recent messages from specific channels by ID using
// Slack's conversations.history API (reliable, any sender, includes private
// channels the bot is in). This is the right tool for "show a channel's recent
// messages"; the Zapier "Find Message" action is search-based and can't list a
// channel's history without a keyword, so it's only a fallback.
//
// .env needed (same token works for promos):
//   SLACK_BOT_TOKEN     xoxb-… ; scopes: channels:history, groups:history,
//                       channels:read, groups:read, users:read
//   SLACK_TILE_CHANNELS comma-separated channel IDs (e.g. GL55WD2N4,C0314D9QFAM)
// The bot must be invited to each channel (incl. private ones) to read history.

const API = "https://slack.com/api";

export function slackTileConfigured() {
  return !!process.env.SLACK_BOT_TOKEN;
}

async function slack(method, params = {}) {
  const url = `${API}/${method}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.error}`);
  return j;
}

const _names = {};
async function channelName(id) {
  if (_names[id]) return _names[id];
  try { const j = await slack("conversations.info", { channel: id }); _names[id] = j.channel?.name || id; }
  catch { _names[id] = id; }
  return _names[id];
}
const _users = {};
async function userName(id) {
  if (!id) return "";
  if (_users[id]) return _users[id];
  try { const j = await slack("users.info", { user: id }); _users[id] = j.user?.real_name || j.user?.name || ""; }
  catch { _users[id] = ""; }
  return _users[id];
}

const fmtWhen = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?AM/, "a").replace(/\s?PM/, "p")}`;
};
const SKIP = /join|leave|topic|purpose|archive|name/; // channel_join, etc.

export async function fetchChannelMessages(ids, perChannel = 4) {
  const out = [];
  for (const id of ids) {
    try {
      const name = await channelName(id);
      const j = await slack("conversations.history", { channel: id, limit: String(perChannel) });
      for (const m of j.messages || []) {
        if (m.subtype && SKIP.test(m.subtype)) continue;
        if (m.thread_ts && m.thread_ts !== m.ts) continue; // skip thread replies — only main posts
        if (m.subtype === "thread_broadcast") continue;      // reply also-sent-to-channel
        const text = String(m.text || "").replace(/<[^>]+>/g, "").replace(/[*_`>]/g, "").replace(/:[a-z0-9_+'-]+:/gi, "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const ts = parseFloat(m.ts) * 1000;
        out.push({
          channel: name, title: text.slice(0, 140), sub: await userName(m.user),
          tsMs: isNaN(ts) ? 0 : ts, when: fmtWhen(ts), url: "",
          icon: /announce/i.test(name) ? "Megaphone" : "MessageSquare", tone: /war|incident|outage|critical/.test(name) ? "warn" : "",
        });
      }
    } catch { /* skip channel the bot can't read */ }
  }
  return out.sort((a, b) => (b.tsMs || 0) - (a.tsMs || 0));
}
