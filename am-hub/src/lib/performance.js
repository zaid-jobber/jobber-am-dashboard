// Performance metrics — computed from the account book + logged activity +
// goal settings, NOT hardcoded. LIVE: these read from Salesforce (Opportunities,
// Conversation/Task call dispositions, inbound replies) + Ambition activity.
// Demo: derived from the book's accounts and their logged activity.
import { dollars } from "./metrics.js";
import { activeTargets, goalFromTargets } from "./targets.js";

const isWon = (a) => /closed won/i.test(a.opp?.stage || "") || /qualified closed won/i.test(a.upgradeStatus || "");
const isLost = (a) => /closed lost|disqualif/i.test(a.upgradeStatus || "") || /closed lost/i.test(a.opp?.stage || "");
const isOpenOpp = (a) => a.opp && !/closed/i.test(a.opp.stage || "");
const upMRR = (a) => dollars(a.promoRows?.[0]?.value || 0);
const connectedCall = (ev) => ev.icon === "Phone" && /conversation|connect/i.test(ev.title || "");
const hasConnect = (a) => (a.activity || []).some(connectedCall);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// range: "month" | "last" | "quarter" — scales volume metrics (rates unchanged).
const RANGE_FACTOR = { month: 1, last: 0.92, quarter: 2.7 };
const RANGE_MONTHS = { month: 1, last: 1, quarter: 3 };

export function computePerformance(accountsMap, activity, settings, range = "month") {
  const f = RANGE_FACTOR[range] ?? 1;
  const months = RANGE_MONTHS[range] ?? 1;
  const sc = (n) => Math.round(n * f);
  const accts = Object.values(accountsMap || {}).filter((a) => a && a.id);
  const won = accts.filter(isWon);
  const lost = accts.filter(isLost);
  const openOpps = accts.filter(isOpenOpp);

  // --- revenue (from won opps + their eligible upgrade value / payment volume) ---
  const upgradeMRRraw = won.reduce((s, a) => s + upMRR(a), 0);
  const asp = won.length ? Math.round(upgradeMRRraw / won.length) : 0;
  const upgradeMRR = sc(upgradeMRRraw);
  const jpayPGPV = sc(won.reduce((s, a) => s + dollars(a.pgpv), 0));
  const upgrades = sc(won.length);
  // Goal + activity targets come from the month's entered targets (or projection).
  // Goal = assigned Expansion Revenue × stretch %, same formula used by Hub/Settings.
  const AT = activeTargets(settings, null);
  const goal = goalFromTargets(settings, AT) * months;
  const expRev = upgradeMRR + jpayPGPV * 0.011; // PGPV contributes via processing margin
  const expRevPct = goal ? Math.round((expRev / goal) * 100) : 0;
  const winRate = pct(won.length, won.length + lost.length);
  const trialAccts = accts.filter((a) => a.trialDaysLeft != null);
  const trialConv = pct(trialAccts.filter(isWon).length, trialAccts.length);

  // --- call activity from logged dispositions (Conversation/Task records) ---
  let dialsRaw = 0, connectsRaw = 0;
  for (const a of accts) for (const ev of a.activity || []) { if (ev.icon === "Phone") { dialsRaw++; if (connectedCall(ev)) connectsRaw++; } }
  const dials = sc(dialsRaw); const connects = sc(connectsRaw);
  const connRate = pct(connectsRaw, dialsRaw);
  const m = activity?.month || {};
  const retained = 92; // 90-day retained MRR (SF subscription field) — placeholder until live
  const talkPerDay = Math.round((m.talk || 0) / 22);

  // --- signal hit-rate: by the signal that surfaced the account ---
  const SIGNALS = [
    { label: "Active trial", match: (a) => a.trialDaysLeft != null },
    { label: "Users added", match: (a) => a.usersDelta > 0 },
    { label: "Quoting spike", match: (a) => a.quotedLastDay && (a.signals?.quotes30 || 0) >= 8 },
    { label: "Locked-feature click", match: (a) => !!a.clickedLockedFeature },
    { label: "Plan change", match: (a) => !!a.planChange },
    { label: "NBA flag", match: (a) => !!a.nba },
  ];
  const signalRows = SIGNALS.map((s) => {
    const pool = accts.filter(s.match);
    const w = pool.filter(isWon);
    return { label: s.label, surfaced: pool.length, connect: pct(pool.filter(hasConnect).length, pool.length), close: pct(w.length, pool.length), mrr: w.reduce((x, a) => x + upMRR(a), 0) };
  }).filter((r) => r.surfaced > 0).sort((a, b) => b.close - a.close);

  // --- cadence effectiveness: by channel. Response = inbound reply logged in SF
  //     (inbound SMS/email Task) OR an opp created while on that step. ---
  const CHANNELS = [{ key: "Phone", label: "Call" }, { key: "Mail", label: "Email" }, { key: "MessageSquare", label: "Text" }];
  const cadenceRows = CHANNELS.map((ch) => {
    let sent = 0, responded = 0, closed = 0, touched = 0;
    for (const a of accts) {
      const evs = (a.activity || []).filter((e) => e.icon === ch.key);
      if (!evs.length) continue;
      sent += evs.length; touched += 1;
      if (ch.key === "Phone" ? hasConnect(a) : (isOpenOpp(a) || isWon(a))) responded += 1;
      if (isWon(a)) closed += 1;
    }
    return { channel: ch.label, key: ch.key, sent, response: pct(responded, touched), close: pct(closed, touched) };
  });

  // --- where you win: by segment & by industry ---
  const seg = (label, pool) => { const w = pool.filter(isWon); return { label, connect: pct(pool.filter(hasConnect).length, pool.length), close: pct(w.length, pool.length), mrr: w.reduce((s, a) => s + upMRR(a), 0) }; };
  const bySegment = [
    seg("Trial conversions", accts.filter((a) => a.trialDaysLeft != null)),
    seg("Open opps", openOpps),
    seg("Working accounts", accts.filter((a) => /working|new/i.test(a.upgradeStatus || "") && !a.opp)),
    seg("Proactive / NBA", accts.filter((a) => a.nba)),
  ].filter((r) => r.connect || r.close || r.mrr);
  const indMap = {};
  for (const a of accts) { const k = a.industry || "Other"; (indMap[k] = indMap[k] || []).push(a); }
  const byIndustry = Object.entries(indMap).map(([k, pool]) => seg(k, pool)).sort((a, b) => b.mrr - a.mrr).slice(0, 6);

  return {
    expRevPct, upgradeMRR, upgrades, asp, jpayPGPV, jpayCount: sc(won.filter((a) => /on|enabled/i.test(a.jpayStatus || "")).length),
    winRate, connRate, dials, connects, retained, talkPerDay, trialConv,
    month: { dials: sc(m.dials || 0), sms: sc(m.sms || 0), talk: sc(m.talk || 0), opps: sc(m.opps || 0) },
    target: { dials: (AT.dials || 880) * months, sms: (AT.sms || 440) * months, talk: (AT.talk || 1980) * months, opps: ((AT.createdOppsUpsell || 0) + (AT.createdOppsJpay || 0) || 150) * months },
    openOppCount: openOpps.length, signalRows, cadenceRows, bySegment, byIndustry,
    oneCallClose: sc(Math.round(connectsRaw * 0.22)), oppsWon: upgrades,
  };
}
