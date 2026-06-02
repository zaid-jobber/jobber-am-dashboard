// Persisted, editable data store + live-feed poller + notifications.
import { useSyncExternalStore } from "react";
import { accounts as seedAccounts, hub } from "../data/mock.js";
import { generateBook } from "../data/book.js";
import { computePerformance } from "../lib/performance.js";
import { api } from "../lib/api.js";
import { beep } from "../lib/sound.js";

const KEY = "amhub:v1";
// Per-AM learning weights for the Worklist ranking factors (1 = neutral).
const DEFAULT_RANK_WEIGHTS = { followup: 1, trial: 1, behavioral: 1, easyUpgrade: 1, newAccount: 1, upgradeTag: 1, promo: 1, nba: 1 };
const DEFAULT_CONNECTIONS = { Salesforce: true, Anchor: true, Gmail: true, "Google Calendar": true, Slack: true, "Revenue.io": true, OpenWeather: true, "ChatGPT Enterprise": false };
// monthlyTargets: per-month given/projected targets keyed "YYYY-M" (see lib/targets.js).
// targetPrompt: months the AM dismissed the "set your targets" banner for.
const DEFAULT_SETTINGS = { quota: 8000, stretch: 100, trackJpay: true, notifBrowser: false, notifSound: false, cadenceMode: "revio", worklistEnabled: true, schedLeadMin: 30, workStart: "08:00", workEnd: "17:00", monthlyTargets: {}, targetPrompt: {}, rankWeights: { ...DEFAULT_RANK_WEIGHTS }, connections: { ...DEFAULT_CONNECTIONS } };
// Dashboard tiles — default shows everything so the AM can review then trim.
const WIDTHS = [3, 4, 5, 6, 8, 12];
const LAYOUT_VERSION = 2; // bump to migrate stored layouts (e.g. hide Gmail/Calendar)
const DEFAULT_LAYOUT = [
  { key: "slack", w: 5 },
  { key: "activity", w: 7 },
  { key: "recent", w: 4 },
  { key: "weather", w: 4 },
  { key: "playbook", w: 4 },
  { key: "leaderboard", w: 4 },
  { key: "trials", w: 4 },
  { key: "wins", w: 4 },
  { key: "tasks", w: 4 },
  { key: "notes", w: 4 },
];
// Performance tiles — customizable like the Hub (resize / drag / show-hide).
const DEFAULT_PERF_LAYOUT = [
  { key: "bestTimes", w: 8 }, { key: "weather", w: 4 }, { key: "signal", w: 7 }, { key: "activity", w: 5 },
  { key: "cadence", w: 7 }, { key: "funnel", w: 5 }, { key: "whereWin", w: 12 },
];
// Pipeline columns (view-only, customizable). Each maps SF status values → a
// column. `dot` is the colour swatch. Order = left→right; Closed Lost sits last.
// Every stage maps to a real Salesforce field value — `kind:"account"` matches
// Account.upgradeStatus (pre-opp), `kind:"opp"` matches the Opportunity stage.
// Stages are chosen from this catalog only (no free-text columns).
export const STAGE_CATALOG = [
  { id: "working", label: "Working", dot: "g1", kind: "account", statuses: ["Working", "New"] },
  { id: "new", label: "New", dot: "g1", kind: "account", statuses: ["New"] },
  { id: "disqualified", label: "Disqualified", dot: "lost", kind: "account", statuses: ["Disqualified"] },
  { id: "discovery", label: "Open Opp Discovery", dot: "g2", kind: "opp", oppStage: "Discovery" },
  { id: "evaluating", label: "Open Opp Evaluating", dot: "g3", kind: "opp", oppStage: "Evaluating" },
  { id: "qualified", label: "Open Opp Qualified", dot: "g3", kind: "opp", oppStage: "Qualified" },
  { id: "won", label: "Open Opp Won", dot: "g4", kind: "opp", oppStage: "Closed Won" },
  { id: "lost", label: "Closed Lost", dot: "lost", kind: "opp", oppStage: "Closed Lost" },
];
const pick = (id) => STAGE_CATALOG.find((s) => s.id === id);
const DEFAULT_STAGES = ["working", "discovery", "evaluating", "won", "lost"].map(pick);
const BOOK_VERSION = 5; // bump on any book.js account-shape change
// Development goals. `auto` goals compute current from live activity/quota; the
// rest are manually tracked for accountability.
const DEFAULT_DEV_GOALS = [
  { id: "g-quota", label: "Annualized quota", kind: "progress", auto: "quota", target: 100, unit: "%" },
  { id: "g-talk", label: "Talk time / day", kind: "progress", auto: "talk", target: 90, unit: "m" },
  { id: "g-win", label: "Win rate", kind: "progress", auto: "winRate", target: 40, unit: "%" },
  { id: "g-jpay", label: "JPay close rate", kind: "progress", current: 33, target: 45, unit: "%" },
  { id: "g-cert", label: "Finish JPay certification", kind: "milestone", done: false },
];
// timeOff: [{ id, start, end, label }] (YYYY-MM-DD). Weekdays in range drop out of selling days.
const DEFAULT_PROFILE = { name: "", role: "Account Manager · Expansion", region: "Pacific (PT)", email: "", peopleLeader: "S. Walker", oooBuddy: "L. Levesque", level: "3", timeOff: [] };
const todayKey = () => new Date().toDateString();
const freshToday = () => ({ date: todayKey(), focus: "", overrides: {}, done: [], skipped: [] });
const seedFeeds = () => ({ weather: hub.weather, inbox: hub.inbox, schedule: hub.schedule, slack: hub.slack });
// Activity (dials/talk/connects/opps) — seeded from mock; replaced by Salesforce
// once the Connected App is live. talk is stored in MINUTES.
const seedActivity = () => ({
  booked: hub.booked,
  week: hub.week,
  month: { dials: hub.month.dials, sms: hub.month.sms, talk: 28 * 60, opps: hub.month.opps, connects: 0 },
  today: { dials: 28, sms: 14, talk: 52, opps: 5, connects: 0 },
});

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  const base = (s && s.accounts) ? s : { accounts: structuredClone(seedAccounts) };
  // Demo book schema version — bump when book.js shape changes so stored book
  // accounts regenerate (hand-authored/custom accounts are always kept).
  let baseAccts = base.accounts;
  if ((base.bookV || 0) !== BOOK_VERSION) {
    const nonBook = {};
    for (const [id, v] of Object.entries(baseAccts)) if (!/^acc-/.test(id)) nonBook[id] = v;
    baseAccts = nonBook;
  }
  const today = base.today && base.today.date === todayKey() ? base.today : freshToday();
  // Missed-roll: at day rollover, accounts that were surfaced (planned) yesterday
  // but never marked done carry over to today. We read yesterday's done set BEFORE
  // `freshToday()` wipes it. Don't keep deeper history (memory strain — query SF).
  const prevWl = base.worklist;
  let worklist;
  if (prevWl && prevWl.date === todayKey()) {
    worklist = { pinned: [], ...prevWl };
  } else {
    const prevDone = (base.today && base.today.done) || [];
    const prevSkipped = (base.today && base.today.skipped) || [];
    // Carry over what was surfaced, pinned, or explicitly skipped yesterday but not done.
    const carried = [...new Set([...(prevWl?.planned || []), ...prevSkipped, ...(prevWl?.pinned || [])])].filter((id) => !prevDone.includes(id));
    worklist = { date: todayKey(), planned: [], carried, oppAck: [], pinned: [] };
  }
  return {
    // The unified demo book always underlies the store; stored accounts (rich
    // seeds + the AM's edits) overlay on top. One book across list/pipeline/account.
    accounts: { ...generateBook(), ...baseAccts },
    bookV: BOOK_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(base.settings || {}), rankWeights: { ...DEFAULT_RANK_WEIGHTS, ...((base.settings || {}).rankWeights || {}) }, connections: { ...DEFAULT_CONNECTIONS, ...((base.settings || {}).connections || {}) } },
    worklist,
    journal: base.journal || [],
    today,
    // Merge over the seed so an older persisted feeds object missing a key
    // (weather/inbox/schedule/slack) can never crash the Hub on upgrade.
    feeds: { ...seedFeeds(), ...(base.feeds || {}) },
    notifications: base.notifications || [],
    // Hide Gmail (inbox) + Calendar (schedule) by default; one-time strip from
    // existing stored layouts. They stay in the registry → re-addable via Customize.
    layout: (() => {
      let l = base.layout || structuredClone(DEFAULT_LAYOUT);
      if ((base.layoutV || 1) < LAYOUT_VERSION) l = l.filter((t) => t.key !== "inbox" && t.key !== "schedule");
      return l;
    })(),
    layoutV: LAYOUT_VERSION,
    tasks: base.tasks || [],
    quicknotes: base.quicknotes || [],
    spifOn: base.spifOn !== false,
    activity: base.activity || seedActivity(),
    // Reset stages if missing or on the stale (pre-opp) schema (no `kind`).
    pipelineStages: (base.pipelineStages && base.pipelineStages.every((st) => st.kind)) ? base.pipelineStages : structuredClone(DEFAULT_STAGES),
    devGoals: (base.devGoals && base.devGoals.every((g) => g.kind)) ? base.devGoals : structuredClone(DEFAULT_DEV_GOALS),
    profile: { ...DEFAULT_PROFILE, ...(base.profile || {}) },
    perfLayout: base.perfLayout || structuredClone(DEFAULT_PERF_LAYOUT),
    // First-run setup + guided tour. done → wizard finished; tutorialDone → tour seen.
    onboarding: { done: false, tutorialDone: false, ...(base.onboarding || {}) },
    editing: false,
  };
}

let state = load();
const listeners = new Set();

// ---- Server-side persistence (keyed by the AM) -----------------------------
// localStorage stays as the instant-load cache; the server copy is the durable
// source of truth so clearing the browser cache no longer wipes the AM's setup,
// and the same AM gets it back on any device. No-op until we know who the AM is
// (profile.email) and the proxy is reachable.
const userKey = (s = state) => { const e = s?.profile?.email; return e && /@/.test(e) ? e.trim().toLowerCase() : null; };
let _saveT = null;
function remoteSave() {
  const key = userKey();
  if (!key) return;
  clearTimeout(_saveT);
  // Persist the AM's SETUP only — strip ephemeral live data (feeds are re-fetched
  // every poll; persisting them would clobber the live tiles on hydrate).
  _saveT = setTimeout(() => { try { const { feeds, editing, ...persistable } = state; api.putState(key, persistable); } catch { /* offline */ } }, 800);
}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ } remoteSave(); };
const emit = () => listeners.forEach((l) => l());
function set(updater) { state = updater(state); persist(); emit(); }

// Pull the AM's saved state from the server and adopt it (re-normalized through
// load() so schema migrations still run). Called on startup and on restore.
let _hydrated = false;
export async function hydrateFromServer(key = userKey()) {
  if (!key) return false;
  const d = await api.getState(key);
  if (d && d.state && typeof d.state === "object" && d.state.profile) {
    const liveFeeds = state.feeds; // keep whatever the poller has already fetched
    try { localStorage.setItem(KEY, JSON.stringify(d.state)); } catch { /* quota */ }
    state = load();
    state = { ...state, feeds: { ...state.feeds, ...liveFeeds } }; // live tiles win over stale/seeded
    _hydrated = true;
    emit();
    return true;
  }
  return false;
}

// Full reset → wipes local + server copy and reloads into a fresh onboarding.
// (Demo/testing aid; also handy if an AM wants to start over.)
export async function resetEverything() {
  const key = userKey();
  clearTimeout(_saveT); // cancel any pending save so it can't re-create the file
  try { if (key) await api.deleteState(key); } catch { /* offline */ }
  try { localStorage.removeItem(KEY); } catch { /* */ }
  location.reload();
}

// Does this AM already have a saved setup on the server? (used by onboarding to
// offer a "welcome back, restore your setup" path after a cache clear).
export async function checkRemoteState(email) {
  const key = email && /@/.test(email) ? email.trim().toLowerCase() : null;
  if (!key) return false;
  const d = await api.getState(key);
  return !!(d && d.state && d.state.profile && d.state.onboarding?.done);
}

export function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
export const getAccounts = () => state.accounts;
export const getAccount = (id) => state.accounts[id];
export const getSettings = () => state.settings;

const initials = (s) => (s || "?").replace(/<.*>/, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const now = () => "just now";

export const actions = {
  updateAccount(id, patch) { set((s) => ({ ...s, accounts: { ...s.accounts, [id]: { ...s.accounts[id], ...patch } } })); },
  addAccount(a) { set((s) => ({ ...s, accounts: { ...s.accounts, [a.id]: a } })); },
  logActivity(id, entry) { set((s) => { const a = s.accounts[id]; return { ...s, accounts: { ...s.accounts, [id]: { ...a, activity: [{ when: now(), ...entry }, ...(a.activity || [])] } } }; }); },
  addNote(id, note) { set((s) => { const a = s.accounts[id]; return { ...s, accounts: { ...s.accounts, [id]: { ...a, notes: [{ by: "ZF", when: now(), ...note }, ...(a.notes || [])] } } }; }); },
  importAccounts(list) {
    set((s) => { const accts = { ...s.accounts }; for (const a of list) { const p = accts[a.id]; accts[a.id] = { ...p, ...a, activity: p?.activity || a.activity || [], notes: p?.notes || a.notes || [] }; } return { ...s, accounts: accts }; });
  },
  setGoal(patch) { set((s) => ({ ...s, settings: { ...s.settings, ...patch } })); },
  updateProfile(patch) { set((s) => ({ ...s, profile: { ...s.profile, ...patch } })); },
  toggleConnection(name) { set((s) => ({ ...s, settings: { ...s.settings, connections: { ...s.settings.connections, [name]: !s.settings.connections?.[name] } } })); },
  setConnection(name, val) { set((s) => ({ ...s, settings: { ...s.settings, connections: { ...s.settings.connections, [name]: val } } })); },
  // Monthly targets (per "YYYY-M") — revenue anchors entered by the AM, activity
  // targets projected by the system. `entered:true` marks a confirmed month.
  setMonthlyTargets(key, t) { set((s) => ({ ...s, settings: { ...s.settings, monthlyTargets: { ...s.settings.monthlyTargets, [key]: { ...t } } } })); },
  dismissTargetPrompt(key) { set((s) => ({ ...s, settings: { ...s.settings, targetPrompt: { ...s.settings.targetPrompt, [key]: true } } })); },
  // Time off — weekday ranges that reduce selling days everywhere.
  addTimeOff(t) { set((s) => ({ ...s, profile: { ...s.profile, timeOff: [...(s.profile.timeOff || []), { id: "to-" + Date.now().toString(36), ...t }] } })); },
  removeTimeOff(id) { set((s) => ({ ...s, profile: { ...s.profile, timeOff: (s.profile.timeOff || []).filter((t) => t.id !== id) } })); },
  // Onboarding wizard + guided tour
  completeOnboarding() { set((s) => ({ ...s, onboarding: { ...s.onboarding, done: true } })); },
  completeTutorial() { set((s) => ({ ...s, onboarding: { ...s.onboarding, tutorialDone: true } })); },
  startTutorial() { set((s) => ({ ...s, onboarding: { ...s.onboarding, tutorialDone: false } })); },
  resetOnboarding() { set((s) => ({ ...s, onboarding: { done: false, tutorialDone: false } })); },
  // Worklist ranking: nudge a single factor's learning weight (clamped 0.2–2.5).
  setRankWeight(key, val) { set((s) => ({ ...s, settings: { ...s.settings, rankWeights: { ...DEFAULT_RANK_WEIGHTS, ...s.settings.rankWeights, [key]: Math.max(0.2, Math.min(2.5, val)) } } })); },
  resetRankWeights() { set((s) => ({ ...s, settings: { ...s.settings, rankWeights: { ...DEFAULT_RANK_WEIGHTS } } })); },
  // Record which account ids the Worklist surfaced today (drives next-day carry-over).
  setPlanned(ids) { set((s) => ({ ...s, worklist: { ...(s.worklist.date === todayKey() ? s.worklist : { date: todayKey(), planned: [], carried: [], oppAck: [] }), date: todayKey(), planned: ids } })); },
  // Mark that the AM has answered the open-opp popup for an account (hub mode).
  ackOpp(id) { set((s) => ({ ...s, worklist: { ...s.worklist, oppAck: [...new Set([...(s.worklist.oppAck || []), id])] } })); },
  // Manually add/remove an account to today's Worklist (force-surfaced).
  pinToWorklist(id) { set((s) => ({ ...s, worklist: { ...s.worklist, pinned: [...new Set([...(s.worklist.pinned || []), id])] } })); },
  unpinFromWorklist(id) { set((s) => ({ ...s, worklist: { ...s.worklist, pinned: (s.worklist.pinned || []).filter((x) => x !== id) } })); },
  disqualify(id, reason) { set((s) => { const a = s.accounts[id]; return { ...s, accounts: { ...s.accounts, [id]: { ...a, upgradeStatus: "Disqualified", dqReason: reason } } }; }); },
  resetToSeed() { set((s) => ({ ...s, accounts: structuredClone(seedAccounts) })); },
  // day focus + journal
  setToday(patch) { set((s) => ({ ...s, today: { ...(s.today.date === todayKey() ? s.today : freshToday()), ...patch, date: todayKey() } })); },
  addJournal(entry) { set((s) => ({ ...s, journal: [{ id: Date.now() + Math.random(), ts: Date.now(), by: "ZF", ...entry }, ...s.journal] })); },
  removeJournal(id) { set((s) => ({ ...s, journal: s.journal.filter((j) => j.id !== id) })); },
  // Development goals (accountability tracking)
  addDevGoal(g) { set((s) => ({ ...s, devGoals: [...s.devGoals, { id: "g-" + Date.now().toString(36), current: 0, target: 100, unit: "", ...g }] })); },
  updateDevGoal(id, patch) { set((s) => ({ ...s, devGoals: s.devGoals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })); },
  removeDevGoal(id) { set((s) => ({ ...s, devGoals: s.devGoals.filter((g) => g.id !== id) })); },
  // notifications
  addNotification(n) { set((s) => ({ ...s, notifications: [{ id: Date.now() + Math.random(), when: "now", read: false, ...n }, ...s.notifications].slice(0, 40) })); },
  markNotificationsRead() { set((s) => ({ ...s, notifications: s.notifications.map((x) => ({ ...x, read: true })) })); },
  clearNotifications() { set((s) => ({ ...s, notifications: [] })); },
  // dashboard layout
  addTile(key, w = 4) { set((s) => (s.layout.some((t) => t.key === key) ? s : { ...s, layout: [...s.layout, { key, w }] })); },
  removeTile(key) { set((s) => ({ ...s, layout: s.layout.filter((t) => t.key !== key) })); },
  resizeTile(key, dir) {
    set((s) => ({ ...s, layout: s.layout.map((t) => {
      if (t.key !== key) return t;
      const i = Math.max(0, WIDTHS.indexOf(t.w));
      const ni = Math.min(WIDTHS.length - 1, Math.max(0, i + dir));
      return { ...t, w: WIDTHS[ni] };
    }) }));
  },
  moveTile(key, dir) {
    set((s) => {
      const arr = [...s.layout];
      const i = arr.findIndex((t) => t.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return s;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...s, layout: arr };
    });
  },
  // drag reorder: drop `fromKey` onto the slot of `toKey`
  reorderTile(fromKey, toKey) {
    if (fromKey === toKey) return;
    set((s) => {
      const arr = [...s.layout];
      const from = arr.findIndex((t) => t.key === fromKey);
      let to = arr.findIndex((t) => t.key === toKey);
      if (from < 0 || to < 0) return s;
      const [moved] = arr.splice(from, 1);
      to = arr.findIndex((t) => t.key === toKey);
      arr.splice(to, 0, moved);
      return { ...s, layout: arr };
    });
  },
  resetLayout() { set((s) => ({ ...s, layout: structuredClone(DEFAULT_LAYOUT) })); },
  // Performance tiles — same customize model as the dashboard.
  addPerfTile(key, w = 6) { set((s) => (s.perfLayout.some((t) => t.key === key) ? s : { ...s, perfLayout: [...s.perfLayout, { key, w }] })); },
  removePerfTile(key) { set((s) => ({ ...s, perfLayout: s.perfLayout.filter((t) => t.key !== key) })); },
  resizePerfTile(key, dir) {
    set((s) => ({ ...s, perfLayout: s.perfLayout.map((t) => {
      if (t.key !== key) return t;
      const i = Math.max(0, WIDTHS.indexOf(t.w));
      return { ...t, w: WIDTHS[Math.min(WIDTHS.length - 1, Math.max(0, i + dir))] };
    }) }));
  },
  reorderPerfTile(fromKey, toKey) {
    if (fromKey === toKey) return;
    set((s) => {
      const arr = [...s.perfLayout];
      const from = arr.findIndex((t) => t.key === fromKey);
      if (from < 0) return s;
      const [moved] = arr.splice(from, 1);
      const to = arr.findIndex((t) => t.key === toKey);
      arr.splice(to < 0 ? arr.length : to, 0, moved);
      return { ...s, perfLayout: arr };
    });
  },
  resetPerfLayout() { set((s) => ({ ...s, perfLayout: structuredClone(DEFAULT_PERF_LAYOUT) })); },
  setEditing(v) { set((s) => ({ ...s, editing: typeof v === "function" ? v(s.editing) : v })); },
  setSpif(v) { set((s) => ({ ...s, spifOn: v })); },
  setActivity(a) { set((s) => ({ ...s, activity: { ...s.activity, ...a } })); },
  // Pipeline stage customization — view-only board; AM reorders, adds (from the
  // SF-field catalog only) or removes columns.
  moveStage(id, dir) {
    set((s) => {
      const arr = [...s.pipelineStages]; const i = arr.findIndex((x) => x.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return s;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...s, pipelineStages: arr };
    });
  },
  addStage(id) { set((s) => { const preset = pick(id); if (!preset || s.pipelineStages.some((st) => st.id === id)) return s; return { ...s, pipelineStages: [...s.pipelineStages, { ...preset }] }; }); },
  removeStage(id) { set((s) => ({ ...s, pipelineStages: s.pipelineStages.filter((st) => st.id !== id) })); },
  resetStages() { set((s) => ({ ...s, pipelineStages: structuredClone(DEFAULT_STAGES) })); },
  toggleWorklistDone(id) {
    set((s) => {
      const t = s.today.date === todayKey() ? s.today : freshToday();
      const done = t.done || [];
      const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
      return { ...s, today: { ...t, date: todayKey(), done: next } };
    });
  },
  // Skip an account today → it leaves the list and rolls to tomorrow at the top.
  // The cadence step is NOT advanced, so the whole sequence shifts one day later.
  skipWorklist(id) {
    set((s) => {
      const t = s.today.date === todayKey() ? s.today : freshToday();
      const skipped = t.skipped || [];
      return { ...s, today: { ...t, date: todayKey(), skipped: skipped.includes(id) ? skipped : [...skipped, id] } };
    });
  },
  unskipWorklist(id) { set((s) => { const t = s.today.date === todayKey() ? s.today : freshToday(); return { ...s, today: { ...t, date: todayKey(), skipped: (t.skipped || []).filter((x) => x !== id) } }; }); },
  // tasks (with optional due time → notification)
  addTask(text, due) { set((s) => ({ ...s, tasks: [...s.tasks, { id: Date.now() + Math.random(), text, due: due || null, done: false }] })); },
  toggleTask(id) { set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })); },
  removeTask(id) { set((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })); },
  // quick notes (scratchpad — separate from the Development journal)
  addQuickNote(text) { set((s) => ({ ...s, quicknotes: [{ id: Date.now() + Math.random(), text, when: "now" }, ...s.quicknotes] })); },
  removeQuickNote(id) { set((s) => ({ ...s, quicknotes: s.quicknotes.filter((n) => n.id !== id) })); },
};

// ---- Development auto-journal: persist a weekly stats snapshot + a monthly
// wins entry, once per period (deduped by weekKey/monthKey). LIVE: this is the
// "end-of-week" scheduled job; in the demo it runs on load if the period's
// entry doesn't exist yet. ----
const isoWeekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${wk}`;
};
const monthKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}`;
export function rollupDevEntries() {
  const wk = isoWeekKey(); const mo = monthKey();
  const j = state.journal || [];
  const adds = [];
  if (!j.some((e) => e.weekKey === wk)) {
    const a = state.activity || {}; const w = a.week || {}; const m = a.month || {};
    const P = computePerformance(state.accounts, a, state.settings, "month");
    const dials = w.dials || Math.round((m.dials || 0) / 4);
    const opps = w.opps || Math.round((m.opps || 0) / 4);
    adds.push({ type: "Stats", weekKey: wk, auto: true, title: `Week of ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })} · ${dials} dials · ${opps} opps`, text: `Auto-logged weekly summary. Connection rate ${P.connRate}%, talk ${P.talkPerDay}m/day, win rate ${P.winRate}%.` });
  }
  if (!j.some((e) => e.monthKey === mo)) {
    const P = computePerformance(state.accounts, state.activity, state.settings, "month");
    adds.push({ type: "Win", monthKey: mo, auto: true, title: `${P.upgrades} upgrades · $${Math.round(P.upgradeMRR).toLocaleString()} new MRR this month`, text: `Auto-logged from your closed-won opportunities. ASP $${P.asp}, win rate ${P.winRate}%.` });
  }
  if (adds.length) set((s) => ({ ...s, journal: [...adds.map((a) => ({ id: Date.now() + Math.random(), ts: Date.now(), by: "System", ...a })), ...s.journal] }));
}

// ---- live feed poller (centralized; drives Hub tiles + notifications) ----
let _primed = false;
const _seen = { gmail: new Set(), slack: new Set(), cal: new Set(), rain: new Set(), task: new Set() };

// Fire a notification when a task's due time passes (runs alongside feed poll).
export function checkTasks() {
  const now = Date.now();
  for (const t of state.tasks) {
    if (t.done || !t.due) continue;
    if (now >= t.due && !_seen.task.has(t.id)) {
      _seen.task.add(t.id);
      actions.addNotification({ type: "task", icon: "CheckSquare", title: "Task due", sub: t.text });
      const st = getSettings();
      if (st.notifBrowser && typeof Notification !== "undefined" && Notification.permission === "granted") { try { new Notification("Task due", { body: t.text }); } catch { /* */ } }
      if (st.notifSound) beep();
    }
  }
}
export async function pollFeeds() {
  const [w, g, c, sl] = await Promise.all([api.weather(), api.gmailThreads(), api.calendarToday(), api.slackPosts()]);
  const feeds = { ...state.feeds };
  const fresh = [];
  if (w?.zones?.length) {
    feeds.weather = { ...feeds.weather, zones: w.zones, lead: w.lead };
    for (const z of w.zones) { if (z.hot && !_seen.rain.has(z.z)) { _seen.rain.add(z.z); fresh.push({ type: "weather", icon: "CloudRain", title: `Rain in ${z.z}`, sub: "Prime day to call outdoor trades" }); } if (!z.hot) _seen.rain.delete(z.z); }
  }
  if (g?.threads?.length) {
    feeds.inbox = g.threads.map((t, i) => ({ av: `g${(i % 3) + 1}`, from: initials(t.from), subject: t.subject, sub: `${t.from}${t.snippet ? " — " + t.snippet : ""}`.slice(0, 64) }));
    for (const t of g.threads) { const id = "gm:" + t.subject + t.from; if (!_seen.gmail.has(id)) { _seen.gmail.add(id); fresh.push({ type: "mail", icon: "Mail", title: "New email", sub: `${t.subject} — ${t.from}` }); } }
  }
  if (c?.events?.length) {
    feeds.schedule = c.events.map((e) => ({ tm: e.when, tone: "soft", title: e.title, sub: e.busy ? "Busy" : "" }));
    for (const e of c.events) { const id = "cal:" + e.when + e.title; if (!_seen.cal.has(id)) { _seen.cal.add(id); fresh.push({ type: "calendar", icon: "Calendar", title: "Calendar", sub: `${e.when} · ${e.title}` }); } }
  }
  if (sl?.posts?.length) {
    feeds.slack = sl.posts;
    for (const p of sl.posts) { const id = "sl:" + p.channel + p.title; if (!_seen.slack.has(id)) { _seen.slack.add(id); fresh.push({ type: "slack", icon: p.icon || "Slack", title: p.channel, sub: p.title }); } }
  }
  set((s) => ({ ...s, feeds }));
  if (_primed && fresh.length) {
    const st = getSettings();
    fresh.forEach((n) => actions.addNotification(n));
    if (st.notifBrowser && typeof Notification !== "undefined" && Notification.permission === "granted") fresh.forEach((n) => { try { new Notification(n.title, { body: n.sub }); } catch { /* */ } });
    if (st.notifSound) beep();
  }
  _primed = true;
}

// React bindings
const useSlice = (sel) => useSyncExternalStore(subscribe, sel);
export const useAccounts = () => useSlice(getAccounts);
export const useAccount = (id) => useSlice(() => state.accounts[id]);
export const useSettings = () => useSlice(() => state.settings);
export const useToday = () => useSlice(() => state.today);
export const useJournal = () => useSlice(() => state.journal);
export const useFeeds = () => useSlice(() => state.feeds);
export const useNotifications = () => useSlice(() => state.notifications);
export const useLayout = () => useSlice(() => state.layout);
export const useTasks = () => useSlice(() => state.tasks);
export const useQuickNotes = () => useSlice(() => state.quicknotes);
export const useEditing = () => useSlice(() => state.editing);
export const useSpif = () => useSlice(() => state.spifOn);
export const useActivity = () => useSlice(() => state.activity);
export const useWorklist = () => useSlice(() => state.worklist);
export const usePipelineStages = () => useSlice(() => state.pipelineStages);
export const useDevGoals = () => useSlice(() => state.devGoals);
export const usePerfLayout = () => useSlice(() => state.perfLayout);
export const useProfile = () => useSlice(() => state.profile);
export const useOnboarding = () => useSlice(() => state.onboarding);
