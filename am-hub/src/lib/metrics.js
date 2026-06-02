// Time-series for an account metric over a selectable range. LIVE: read from
// Anchor/Salesforce historical snapshots. Demo: deterministic synthetic series
// that lands on the account's current value, so charts are stable per account.

const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export const dollars = (s) => { if (s == null) return 0; const m = /([\d.]+)\s*([kKmM]?)/.exec(String(s)); if (!m) return 0; const n = parseFloat(m[1]); return n * (/[kK]/.test(m[2]) ? 1000 : /[mM]/.test(m[2]) ? 1e6 : 1); };

export const RANGES = [
  { key: "7d", label: "7D", points: 7, unit: "d" },
  { key: "30d", label: "30D", points: 30, unit: "d" },
  { key: "12m", label: "12M", points: 12, unit: "mo" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pointLabel(range, i) {
  const back = range.points - 1 - i;
  if (range.unit === "mo") { const d = new Date(); d.setMonth(d.getMonth() - back); return MONTHS[d.getMonth()]; }
  return back === 0 ? "now" : `${back}${range.unit}`;
}

// metric = { key, value(acc) -> number }. Returns { points:[{label,value}], current, range, change }.
export function metricSeries(acc, metric, rangeKey = "30d") {
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[1];
  const cur = Number(metric.value(acc)) || 0;
  const seed = hashStr((acc?.id || "") + ":" + metric.key + ":" + range.key);
  const n = range.points;
  const pts = [];
  let v = cur * (0.55 + ((seed % 45) / 100)); // start somewhat below current
  for (let i = 0; i < n; i++) {
    const noise = (((seed >> (i % 16)) % 21) - 10) / 100; // -0.10..+0.10
    const drift = (cur - v) * (0.16 + (i / n) * 0.22);
    v = Math.max(0, v + drift + v * noise);
    const value = i === n - 1 ? cur : Math.round(v * 100) / 100;
    pts.push({ label: pointLabel(range, i), value });
  }
  const start = pts[0]?.value || 0;
  const change = start ? (cur - start) / start : 0;
  return { points: pts, current: cur, range, change };
}
