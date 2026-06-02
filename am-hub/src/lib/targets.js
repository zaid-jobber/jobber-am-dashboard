// Adaptive daily targets. The monthly REVENUE goal is the fixed anchor
// (quota × stretch%); daily activity (dials/opps/etc.) are RECOMMENDATIONS
// derived from what's left, days remaining, and the AM's conversion rates.
// Higher ASP/close rate → fewer dials/opps needed. Rates default here, but will
// come from real Performance data once it's wired.
const DEFAULT_RATES = { asp: 185, winRate: 0.38, connectRate: 0.31, oppPerConnect: 0.32 };

// Rates used to project a full month of targets from the revenue anchors.
// jpayAsp = avg JPay MRR per enablement; talkPerConnect = avg minutes per connect.
const PROJ_RATES = { asp: 185, winRate: 0.38, connectRate: 0.31, oppPerConnect: 0.32, jpayAsp: 95, jpayWinRate: 0.42, talkPerConnect: 12, smsPerDial: 0.5 };

// Pull learned rates out of a computePerformance() result (falls back to defaults).
export function ratesFromPerf(P) {
  if (!P) return {};
  const r = {};
  if (P.asp) r.asp = P.asp;
  if (P.winRate) r.winRate = P.winRate / 100;
  if (P.connRate) r.connectRate = P.connRate / 100;
  return r;
}

// Given the revenue anchors an AM is handed (Upsell MRR + optional JPay MRR),
// project the rest of the monthly targets: opps created/won (split upsell/jpay),
// dials, SMS, talk time. Editable defaults — the AM can override any number.
export function projectMonthTargets({ upsellMRR = 0, jpayMRR = 0, trackJpay = true, rates = {} } = {}) {
  const r = { ...PROJ_RATES, ...rates };
  const cwOppsUpsell = Math.max(0, Math.round(upsellMRR / r.asp));
  const createdOppsUpsell = Math.max(0, Math.round(cwOppsUpsell / r.winRate));
  const cwOppsJpay = trackJpay ? Math.max(0, Math.round(jpayMRR / r.jpayAsp)) : 0;
  const createdOppsJpay = trackJpay ? Math.max(0, Math.round(cwOppsJpay / r.jpayWinRate)) : 0;
  const createdTotal = createdOppsUpsell + createdOppsJpay;
  const connects = r.oppPerConnect ? createdTotal / r.oppPerConnect : 0;
  const dials = Math.round(r.connectRate ? connects / r.connectRate : 0);
  const sms = Math.round(dials * r.smsPerDial);
  const talk = Math.round(connects * r.talkPerConnect); // total minutes for the month
  return { cwOppsUpsell, createdOppsUpsell, cwOppsJpay, createdOppsJpay, dials, sms, talk };
}

// The active month's targets: the AM's entered set if confirmed, otherwise a
// projection anchored on the legacy quota so the dashboard always has numbers.
// `expRev` is the RAW assigned target (the number the AM was given). Stretch is
// applied separately at the goal level (see goalFromTargets) so Settings, the
// Hub and Performance all compute the same "to goal" number.
export function activeTargets(settings = {}, P = null, key) {
  const k = key || `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
  const mt = settings.monthlyTargets?.[k];
  if (mt?.entered) return { ...mt, key: k, source: "entered" };
  const expRev = Math.round(settings.quota || 0);
  const upsellMRR = Math.round(expRev * 0.66);
  const jpayMRR = settings.trackJpay ? Math.round(expRev * 0.34) : 0;
  const proj = projectMonthTargets({ upsellMRR, jpayMRR, trackJpay: settings.trackJpay !== false, rates: ratesFromPerf(P) });
  return { key: k, source: "projected", expRev, upsellMRR, jpayMRR, ...proj };
}

// The single source of truth for the monthly goal: the assigned revenue target
// scaled by the AM's stretch %. trackJpay off → goal is Upsell MRR only.
export function goalFromTargets(settings = {}, AT = null) {
  const t = AT || activeTargets(settings);
  const base = settings.trackJpay !== false ? (t.expRev || 0) : (t.upsellMRR || 0);
  return Math.round(base * ((settings.stretch || 100) / 100));
}

// Pace check: are you ahead/behind where you "should" be by now, and what's
// the catch-up rate? expected = goal × (selling days elapsed / total).
export function pacing({ goal, booked, daysLeft, daysTotal, rates }) {
  const r = { ...DEFAULT_RATES, ...(rates || {}) };
  const total = Math.max(1, daysTotal || daysLeft);
  const dl = Math.max(1, daysLeft);
  const elapsed = Math.max(0, total - dl);
  const expected = goal * (elapsed / total);
  const delta = Math.round(booked - expected);      // + ahead, − behind
  const remaining = Math.max(0, goal - booked);
  const perDay = Math.round(remaining / dl);          // $/day to finish
  const oppsPerDay = Math.max(0, Math.ceil(remaining / r.asp / r.winRate / dl));
  const status = delta >= 0 ? "ahead" : "behind";
  return { status, delta: Math.abs(delta), expected: Math.round(expected), perDay, oppsPerDay };
}

export function computeTargets({ goal, booked, daysLeft, rates }) {
  const r = { ...DEFAULT_RATES, ...(rates || {}) };
  const dl = Math.max(1, daysLeft);
  const remaining = Math.max(0, goal - booked);
  const pct = goal ? Math.min(100, Math.round((booked / goal) * 100)) : 0;

  const salesPerDay = remaining / r.asp / dl;            // upgrades/enablements per day
  const oppsPerDay = salesPerDay / r.winRate;            // opps needed to close that
  const connectsPerDay = oppsPerDay / r.oppPerConnect;   // convos to create those opps
  const dialsPerDay = connectsPerDay / r.connectRate;    // dials to get those convos

  const ceil = (n, cap) => Math.min(cap, Math.max(0, Math.ceil(n)));
  return {
    goal, booked, remaining, pct, daysLeft: dl,
    rec: {
      dials: ceil(dialsPerDay, 120),
      sms: ceil(dialsPerDay * 0.5, 60),
      talk: ceil(oppsPerDay * 15, 240), // ~15 min per opp convo
      opps: ceil(oppsPerDay, 20),
    },
  };
}
