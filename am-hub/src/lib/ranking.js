// Worklist ranking engine — the core differentiator.
// Builds ONE unified, scored list (no buckets). Each account gets a score from
// the AM's stated priority factors, multiplied by a per-AM *learning weight*
// layer so the order personalizes over time. Time-of-day + weather are inputs
// to the single ranking (not separate sort modes).
//
// Priority order (AM's words): trials → behavioral changes → easy upgrades →
// new accounts → upgrade tags → industry promo → NBA.

// Base points per factor. Learning weights (settings.rankWeights) scale these.
export const RANK_FACTORS = {
  followup:    { base: 95,  label: "Follow-up date today" },
  trial:       { base: 100, label: "Active trial" },
  behavioral:  { base: 70,  label: "Behavioral spike" },
  easyUpgrade: { base: 55,  label: "Easy upgrade" },
  newAccount:  { base: 45,  label: "New to your book" },
  upgradeTag:  { base: 40,  label: "Clicked a locked feature" },
  promo:       { base: 30,  label: "Industry promo live" },
  nba:         { base: 25,  label: "Next Best Action" },
};
export const DEFAULT_WEIGHTS = Object.fromEntries(Object.keys(RANK_FACTORS).map((k) => [k, 1]));

const OUTDOOR = /hvac|landscap|roof|paint|pest|snow|lawn|exterior/i;

// Prime calling windows: mid-morning + late afternoon, in the account's LOCAL time.
function inCallWindow(h) {
  return (h >= 8 && h < 11) || (h >= 16 && h < 18);
}
// Business hours you can reasonably dial.
function inBusinessHours(h) {
  return h >= 8 && h < 19;
}

// Return { score, factors:[{key,pts,reason}], why } for one account.
export function scoreAccount(a, ctx = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...(ctx.weights || {}) };
  const regionHours = ctx.regionHours || {}; // { ET: 21, PT: 18, ... } current local hour per region
  const rain = ctx.rainZones || []; // ["ET","CT"...]
  const jpayOn = ctx.jpayOn !== false;
  const factors = [];
  const add = (key, pts, reason) => factors.push({ key, pts: Math.round(pts), reason });

  // 0. Follow-up date is TODAY — a commitment that surfaces the account
  // regardless of cadence (the component force-includes these too).
  if (a.followDueToday) add("followup", RANK_FACTORS.followup.base * w.followup, "follow-up scheduled today");

  // 1. Trial — highest. Urgency ramps as the trial nears its end.
  const trialDays = trialDaysLeft(a);
  if (trialDays != null) {
    const urgency = Math.max(0, 6 - trialDays) * 6; // ends sooner → more points
    add("trial", (RANK_FACTORS.trial.base + urgency) * w.trial,
      trialDays <= 0 ? "trial ends today — convert now" : `trial ends in ${trialDays}d`);
  }

  // 2. Behavioral spike — users added or heavy quoting in the last day(s).
  if (a.usersAddedRecently) add("behavioral", RANK_FACTORS.behavioral.base * w.behavioral, "added users this week");
  else if (a.quotedLastDay && (a.signals?.quotes30 || 0) >= 8) add("behavioral", (RANK_FACTORS.behavioral.base - 12) * w.behavioral, "quoting heavily right now");

  // 3. Easy upgrade — small team near a limit, high quoter, or active Core.
  const extra = parseExtraUsers(a.signals?.extraUsers);
  const q30 = a.signals?.quotes30 || 0;
  if (extra && extra.used <= extra.limit && extra.limit - extra.used <= 1 && a.plan !== "Plus")
    add("easyUpgrade", RANK_FACTORS.easyUpgrade.base * w.easyUpgrade, `${extra.used}/${extra.limit} users — one seat from the limit`);
  else if (q30 >= 12 && a.plan !== "Plus")
    add("easyUpgrade", (RANK_FACTORS.easyUpgrade.base - 8) * w.easyUpgrade, `${q30} quotes/30d — quoting hard`);
  else if (a.plan === "Core" && (a.signals?.invoices30 || 0) >= 25)
    add("easyUpgrade", (RANK_FACTORS.easyUpgrade.base - 15) * w.easyUpgrade, "Core with above-average activity");

  // 4. New account assigned to me.
  if (a.assignedDaysAgo != null && a.assignedDaysAgo <= 7)
    add("newAccount", RANK_FACTORS.newAccount.base * w.newAccount, `assigned ${a.assignedDaysAgo}d ago`);

  // 5. Upgrade tag — SP clicked a locked / upgraded feature.
  if (a.clickedLockedFeature)
    add("upgradeTag", RANK_FACTORS.upgradeTag.base * w.upgradeTag, `clicked ${a.clickedLockedFeature}`);

  // 6. Industry promo live for this account's industry.
  if (a.industryPromo)
    add("promo", RANK_FACTORS.promo.base * w.promo, `${a.industryPromo} promo for ${a.industry}`);

  // 7. NBA model target.
  if (a.nba)
    add("nba", RANK_FACTORS.nba.base * w.nba, `NBA ${a.nba}`);

  // JPay-only signal folds into promo when JPay tracking is on.
  if (jpayOn && /eligible/i.test(a.jpayStatus || "") && (a.signals?.creditVol || a.pgpv))
    add("promo", 18 * w.promo, "JPay-eligible with card volume");

  let score = factors.reduce((s, f) => s + f.pts, 0);

  // Context inputs fold into the SINGLE ranking (not separate sorts). The list
  // is time-aware: a call-due account is boosted in its local call window, kept
  // neutral during business hours, and pushed DOWN once it's too late to dial.
  const lh = regionHours[a.region];
  const notes = []; // { up, txt }
  let ctxBonus = 0;
  if (a.callDueToday && lh != null) {
    if (inCallWindow(lh)) { ctxBonus += 18; notes.push({ up: true, txt: `best call window now (${a.region} ${fmtHour(lh)})` }); }
    else if (inBusinessHours(lh)) { ctxBonus += 4; }
    else { ctxBonus -= 40; notes.push({ up: false, txt: `after hours in ${a.region} — text now or call tomorrow` }); }
  }
  if (rain.includes(a.region) && OUTDOOR.test(a.industry || "")) { ctxBonus += 12; notes.push({ up: true, txt: `rain in ${a.region} — more likely to pick up` }); }
  score += ctxBonus;

  // Build the human "why this rank" line from the top factor + context notes.
  const top = [...factors].sort((x, y) => y.pts - x.pts)[0];
  const parts = [top?.reason ? { up: true, txt: top.reason } : null, ...notes].filter(Boolean).slice(0, 2);
  const why = parts.map((p) => `${p.up ? "↑" : "↓"} ${p.txt}`).join("  ");

  return { score, factors, notes, why, whyParts: parts };
}

// Rank a list of account objects. Returns the same list sorted desc by score,
// each annotated with { _score, _factors, _why }. Zero-score accounts keep a
// floor so brand-new untouched accounts still appear (fill-to-goal handles them).
export function rankAccounts(accts, ctx = {}) {
  return accts
    .map((a) => { const r = scoreAccount(a, ctx); return { ...a, _score: r.score, _factors: r.factors, _why: r.why, _whyParts: r.whyParts, _notes: r.notes }; })
    .sort((a, b) => b._score - a._score);
}

// --- helpers ---
function trialDaysLeft(a) {
  if (a.trialDaysLeft != null) return a.trialDaysLeft;
  const m = /ends in (\d+)\s*d/i.exec(a.trial || "");
  if (m) return +m[1];
  if (/trial/i.test(a.trial || a.planLabel || "")) return 3;
  return null;
}
function parseExtraUsers(s) {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(s || "");
  return m ? { used: +m[1], limit: +m[2] } : null;
}
function fmtHour(h) { const ap = h >= 12 ? "p" : "a"; const hr = h % 12 || 12; return `${hr}${ap}`; }
