// Thin fetch helper. Returns null on any failure / not-configured so callers
// fall back to mock data / deep-links. Served by the local proxy in ../server.

// Timeout so one slow/hanging endpoint (e.g. a stalled Zapier call) can't block
// callers that fetch several feeds together via Promise.all.
async function get(path, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // proxy not running / timed out
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  health: () => get("/api/health"),
  weather: () => get("/api/weather"),
  gmailThreads: () => get("/api/gmail/threads"), // via Zapier bridge
  calendarToday: () => get("/api/calendar/today"), // via Zapier bridge
  slackPosts: () => get("/api/slack"), // via Zapier bridge
  salesforceAccounts: () => get("/api/salesforce/accounts"), // dormant until Connected App creds
  salesforceActivity: () => get("/api/salesforce/activity"), // dials/talk/connects/opps (Ambition source)
  // Per-AM state persistence (survives cache clears, syncs across devices).
  getState: (key) => get(`/api/state/${encodeURIComponent(key)}`),
  putState: (key, state) =>
    fetch(`/api/state/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) })
      .then((r) => r.ok).catch(() => false),
  deleteState: (key) => fetch(`/api/state/${encodeURIComponent(key)}`, { method: "DELETE" }).then((r) => r.ok).catch(() => false),
  promos: () => get("/api/promos"), // live Expansion promos from the Slack canvas (dormant until configured)
};

// Deep-links (no API) — used as fallback when the Zapier bridge isn't set up.
export function gmailSearchUrl(query) {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`;
}
export const googleCalendarTodayUrl = "https://calendar.google.com/calendar/u/0/r/day";
