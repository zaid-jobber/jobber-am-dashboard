import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useAccounts, useWorklist, actions } from "../store/store.js";
import { changeFeed, riskAlerts, upgradeMomentum, learningInsights, riskInsights, TYPE_LABELS } from "../lib/signals.js";
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles, Activity, Plus, Check, X } from "lucide-react";

function ChangeRow({ item, pinned }) {
  const isPinned = pinned.includes(item.accId);
  return (
    <div className={`sigrow ${item.dir === "down" ? "down" : ""}`}>
      <span className={`sig-ic ${item.dir === "down" ? "risk" : "up"}`}><Icon name={item.icon} size={16} /></span>
      <Link className="sig-acc" to={`/account/${item.accId}`}>
        <b>{item.name}</b>
        <span>{item.title} · {item.detail}</span>
      </Link>
      <span className="sig-when">{item.ageDays}d · {item.region}</span>
      <button className={`sig-add ${isPinned ? "on" : ""}`}
        onClick={() => (isPinned ? actions.unpinFromWorklist(item.accId) : actions.pinToWorklist(item.accId))}>
        {isPinned ? <><Check size={13} /> Added</> : <><Plus size={13} /> Worklist</>}
      </button>
    </div>
  );
}

export default function PipelineSignals() {
  const accounts = useAccounts();
  const wl = useWorklist();
  const pinned = wl.pinned || [];
  const [filter, setFilter] = useState(null); // change-type key or null
  const [day, setDay] = useState(null); // ageDays of a clicked trend column, or null

  const feed = useMemo(() => changeFeed(accounts, { limit: 1000 }), [accounts]);
  const ups = feed.filter((c) => c.dir === "up");
  const downs = feed.filter((c) => c.dir === "down");
  const momentum = useMemo(() => upgradeMomentum(accounts), [accounts]);
  const risks = useMemo(() => riskAlerts(accounts), [accounts]);
  const learning = useMemo(() => learningInsights(accounts), [accounts]);
  const risk = useMemo(() => riskInsights(accounts), [accounts]);
  const maxLift = Math.max(1.2, ...learning.map((l) => l.lift));
  const maxRiskLift = Math.max(1.2, ...risk.map((l) => l.lift));

  // Counts per change type (for chips + volume bars).
  const byType = useMemo(() => { const m = {}; for (const c of feed) m[c.type] = (m[c.type] || 0) + 1; return m; }, [feed]);
  const typesByCount = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  // 14-day trend, split up/down (respects the active filter).
  const trend = useMemo(() => {
    const days = Array.from({ length: 14 }, () => ({ up: 0, down: 0 }));
    for (const c of feed) {
      if (filter && c.type !== filter) continue;
      const d = Math.min(13, c.ageDays || 0);
      if (c.dir === "down") days[d].down++; else days[d].up++;
    }
    return days.reverse(); // oldest → newest (left → right)
  }, [feed, filter]);
  const maxTrend = Math.max(1, ...trend.map((d) => d.up + d.down));

  const active = filter || day != null;
  const filtered = active ? feed.filter((c) => (!filter || c.type === filter) && (day == null || c.ageDays === day)) : null;
  const drillTitle = [filter ? TYPE_LABELS[filter] : null, day != null ? (day === 0 ? "today" : `${day}d ago`) : null].filter(Boolean).join(" · ") || "Changes";
  const clearAll = () => { setFilter(null); setDay(null); };

  return (
    <div className="signals">
      {/* filter chips */}
      <div className="sig-chips">
        <button className={`sig-chip ${!active ? "on" : ""}`} onClick={clearAll}>All changes <em>{feed.length}</em></button>
        {typesByCount.map(([t, n]) => (
          <button key={t} className={`sig-chip ${filter === t ? "on" : ""} ${/down|dropped|slowing|losing/.test(t) ? "risk" : ""}`} onClick={() => { setDay(null); setFilter(filter === t ? null : t); }}>
            {TYPE_LABELS[t] || t} <em>{n}</em>
          </button>
        ))}
      </div>

      <div className="sig-stats">
        <div className="sig-stat"><span className="ss-ic up"><Activity size={18} /></span><div><b>{feed.length}</b><span>changes detected</span></div></div>
        <div className="sig-stat"><span className="ss-ic up"><TrendingUp size={18} /></span><div><b>{ups.length}</b><span>upgrade signals</span></div></div>
        <div className="sig-stat"><span className="ss-ic risk"><AlertTriangle size={18} /></span><div><b>{downs.length}</b><span>downgrade / risk</span></div></div>
        <div className="sig-stat"><span className="ss-ic up"><Sparkles size={18} /></span><div><b>{momentum.length}</b><span>accounts heating up</span></div></div>
      </div>

      {/* trend graph */}
      <div className="sig-trend card">
        <div className="ch"><div className="htitle"><span className="hic"><Activity /></span><h3>Change volume · last 14 days{filter ? ` · ${TYPE_LABELS[filter]}` : ""}</h3></div>
          <div className="trend-legend"><span><i className="lg up" /> upgrade</span><span><i className="lg down" /> risk</span></div>
        </div>
        <div className="trend">
          {trend.map((d, i) => {
            const total = d.up + d.down;
            const ageDay = 13 - i; // index 0 = 14d ago → ageDays 13; index 13 = today → 0
            const label = ageDay === 0 ? "today" : `${ageDay}d ago`;
            return (
              <button className={`trend-col ${day === ageDay ? "on" : ""}`} key={i} onClick={() => setDay(day === ageDay ? null : ageDay)} title={`Filter to ${label}`}>
                <div className="trend-tip">{total} change{total === 1 ? "" : "s"}<span>{d.up} up · {d.down} risk · {label}</span></div>
                <div className="trend-stack">
                  <div className="tb down" style={{ flexBasis: `${(d.down / maxTrend) * 100}%` }} />
                  <div className="tb up" style={{ flexBasis: `${(d.up / maxTrend) * 100}%` }} />
                </div>
                <span className="trend-x">{i === 0 ? "14d ago" : i === 7 ? "7d" : i === 13 ? "today" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sig-learn card">
        <div className="ch"><div className="htitle"><span className="hic"><Sparkles /></span><h3>What's driving upgrades in your book</h3></div></div>
        <p className="sl-sub">Change types ranked by how much more often accounts that show them open an opportunity, vs your baseline. Click a row to drill in.</p>
        <div className="sl-rows">
          {learning.map((l) => (
            <button className={`sl-row ${filter === l.type ? "on" : ""}`} key={l.type} onClick={() => { setDay(null); setFilter(filter === l.type ? null : l.type); }}>
              <span className="sl-lab">{l.label}</span>
              <div className="sl-bar"><i style={{ width: `${Math.min(100, (l.lift / maxLift) * 100)}%` }} /></div>
              <span className="sl-lift">{l.lift.toFixed(1)}×</span>
              <span className="sl-rate">{Math.round(l.rate * 100)}% open an opp · {l.n} accts</span>
            </button>
          ))}
          {learning.length === 0 && <div className="bcol-empty">Not enough data yet.</div>}
        </div>
      </div>

      <div className="sig-learn card risk">
        <div className="ch"><div className="htitle"><span className="hic risk"><TrendingDown /></span><h3>What precedes downgrades &amp; churn</h3></div></div>
        <p className="sl-sub">Drop-type changes ranked by how much more often accounts that show them end up Closed Lost or disqualified, vs your baseline. Click a row to drill in.</p>
        <div className="sl-rows">
          {risk.map((l) => (
            <button className={`sl-row ${filter === l.type ? "on" : ""}`} key={l.type} onClick={() => { setDay(null); setFilter(filter === l.type ? null : l.type); }}>
              <span className="sl-lab">{l.label}</span>
              <div className="sl-bar risk"><i style={{ width: `${Math.min(100, (l.lift / maxRiskLift) * 100)}%` }} /></div>
              <span className="sl-lift">{l.lift.toFixed(1)}×</span>
              <span className="sl-rate">{Math.round(l.rate * 100)}% lost · {l.n} accts</span>
            </button>
          ))}
          {risk.length === 0 && <div className="bcol-empty">No downgrade patterns detected.</div>}
        </div>
      </div>

      {active ? (
        <div className="sig-panel card">
          <div className="ch"><div className="htitle"><span className="hic"><Activity /></span><h3>{drillTitle}</h3></div>
            <button className="sig-clear" onClick={clearAll}><X size={13} /> Clear filter</button><span className="n">{filtered.length}</span></div>
          <div className="sig-list">
            {filtered.map((c, i) => <ChangeRow key={c.accId + i} item={c} pinned={pinned} />)}
            {filtered.length === 0 && <div className="bcol-empty">No changes match.</div>}
          </div>
        </div>
      ) : (
        <>
          <div className="sig-cols">
            <div className="sig-panel card">
              <div className="ch"><div className="htitle"><span className="hic risk"><AlertTriangle /></span><h3>Risk radar — downgrades &amp; churn</h3></div><span className="n">{risks.length}</span></div>
              <div className="sig-list">
                {risks.slice(0, 30).map((r) => <ChangeRow key={r.accId} item={{ ...r.top, accId: r.accId, name: r.name, region: r.region }} pinned={pinned} />)}
                {risks.length === 0 && <div className="bcol-empty">No risk signals right now.</div>}
              </div>
            </div>
            <div className="sig-panel card">
              <div className="ch"><div className="htitle"><span className="hic"><TrendingUp /></span><h3>Upgrade momentum</h3></div><span className="n">{momentum.length}</span></div>
              <div className="sig-list">
                {momentum.slice(0, 30).map((m) => <ChangeRow key={m.accId} item={{ ...m.changes[0], accId: m.accId, name: m.name, region: m.region }} pinned={pinned} />)}
                {momentum.length === 0 && <div className="bcol-empty">No strong momentum yet.</div>}
              </div>
            </div>
          </div>
          <div className="sig-panel card">
            <div className="ch"><div className="htitle"><span className="hic"><Activity /></span><h3>All recent account changes</h3></div></div>
            <div className="sig-list">
              {feed.slice(0, 60).map((c, i) => <ChangeRow key={c.accId + c.type + i} item={c} pinned={pinned} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
