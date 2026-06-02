// Mock data layer — shapes mirror the eventual Salesforce/Anchor/Ambition model.
// Swap these for real adapters later; pages read only from here.

export const profile = {
  name: "Zaid Farooqui",
  initials: "ZF",
  role: "Account Manager · Expansion",
  email: "zaid.f@getjobber.com",
  region: "Pacific (PT)",
  hours: "6am–4pm",
  level: "L3",
  peopleLeader: "S. Walker",
  oooBuddy: "L. Levesque",
  accountsOwned: 312,
  working: 75,
  openOpps: 12,
};

export const hub = {
  greeting: "Good morning, Zaid",
  date: "Thursday, May 22",
  sellingDaysLeft: 7,
  booked: 5200, // Total Expansion Revenue booked MTD ($)
  target: {
    pct: 78,
    upgradeMRR: { val: "$2.1k", goal: "$2.5k", pct: 46 },
    pgpv: { val: "$41k", goal: "$57k", pct: 32 },
    winRate: "38%",
  },
  goals: [
    { key: "dials", icon: "Phone", label: "Dials", val: 28, goal: 40, pct: 70 },
    { key: "sms", icon: "MessageSquare", label: "SMS", val: 14, goal: 20, pct: 70, color: "lime" },
    { key: "talk", icon: "Clock", label: "Talk time", val: "52", goal: "90m", pct: 58 },
    { key: "opps", icon: "GitPullRequestArrow", label: "Opps", val: 5, goal: 8, pct: 62, color: "green" },
  ],
  spif: { name: "May SPIF · JPay enablements", note: "$250 + leaderboard · ends today · 4 to go", progress: 6, total: 10, pct: 60 },
  slack: [
    { icon: "Target", tone: "lead", channel: "#sales-critical", title: "Lead routed to you — Apex HVAC", sub: "@expansion-team · wants to upgrade", when: "7:05a" },
    { icon: "AlertTriangle", tone: "warn", channel: "#war_room", title: "Payments deposit delay — resolved", sub: "Affected JPay accounts", when: "6:50a" },
    { icon: "Megaphone", channel: "#announce-product_updates", title: "AI Receptionist GA on Plus", sub: "New Grow → Plus angle", when: "Yest" },
    { icon: "Trophy", channel: "#announce-expansion", title: "May leaderboard — you're #3", sub: "+ Promos canvas", when: "Yest" },
  ],
  weather: {
    lead: "Raining in ET & CT — prime day to call your landscaping & irrigation accounts (18 in your book)",
    zones: [
      { z: "ET", icon: "CloudRain", t: "54°", hot: true },
      { z: "CT", icon: "CloudRain", t: "58°", hot: true },
      { z: "MT", icon: "Cloud", t: "61°" },
      { z: "PT", icon: "Sun", t: "67°" },
      { z: "AT", icon: "CloudRain", t: "49°", hot: true },
    ],
    targets: [
      { icon: "Sprout", n: 9, label: "ET landscaping" },
      { icon: "Droplets", n: 6, label: "CT irrigation" },
      { icon: "Scissors", n: 3, label: "AT lawn care" },
      { icon: "ListChecks", n: 18, label: "bumped up your list", navy: true },
    ],
  },
  recent: [
    { tone: "a", icon: "AlertTriangle", name: "Greenline Landscaping", sub: "Grace period — auto-upgrade 5d · GSV ↑ 22%", when: "2h" },
    { tone: "b", icon: "Clock", name: "Apex HVAC", sub: "Grow trial started — ends in 2 days", when: "5h" },
    { tone: "c", icon: "CreditCard", name: "Coastal Painting", sub: "JPay → Verifying · first deposit pending", when: "1d" },
    { tone: "d", icon: "Sparkles", name: "Northside Cleaning", sub: "NBA flag → Grow (top 10%)", when: "1d" },
  ],
  schedule: [
    { tm: "9:00a", tone: "navy", title: "Upgrade call — Riverside Turf", sub: "Connect → Grow · Advanced Quoting" },
    { tm: "11:00a", tone: "soft", title: "Team pipeline sync", sub: "Busy — no calls here" },
    { tm: "1:30p", tone: "lime", title: "JPay onboarding — Peak Plumbing", sub: "Hosted onboarding walkthrough" },
    { tm: "4:00p", tone: "navy", title: "1:1 with S. Walker", sub: "Weekly manager check-in" },
  ],
  inbox: [
    { av: "g1", from: "RT", subject: "Re: Quoting limits on Connect", sub: 'Riverside Turf — "hop on a call?"', unread: true },
    { av: "g2", from: "PP", subject: "Payments not depositing?", sub: "Peak Plumbing Co", star: true },
    { av: "g3", from: "BH", subject: "Re: Annual plan pricing", sub: "Bright Home — replied to quote", when: "Yest" },
  ],
  week: [44, 58, 39, 61, 52], // dials per weekday (Mon–Fri)
  month: { label: "May", dials: 612, sms: 280, talk: "28h", opps: 118, toTarget: 78 },
};

export const quotes = [
  { t: "Approach each customer with the idea of helping them solve a problem.", a: "Brian Tracy" },
  { t: "Success is the sum of small efforts repeated day in and day out.", a: "Robert Collier" },
  { t: "Don't watch the clock; do what it does. Keep going.", a: "Sam Levenson" },
  { t: "The harder the conflict, the greater the triumph.", a: "George Washington" },
  { t: "Make a customer, not a sale.", a: "Katherine Barchetti" },
  { t: "Opportunities don't happen. You create them.", a: "Chris Grosser" },
  { t: "Every sale has five obstacles: no need, no money, no hurry, no desire, no trust.", a: "Zig Ziglar" },
  { t: "Your attitude, not your aptitude, will determine your altitude.", a: "Zig Ziglar" },
  { t: "Win the morning, win the day.", a: "Tim Ferriss" },
  { t: "Selling is essentially a transfer of feelings.", a: "Zig Ziglar" },
];
export const quoteOfDay = () => {
  const day = Math.floor(Date.now() / 86400000);
  return quotes[day % quotes.length];
};

// ---- accounts (keyed by id) ----
// Detail-panel defaults so every account renders a full cockpit in the Worklist
// (real values arrive from Salesforce). Existing hand-authored fields win.
const _hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function enrich(a) {
  const h = _hash(a.id);
  return {
    contact: "Owner",
    phone: `(555) ${String(100 + (h % 900))}-${String(1000 + (h % 9000))}`,
    tenure: `${1 + (h % 5)}.${h % 9} yrs`,
    billing: h % 2 ? "Monthly" : "Annual",
    totalMRR: `$${200 + (h % 600)}`,
    gsv: `$${100 + (h % 900)}k`,
    avgInvoice: `$${300 + (h % 1500)}`,
    pgpv: `$${10 + (h % 70)}k`,
    upgradeProbability: 40 + (h % 50),
    signals: { extraUsers: `${1 + (h % 4)} / ${2 + (h % 4)}`, quotes30: 5 + (h % 40), invoices30: 10 + (h % 60), activeSms60: h % 50, activeEmail60: h % 40, integrations: h % 4, creditVol: `${20 + (h % 70)}%` },
    cadence: { name: a.nba && /plus/i.test(a.nba) ? "EXP - Plus Prospecting" : a.nba ? "EXP - Quoters by Usage" : "EXP - General Outbound Cadence", step: 1 + (h % 5), due: "Step due today" },
    promoTag: "30% × 3 months",
    promoRows: [{ label: `Upgrade ${a.plan || ""}`.trim(), value: `~$${150 + (h % 200)}`, unit: "/mo", was: "ACBM" }],
    activity: [
      { icon: "Phone", title: "Call Left Voicemail", sub: "No answer, left VM", when: `${1 + (h % 6)}d` },
      { icon: "Mail", title: "Email", sub: "Intro / value sent", when: `${2 + (h % 8)}d` },
    ],
    ...a,
  };
}

const rawAccounts = {
  apex: {
    id: "apex", name: "Apex HVAC", contact: "Marcus Reed", role: "owner",
    phone: "(480) 555-0142", email: "marcus@apexhvac.com", city: "Mesa, AZ", region: "MT",
    industry: "HVAC", tenure: "2.3 yrs", plan: "Grow", planLabel: "Grow · trial", billing: "Monthly",
    planMRR: "$740", totalMRR: "$740", upsellMRR: "+$180", gsv: "$612k", avgInvoice: "$1,240",
    invoicesMo: 68, users: "5 / 5", pgpv: "$52k", upgradeStatus: "Working", jpayStatus: "On by default",
    nba: "→ Grow", trial: "Grow · ends Jun 1", lastActive: "Today", upgradeProbability: 73,
    signals: { extraUsers: "5 / 5", quotes30: 41, invoices30: 68, activeSms60: 52, activeEmail60: 37, integrations: 3, creditVol: "71%" },
    addons: [["Reviews", true], ["Campaigns", true], ["Referrals", false], ["AI Receptionist", false]],
    cadence: { name: "EXP - Grow Trial", step: 3, due: "Call due today · trial ends in 2 days" },
    promoTag: "30% × 3 months",
    promoRows: [
      { label: "Convert Grow trial", value: "~$244", unit: "/mo", was: "was $349 · 3mo" },
      { label: "Grow → Plus", value: "~$419", unit: "/mo", was: "was $599" },
      { label: "+ JPay (SPIF)", value: "Two-For", was: "+ card readers" },
    ],
    opps: [
      { name: "Connect → Grow upgrade", meta: "Upsell · opened May 28 · close Jun 1 · Outbound", stage: "Discovery", stageClass: "disco", amt: "$180", jp: false },
      { name: "Jobber Payments", meta: "JPay · opened Apr 12 · won Apr 20", stage: "Closed Won", stageClass: "won", amt: "pGPV $52k", jp: true },
      { name: "Core → Connect upgrade", meta: "Upsell · 2024 · won", stage: "Closed Won", stageClass: "won", amt: "$90", jp: false },
    ],
    activity: [
      { icon: "Phone", title: "Call Conversation", sub: "Reached Marcus — agreed to talk today re: trial", when: "2d" },
      { icon: "Mail", title: "Email", sub: "Trial mid-point recap sent", when: "3d" },
      { icon: "MessageSquare", title: "SMS", sub: "Two-Way SMS value tip", when: "5d" },
      { icon: "Phone", title: "Call Left Voicemail", sub: "No answer, left VM", when: "6d" },
      { icon: "MessageCircle", title: "Intercom chat", sub: "Asked about user limits", when: "8d" },
    ],
    notes: [
      { title: "Discovery", by: "ZF", when: "2d", text: "Team of 5, fully booked. Pain = back-and-forth texting after hours. Priority is revenue → Grow. Wife is co-admin, both on board." },
      { title: "JPay onboarding", by: "ZF", when: "Apr", text: "Enabled JPay, first deposits clean. High credit-card volume. Interested in deposits on quotes." },
    ],
  },
  greenline: { id: "greenline", name: "Greenline Landscaping", contact: "Dana Wills", phone: "(404) 555-0199", city: "Atlanta, GA", region: "ET", industry: "Landscaping", plan: "Connect", upgradeStatus: "Working", jpayStatus: "Eligible", nba: "→ Grow", upgradeProbability: 64 },
  lakeside: { id: "lakeside", name: "Lakeside Lawn Care", phone: "(312) 555-0144", city: "Chicago, IL", region: "CT", industry: "Landscaping", plan: "Connect", upgradeStatus: "Working", jpayStatus: "Eligible", nba: "→ Grow", upgradeProbability: 58 },
  northside: { id: "northside", name: "Northside Cleaning", city: "Boston, MA", region: "ET", industry: "Cleaning", plan: "Connect", upgradeStatus: "Working", jpayStatus: "On by default", nba: "→ Grow", upgradeProbability: 78 },
  summit: { id: "summit", name: "Summit Roofing", city: "Denver, CO", region: "MT", industry: "Roofing", plan: "Grow", upgradeStatus: "Qualified Open Opp", jpayStatus: "On by default", nba: "→ Plus", upgradeProbability: 55 },
  coastal: { id: "coastal", name: "Coastal Painting", city: "Halifax, NS", region: "AT", industry: "Painting", plan: "Grow", upgradeStatus: "Qualified Open Opp", jpayStatus: "Verifying", pgpv: "$48k", upgradeProbability: 49 },
  peak: { id: "peak", name: "Peak Plumbing", city: "Seattle, WA", region: "PT", industry: "Plumbing", plan: "Grow", upgradeStatus: "Qualified Open Opp", jpayStatus: "Hosted onboarding", upgradeProbability: 51 },
  maple: { id: "maple", name: "Maple Grove HVAC", city: "Salt Lake City, UT", region: "MT", industry: "HVAC", plan: "Grow", upgradeStatus: "New", jpayStatus: "Eligible", nba: "→ Plus", upgradeProbability: 71 },
  hometown: { id: "hometown", name: "Hometown Plumbing", city: "Pittsburgh, PA", region: "ET", industry: "Plumbing", plan: "Core", upgradeStatus: "New", jpayStatus: "Eligible", nba: "→ Connect", upgradeProbability: 33 },
  cedar: { id: "cedar", name: "Cedar Cleaning", city: "Portland, OR", region: "PT", industry: "Cleaning", plan: "Connect", upgradeStatus: "Working", jpayStatus: "Eligible", upgradeProbability: 60 },
  riverside: { id: "riverside", name: "Riverside Turf", city: "Tampa, FL", region: "ET", industry: "Landscaping", plan: "Connect", upgradeStatus: "Qualified Open Opp", jpayStatus: "On by default", upgradeProbability: 62 },
};

export const accounts = Object.fromEntries(Object.entries(rawAccounts).map(([k, v]) => [k, enrich(v)]));

export const getAccount = (id) => accounts[id] || accounts.apex;

// ---- Activity List (the ranked model) ----
export const activityList = {
  reachNow: [
    { id: "apex", pri: "ChevronUp", priClass: "hot", now: true, meta: "Grow trial · MT", due: "Phone", tags: [["trial", "Trial ends 2d"], ["cad", "Step due"]] },
    { id: "cedar", pri: "ChevronUp", priClass: "hot", meta: "Connect trial · PT", due: "Mail", tags: [["trial", "New trial — enroll"]] },
    { id: "peak", pri: "1:30", priSub: "PM", priClass: "time", meta: "Grow · PT", due: "Phone", tags: [["", "Scheduled · ChiliPiper"]] },
    { id: "greenline", pri: "AlertTriangle", priClass: "hot", meta: "Connect · ET", due: "Phone", tags: [["grace", "Grace 5d"], ["rain", "Rain ET"]] },
  ],
  ranked: [
    { id: "lakeside", rank: 1, meta: "Connect · CT · Quoter", due: "Phone", tags: [["", "Advanced Quoting"], ["rain", "Rain CT"]], why: "↑ you close Grow + Landscaping at 52%" },
    { id: "northside", rank: 2, meta: "Connect · ET · cadence due", due: "Phone", tags: [["nba", "NBA → Grow"], ["cad", "3/13"]], why: "↑ best-call window now (ET 8–10a)" },
    { id: "summit", rank: 3, meta: "Grow opp · MT · Evaluating", due: "Phone", tags: [["opp", "Follow-up due"]] },
    { id: "coastal", rank: 4, meta: "Grow · AT · JPay eligible", due: "MessageSquare", tags: [["jpay", "JPay · pGPV $48k"]] },
    { id: "maple", rank: 5, meta: "Grow · MT · NBA 71%", due: "Mail", tags: [["nba", "NBA → Plus"], ["cad", "1/13"]] },
    { id: "hometown", rank: 6, meta: "Core · ET · new", due: "Phone", tags: [["", "New · intro"]], why: "↓ Core→Connect closes slower for you" },
  ],
};

// ---- Pipeline ----
export const pipeline = [
  { key: "working", label: "New / Working", sum: "pre-opp", dot: "g1", count: 96, cards: [
    { id: "maple", meta: "HVAC · MT · Connect", tags: [["plan", "Working"], ["", "JPay: Eligible"]] },
    { id: "greenline", meta: "Landscaping · ET · Connect", tags: [["plan", "Working"], ["mrr", "Grace 5d"]] },
    { id: "hometown", meta: "Plumbing · ET · Core · new", tags: [["plan", "New"]] },
  ] },
  { key: "discovery", label: "Discovery", sum: "opp open", dot: "g2", count: 7, cards: [
    { id: "apex", meta: "HVAC · MT · Grow trial", tags: [["opp", "Upsell"], ["cad", "Grow Trial 4/11"]] },
    { id: "riverside", meta: "Landscaping · ET · Connect", tags: [["opp", "Upsell"]] },
  ] },
  { key: "evaluating", label: "Evaluating", sum: "rec sent", dot: "g3", count: 5, cards: [
    { id: "coastal", meta: "Painting · AT · Grow", tags: [["opp", "Connect→Grow"], ["cad", "follow-up due"]] },
    { id: "peak", meta: "Plumbing · PT · Grow", tags: [["opp", "JPay"], ["", "demo done"]] },
  ] },
  { key: "won", label: "Closed Won", sum: "MTD", dot: "g4", count: 8, cards: [
    { id: "summit", meta: "Roofing · MT · Grow (ACBM)", tags: [["cad", "Connect → Grow"]], mrr: "+$180" },
    { id: "brighthome", name: "Bright Home", meta: "Cleaning · PT · Plus (annual)", tags: [["cad", "Grow → Plus"]], mrr: "+$240" },
    { id: "lakeside", meta: "Landscaping · CT", tags: [["cad", "JPay enabled"]], mrr: "pGPV $22k" },
  ] },
];

export const disqualified = [
  { name: "Valley Electric", meta: "Electrical · MT · Grow", reason: "Satisfaction with Current Package", age: "30d" },
  { name: "Metro Movers", meta: "Moving · ET · Connect", reason: "Seasonal Consideration", age: "Q3 · 12d" },
  { name: "QuickFix Handyman", meta: "Handyman · PT · Core", reason: "Price-Sensitive", age: "45d" },
  { name: "City Snow Pros", meta: "Snow · CT · Connect", reason: "Request No Contact", age: "60d" },
];
