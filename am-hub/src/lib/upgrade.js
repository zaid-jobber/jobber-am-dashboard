// Compute the Plan Upgrade Insight % from the visible signals.
// Zaid's call: the old SF data-science score "doesn't work anymore" → the Hub
// derives its own probability from the 8 visible signals (and can learn later).
// Output is a 0–100% plus the top drivers, so the panel can explain the number.

// Each signal contributes points toward a logistic-style score. Tuned so a
// classic "obvious upgrade" (over user limit, heavy quoting/invoicing, active
// comms) lands high, and a quiet account lands low.
const SIGNALS = [
  { key: "extraUsers", label: "Over/near user limit", pts: (a) => { const e = parseUsers(a.signals?.extraUsers); if (!e) return 0; const over = e.used - e.limit; return over > 0 ? 26 : (e.limit - e.used <= 1 ? 16 : 0); } },
  { key: "quotes30",   label: "Quotes (30d)",         pts: (a) => band(a.signals?.quotes30, [[20, 20], [10, 14], [5, 8], [1, 3]]) },
  { key: "invoices30", label: "Invoices (30d)",       pts: (a) => band(a.signals?.invoices30, [[40, 16], [20, 11], [8, 5]]) },
  { key: "activeSms60",label: "Active SMS days (60d)",pts: (a) => band(a.signals?.activeSms60, [[30, 12], [15, 8], [5, 4]]) },
  { key: "activeEmail60", label: "Active email days (60d)", pts: (a) => band(a.signals?.activeEmail60, [[30, 8], [15, 5], [5, 2]]) },
  { key: "integrations", label: "Integrations",       pts: (a) => band(a.signals?.integrations, [[3, 10], [1, 6]]) },
  { key: "pgpv",       label: "Payment volume",        pts: (a) => band(dollars(a.pgpv), [[30000, 10], [10000, 6], [2000, 3]]) },
];

// Logistic squash so points map to a sensible-feeling probability.
const logistic = (x) => 1 / (1 + Math.exp(-x));

export function computeUpgrade(a) {
  if (!scorable(a)) return { pct: null, scorable: false, drivers: [], note: `${a.plan} accounts aren't scored for upgrade` };
  const parts = SIGNALS.map((s) => ({ key: s.key, label: s.label, pts: s.pts(a) || 0 })).filter((p) => p.pts > 0);
  const total = parts.reduce((s, p) => s + p.pts, 0);
  // Center near ~35 pts = 50%; spread so 0pts≈12%, 70pts≈90%.
  const pct = Math.round(logistic((total - 35) / 14) * 100);
  const drivers = parts.sort((x, y) => y.pts - x.pts).slice(0, 3).map((p) => p.label);
  return { pct, scorable: true, drivers, total };
}

// Only Core / Connect / Loyalty are scored for upgrade (per SF rules).
function scorable(a) { return /core|connect|loyalty/i.test(a.plan || ""); }

function parseUsers(s) { const m = /(\d+)\s*\/\s*(\d+)/.exec(s || ""); return m ? { used: +m[1], limit: +m[2] } : null; }
function dollars(s) { if (s == null) return 0; const m = /([\d.]+)\s*([kKmM]?)/.exec(String(s)); if (!m) return 0; const n = parseFloat(m[1]); return n * (/[kK]/.test(m[2]) ? 1000 : /[mM]/.test(m[2]) ? 1e6 : 1); }
function band(v, tiers) { const n = typeof v === "number" ? v : parseFloat(v); if (isNaN(n)) return 0; for (const [thresh, pts] of tiers) if (n >= thresh) return pts; return 0; }
