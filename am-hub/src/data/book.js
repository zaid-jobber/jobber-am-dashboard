// The unified demo book of accounts. ONE source of truth — the Worklist ranks
// it, the Pipeline groups it by stage, and the Account view reads it by id.
// Deterministic so the demo is stable. Replaced by the live Salesforce book
// once the Connected App is granted.
import { C, patternFor } from "../lib/cadences.js";

const ADJ = ["Summit", "Coastal", "Valley", "Pioneer", "Bright", "Maple", "Cedar", "Granite", "Harbor", "Prairie", "Sunrise", "Ironwood", "Birch", "Copper", "Willow", "Stonebridge", "Riverstone", "Oakfield", "Northwind", "Lakeview", "Redwood", "Silverline", "Hillcrest", "Brookside"];
const IND = ["HVAC", "Plumbing", "Landscaping", "Cleaning", "Roofing", "Painting", "Electrical", "Pest Control", "Handyman", "Moving"];
const REG = ["ET", "CT", "MT", "PT", "AT"];
const CITY = { ET: "Atlanta, GA", CT: "Chicago, IL", MT: "Denver, CO", PT: "Seattle, WA", AT: "Halifax, NS" };
const NAMES = ["Marcus Reed", "Dana Wills", "Sam Carter", "Priya Shah", "Tom Becker", "Alex Nguyen", "Jordan Lee", "Casey Brooks", "Morgan Hayes", "Riley Stone"];

// Pool of cadences synthetic accounts can be in (JPay filtered at read-time).
const POOL = ["EXP - General Outbound Cadence", "EXP - Quoters by Usage", "EXP - Plus Prospecting", "EXP - Accounts with Paid Users", "EXP - NBA Accounts", "EXP - Grow Trial", "EXP - Connect Trial", "EXP - Opp Recommendation Follow-Up", "EXP - Jobber Payments"];

export function genAccount(i, pool = POOL) {
  const h = (i * 2654435761) >>> 0;
  const region = REG[i % REG.length];
  const plan = i % 3 === 0 ? "Core" : i % 3 === 1 ? "Connect" : "Grow";
  const ind = IND[(i * 3) % IND.length];
  const noCadence = i % 7 === 2; // ~14% need a cadence
  const cadName = pool[i % pool.length];
  const pat = patternFor(cadName);
  const callIdx = pat.map((ch, idx) => (ch.includes(C) ? idx : -1)).filter((x) => x >= 0);
  const wantCall = i % 4 !== 0;
  const stepIdx = noCadence ? 0 : wantCall ? callIdx[i % callIdx.length] : i % pat.length;
  const step = stepIdx + 1;
  const isTrial = /Trial/.test(cadName);
  const tier = cadName.includes("Grow") ? "Grow" : "Connect";
  // Account upgrade status uses the real SF picklist; an Opportunity (with its
  // own SF stage) drives the Pipeline opp columns. Working/New stay account-only.
  const won = i % 23 === 0;
  const r = i % 12;
  const oppName = `${ADJ[i % ADJ.length]} ${ind} — ${plan === "Core" ? "Connect" : plan === "Connect" ? "Grow" : "Plus"} upgrade`;
  const oppMeta = { name: oppName, ageDays: 2 + (h % 40) };
  let status = "Working"; let opp = null;
  if (noCadence) status = "New";
  else if (won) { status = "Qualified Closed Won"; opp = { stage: "Closed Won", ...oppMeta }; }
  else if (r === 9) { status = "Qualified Closed Lost"; opp = { stage: "Closed Lost", ...oppMeta }; }
  else if (r === 1 || r === 6) { status = "Qualified Open Opp"; opp = { stage: "Discovery", ...oppMeta }; }
  else if (r === 4 || r === 10) { status = "Qualified Open Opp"; opp = { stage: "Evaluating", ...oppMeta }; }
  else if (r === 7) status = "Disqualified";
  const followToday = i % 16 === 7 || (won && i % 2 === 0);
  return {
    id: `acc-${i}`, name: `${ADJ[i % ADJ.length]} ${ind}`, contact: NAMES[i % NAMES.length],
    plan, industry: ind, region, city: CITY[region], phone: `(555) ${200 + (h % 700)}-${1000 + (h % 9000)}`,
    tenure: `${1 + (h % 5)}.${h % 9} yrs`, billing: h % 2 ? "Monthly" : "Annual", upgradeStatus: status, opp,
    jpayStatus: i % 3 === 0 ? "On by default" : "Eligible", upgradeProbability: 35 + (h % 55),
    nba: cadName === "EXP - NBA Accounts" ? (i % 2 ? "→ Grow" : "→ Plus") : null,
    trial: isTrial ? `${tier} trial · ends in ${1 + (i % 5)}d` : undefined,
    planLabel: isTrial ? `${tier} · trial` : undefined,
    totalMRR: `$${250 + (h % 500)}`, gsv: `$${100 + (h % 700)}k`, avgInvoice: `$${400 + (h % 1100)}`, pgpv: `$${8 + (h % 55)}k`,
    signals: { extraUsers: `${1 + (h % 4)} / ${2 + (h % 4)}`, quotes30: 3 + (h % 45), invoices30: 8 + (h % 55), activeSms60: h % 45, activeEmail60: h % 38, integrations: h % 4, creditVol: `${20 + (h % 65)}%` },
    cadence: noCadence ? null : { name: cadName, step, due: `Step ${step} due today` },
    assignedDaysAgo: i % 9 === 3 ? i % 7 : null,
    usersAddedRecently: i % 11 === 4,
    quotedLastDay: i % 5 === 0,
    clickedLockedFeature: i % 8 === 5 ? ["Advanced Quoting", "Two-Way SMS", "Job Costing", "Quote add-ons"][i % 4] : null,
    industryPromo: i % 6 === 0 ? "Spring Trades" : null,
    trialDaysLeft: isTrial ? 1 + (i % 5) : null,
    // Account-change signals (Anchor/SF deltas) — feed Hub tiles, Worklist ranking
    // and the Signals feed. `*Days` = how recently the change was detected.
    planChange: i % 9 === 4 ? { from: plan === "Grow" ? "Connect" : "Core", to: plan, days: 1 + (h % 12) } : null,
    integrationAddedDays: i % 10 === 3 ? 1 + (h % 9) : null,
    signalAge: 1 + (h % 9),
    // Usage metrics + recent Anchor/SF deltas (drive the Signals tab: spikes are
    // upgrade signals, drops are downgrade/churn alerts).
    clients: 8 + (h % 380),
    jobs30: 4 + (h % 90),
    usersDelta: noCadence ? 0 : i % 11 === 4 ? 1 + (i % 2) : i % 17 === 9 ? -(1 + (i % 2)) : 0,
    clientsDelta30: ((h % 11) - 5) * 3,
    jobsDelta30: ((h >> 3) % 13) - 6,
    invoicesDelta30: ((h >> 5) % 15) - 6,
    gsvTrend: h % 4 === 0 ? "down" : "up",
    followUpDate: followToday ? new Date().toISOString() : null,
    website: i % 4 !== 0 ? `https://www.${ADJ[i % ADJ.length].toLowerCase()}${ind.toLowerCase().replace(/[^a-z]/g, "")}.com` : null,
    // Salesforce-synced notes (read-only) — surfaced in the account Notes section.
    notes: [
      { title: "Upgrade note", by: "Salesforce", when: `${2 + (h % 20)}d`, text: `Owner showed interest in ${["advanced quoting", "Two-Way SMS", "more team users", "online booking"][i % 4]}. Circle back after ${["their busy season", "month-end", "the trial ends"][i % 3]}.` },
      ...(i % 3 !== 0 ? [{ title: "JPay note", by: "Salesforce", when: `${1 + (h % 15)}d`, text: `Processing ~$${20 + (h % 60)}k/mo through another provider; ${["open to switching", "wants lower rates", "needs deposits enabled"][i % 3]}.` }] : []),
    ],
    promoTag: "30% × 3 months",
    promoRows: [
      { label: `Upgrade ${plan}`.trim(), value: `~$${180 + (h % 220)}`, unit: "/mo", was: "ACBM" },
      { label: "+ JPay (SPIF)", value: "Two-For", was: "+ card readers" },
    ],
    activity: noCadence
      ? [{ icon: "Phone", title: "No activity yet", sub: "New to your book", when: "—" }]
      : [
        { icon: "Phone", title: i % 2 ? "Call Conversation" : "Call Left Voicemail", sub: i % 2 ? "Reached owner — agreed to a follow-up" : "No answer, left VM", when: `${1 + (h % 5)}d`, recording: i % 2 ? "#" : null, body: i % 2 ? "Connected. Owner interested in advanced quoting; circle back this week." : "Left voicemail referencing their trial." },
        { icon: "Mail", title: "Email", sub: "Value recap sent", when: `${3 + (h % 6)}d`, body: "Sent a recap of Grow features tied to their quoting volume." },
        { icon: "MessageSquare", title: "SMS", sub: "Two-Way SMS tip", when: `${5 + (h % 7)}d`, body: "Quick text nudging them to try Two-Way SMS." },
      ],
  };
}

// The full book as an id→account map (default ~96 accounts).
export function generateBook(n = 96) {
  const map = {};
  for (let i = 1; i <= n; i++) { const a = genAccount(i); map[a.id] = a; }
  return map;
}
