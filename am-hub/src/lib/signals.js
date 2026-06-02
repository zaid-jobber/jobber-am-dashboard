// Account-change tracking — the ONE source of truth for "what changed" on an
// account. Feeds the Hub "Recent changes" tile, the Worklist ranking, and the
// Pipeline → Signals tab. Tracks changes across many Salesforce/Anchor fields
// (users, quotes, invoices, jobs, clients, GSV, integrations, plan, payments)
// in BOTH directions — spikes are upgrade signals, drops are downgrade/churn risk.
//
// LIVE: Anchor + Salesforce hand the Hub periodic snapshots; on each sync we diff
// new vs previous and emit a change-event per delta. In the demo these derive
// deterministically from the book fields.

// Human labels for every change type (up + down) — used by filter chips.
export const TYPE_LABELS = {
  trial_started: "Trials", users_added: "Users added", quoting_spike: "Quoting spikes",
  invoicing_up: "Invoicing up", jobs_up: "More jobs", clients_up: "Client growth",
  locked_feature: "Locked-feature clicks", plan_change: "Plan changes",
  integration_added: "Integrations added", jpay_volume: "Payment volume",
  users_dropped: "Users removed", jobs_down: "Jobs dropping", invoicing_down: "Invoicing slowing",
  clients_down: "Losing clients", gsv_down: "GSV down",
};

const parseUsers = (s) => { const m = /(\d+)\s*\/\s*(\d+)/.exec(s || ""); return m ? { used: +m[1], limit: +m[2] } : null; };
const isOpp = (a) => !!a.opp; // became an opportunity (open or closed)
const isWonOpp = (a) => a.opp && /closed won/i.test(a.opp.stage || "");
const isLostAcc = (a) => /closed lost|disqualif/i.test(a.upgradeStatus || "") || /closed lost/i.test(a.opp?.stage || "");

// Change-events on one account, newest first.
// Each: { type, label, dir:"up"|"down", factor, icon, title, detail, ageDays, severity:"high"|"med"|"low" }
export function accountChanges(acc) {
  if (!acc) return [];
  const out = [];
  const base = acc.signalAge || 3;
  const q = acc.signals?.quotes30 || 0;
  const inv = acc.signals?.invoices30 || 0;
  const extra = parseUsers(acc.signals?.extraUsers);
  const push = (e) => out.push({ dir: "up", severity: "med", ...e });

  // --- Upgrade signals (positive momentum) ---
  if (acc.trialDaysLeft != null) push({ type: "trial_started", factor: "trial", icon: "Sprout", title: "Trial started", detail: acc.trial || acc.planLabel, ageDays: base, severity: "high" });
  if (acc.usersDelta > 0) push({ type: "users_added", factor: "behavioral", icon: "Users", title: `Added ${acc.usersDelta} user${acc.usersDelta > 1 ? "s" : ""}`, detail: extra ? `now ${extra.used} of ${extra.limit} seats` : "more paid seats", ageDays: base, severity: "high" });
  if (acc.quotedLastDay && q >= 8) push({ type: "quoting_spike", factor: "behavioral", icon: "ListChecks", title: "Quoting spike", detail: `${q} quotes in 30d`, ageDays: base + 1 });
  if (inv >= 40) push({ type: "invoicing_up", factor: "behavioral", icon: "FileText", title: "Invoicing heavily", detail: `${inv} invoices in 30d`, ageDays: base + 2 });
  if (acc.jobsDelta30 >= 5) push({ type: "jobs_up", factor: "behavioral", icon: "ListChecks", title: "More jobs booked", detail: `+${acc.jobsDelta30} jobs vs prior 30d`, ageDays: base + 1 });
  if (acc.clientsDelta30 >= 12) push({ type: "clients_up", factor: "behavioral", icon: "Users", title: "Client base growing", detail: `+${acc.clientsDelta30} clients in 30d`, ageDays: base + 2 });
  if (acc.clickedLockedFeature) push({ type: "locked_feature", factor: "upgradeTag", icon: "Sparkles", title: "Clicked a locked feature", detail: acc.clickedLockedFeature, ageDays: base, severity: "high" });
  if (acc.planChange) push({ type: "plan_change", factor: "easyUpgrade", icon: "ChevronUp", title: "Plan change", detail: `${acc.planChange.from} → ${acc.planChange.to}`, ageDays: acc.planChange.days });
  if (acc.integrationAddedDays != null) push({ type: "integration_added", factor: "easyUpgrade", icon: "Plug", title: "Integration added", detail: "new app connected", ageDays: acc.integrationAddedDays });
  if (/eligible/i.test(acc.jpayStatus || "") && acc.pgpv) push({ type: "jpay_volume", factor: "promo", icon: "CreditCard", title: "Payment volume", detail: `pGPV ${acc.pgpv} — JPay eligible`, ageDays: base + 3 });

  // --- Downgrade / churn-risk signals (drops) ---
  if (acc.usersDelta < 0) push({ type: "users_dropped", dir: "down", factor: "risk", icon: "Users", title: `Removed ${Math.abs(acc.usersDelta)} user${acc.usersDelta < -1 ? "s" : ""}`, detail: "seat count fell — downgrade risk", ageDays: base, severity: "high" });
  if (acc.jobsDelta30 <= -5) push({ type: "jobs_down", dir: "down", factor: "risk", icon: "ListChecks", title: "Job volume dropping", detail: `${acc.jobsDelta30} jobs vs prior 30d`, ageDays: base + 1, severity: "med" });
  if (acc.invoicesDelta30 <= -5) push({ type: "invoicing_down", dir: "down", factor: "risk", icon: "FileText", title: "Invoicing slowing", detail: `${acc.invoicesDelta30} invoices vs prior 30d`, ageDays: base + 2, severity: "med" });
  if (acc.clientsDelta30 <= -10) push({ type: "clients_down", dir: "down", factor: "risk", icon: "Users", title: "Losing clients", detail: `${acc.clientsDelta30} clients in 30d`, ageDays: base + 2, severity: "med" });
  if (acc.gsvTrend === "down") push({ type: "gsv_down", dir: "down", factor: "risk", icon: "TrendingUp", title: "GSV trending down", detail: "lower payment throughput", ageDays: base + 4, severity: "low" });

  return out.sort((a, b) => a.ageDays - b.ageDays);
}

export const hasRecentChange = (acc) => accountChanges(acc).length > 0;

// Global feed across the book, newest first. `dir` / `types` filter optional.
export function changeFeed(accountsMap, { limit = 40, types = null, dir = null } = {}) {
  const items = [];
  for (const acc of Object.values(accountsMap || {})) {
    if (!acc || !acc.id) continue;
    for (const c of accountChanges(acc)) {
      if (types && !types.includes(c.type)) continue;
      if (dir && c.dir !== dir) continue;
      items.push({ ...c, accId: acc.id, name: acc.name, region: acc.region, plan: acc.plan });
    }
  }
  items.sort((a, b) => a.ageDays - b.ageDays);
  return limit ? items.slice(0, limit) : items;
}

// Accounts with a high-severity downgrade/churn-risk change.
export function riskAlerts(accountsMap) {
  const out = [];
  for (const acc of Object.values(accountsMap || {})) {
    const downs = accountChanges(acc).filter((c) => c.dir === "down");
    if (downs.length) out.push({ accId: acc.id, name: acc.name, region: acc.region, plan: acc.plan, changes: downs, top: downs[0], score: downs.reduce((s, c) => s + (c.severity === "high" ? 3 : c.severity === "med" ? 2 : 1), 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}

// Accounts with the strongest positive momentum (most upgrade signals).
export function upgradeMomentum(accountsMap) {
  const out = [];
  for (const acc of Object.values(accountsMap || {})) {
    const ups = accountChanges(acc).filter((c) => c.dir === "up");
    if (ups.length >= 2) out.push({ accId: acc.id, name: acc.name, region: acc.region, plan: acc.plan, changes: ups, count: ups.length });
  }
  return out.sort((a, b) => b.count - a.count);
}

// SELF-LEARNING: which change types most precede an account becoming an
// opportunity. For each change type, conversion rate among accounts that have
// it vs the book's base rate → a lift multiplier. This is what the system
// "learns" about what drives upgrades.
const CHANGE_LABELS = {
  trial_started: "Started a trial", users_added: "Added users", quoting_spike: "Quoting spike",
  invoicing_up: "Invoicing up", jobs_up: "More jobs", clients_up: "Client growth",
  locked_feature: "Clicked a locked feature", plan_change: "Plan change",
  integration_added: "Added an integration", jpay_volume: "Payment volume",
};
export function learningInsights(accountsMap) {
  const accts = Object.values(accountsMap || {}).filter((a) => a && a.id);
  const total = accts.length || 1;
  const baseRate = accts.filter(isOpp).length / total;
  const byType = {};
  for (const acc of accts) {
    const seen = new Set(accountChanges(acc).filter((c) => c.dir === "up").map((c) => c.type));
    for (const t of seen) {
      byType[t] = byType[t] || { type: t, n: 0, opp: 0, won: 0 };
      byType[t].n++; if (isOpp(acc)) byType[t].opp++; if (isWonOpp(acc)) byType[t].won++;
    }
  }
  return Object.values(byType)
    .filter((s) => s.n >= 4 && CHANGE_LABELS[s.type])
    .map((s) => ({ ...s, label: CHANGE_LABELS[s.type], rate: s.opp / s.n, lift: baseRate ? (s.opp / s.n) / baseRate : 0 }))
    .sort((a, b) => b.lift - a.lift);
}

// SELF-LEARNING (downgrade side): which DROP-type changes most precede an
// account being lost (Closed Lost / Disqualified), vs the book's base loss rate.
const RISK_LABELS = { users_dropped: "Users removed", jobs_down: "Job volume dropping", invoicing_down: "Invoicing slowing", clients_down: "Losing clients", gsv_down: "GSV trending down" };
export function riskInsights(accountsMap) {
  const accts = Object.values(accountsMap || {}).filter((a) => a && a.id);
  const total = accts.length || 1;
  const baseRate = accts.filter(isLostAcc).length / total;
  const byType = {};
  for (const acc of accts) {
    const seen = new Set(accountChanges(acc).filter((c) => c.dir === "down").map((c) => c.type));
    for (const t of seen) {
      byType[t] = byType[t] || { type: t, n: 0, lost: 0 };
      byType[t].n++; if (isLostAcc(acc)) byType[t].lost++;
    }
  }
  return Object.values(byType)
    .filter((s) => s.n >= 4 && RISK_LABELS[s.type])
    .map((s) => ({ ...s, label: RISK_LABELS[s.type], rate: s.lost / s.n, lift: baseRate ? (s.lost / s.n) / baseRate : 0 }))
    .sort((a, b) => b.lift - a.lift);
}
