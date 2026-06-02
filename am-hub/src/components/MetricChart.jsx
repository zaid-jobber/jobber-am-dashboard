import { useState } from "react";
import { metricSeries, RANGES } from "../lib/metrics.js";
import { TrendingUp, TrendingDown, X } from "lucide-react";

// Line+area chart for one account metric, with 7D / 30D / 12M range toggle and
// hover points that reveal the value at each point.
export default function MetricChart({ account, metric, onClose }) {
  const [range, setRange] = useState("30d");
  const [hi, setHi] = useState(null);
  const { points, current, change } = metricSeries(account, metric, range);
  const vals = points.map((p) => p.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const W = 560, H = 150, padX = 6, padY = 12;
  const n = points.length;
  const x = (i) => padX + (i / (n - 1 || 1)) * (W - padX * 2);
  const y = (v) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = `${padX},${H - padY} ${line} ${W - padX},${H - padY}`;
  const up = change >= 0;
  const fmt = metric.fmt || ((v) => Math.round(v).toLocaleString());
  const hp = hi != null ? points[hi] : null;

  return (
    <div className="mchart">
      <div className="mc-head">
        <div className="mc-title">
          <span className="mc-lab">{metric.label}</span>
          <span className="mc-cur">{fmt(current)}</span>
          <span className={`mc-chg ${up ? "up" : "down"}`}>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{(change >= 0 ? "+" : "") + Math.round(change * 100)}%</span>
        </div>
        <div className="mc-ranges">
          {RANGES.map((r) => <button key={r.key} className={`mc-r ${range === r.key ? "on" : ""}`} onClick={() => { setRange(r.key); setHi(null); }}>{r.label}</button>)}
          {onClose && <button className="mc-x" onClick={onClose} title="Close"><X size={15} /></button>}
        </div>
      </div>
      <div className="mc-plot" onMouseLeave={() => setHi(null)}>
        <svg className="mc-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="mcg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#mcg)" />
          <polyline points={line} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {/* hover hit-areas (one per point) */}
        <div className="mc-hit">{points.map((_, i) => <div key={i} onMouseEnter={() => setHi(i)} />)}</div>
        {hp && (
          <>
            <span className="mc-dot" style={{ left: `${(x(hi) / W) * 100}%`, top: `${(y(hp.value) / H) * 100}%` }} />
            <div className="mc-tip" style={{ left: `${(x(hi) / W) * 100}%`, top: `${(y(hp.value) / H) * 100}%` }}>{fmt(hp.value)}<span>{hp.label}</span></div>
          </>
        )}
      </div>
      <div className="mc-axis">{points.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n / 2)).map((p, i) => <span key={i}>{p.label}</span>)}</div>
    </div>
  );
}
