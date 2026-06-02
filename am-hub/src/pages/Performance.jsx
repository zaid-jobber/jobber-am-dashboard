import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import DevelopmentPanel from "../components/DevelopmentPanel.jsx";
import { useAccounts, useActivity, useSettings, useEditing, usePerfLayout, actions } from "../store/store.js";
import { computePerformance } from "../lib/performance.js";
import {
  ArrowUp, ArrowDown, Phone, Lock, Clock, Clock4, Lightbulb, CloudRain,
  Target, Cpu, BarChart3, Repeat, Filter, Award, Mail, MessageSquare,
  GripVertical, Minus, Plus, X, SlidersHorizontal, RotateCcw,
} from "lucide-react";

const cell = (c, n) => <div className={`cell ${c}`}>{n}</div>;
const money = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
const mrr = (n) => (n ? `$${Math.round(n).toLocaleString()}` : "—");
const chanIcon = (k) => (k === "Phone" ? <Phone /> : k === "Mail" ? <Mail /> : <MessageSquare />);
const HM_HOURS = ["6a", "7", "8", "9", "10", "11", "12", "1p", "2", "3"];
const HM_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
function heatLevel(day, hr) {
  const morning = hr >= 2 && hr <= 4; const aft = hr >= 7 && hr <= 8; const lunch = hr === 6;
  let base = morning ? 3 : aft ? 2 : lunch ? 0 : 1;
  if ((day === 1 || day === 3) && morning) base = 4;
  if (day === 4 && hr > 5) base = Math.max(0, base - 1);
  return base;
}
const PERF_TILE_LABELS = { bestTimes: "Best times to call", weather: "Weather & connect", signal: "Signal hit-rate", activity: "Activity vs target", cadence: "Cadence effectiveness", funnel: "Call funnel", whereWin: "Where you win" };

function PerfTileControls({ k }) {
  return (
    <div className="tctl">
      <span className="grip" title="Drag to move"><GripVertical size={15} /></span>
      <button onClick={() => actions.resizePerfTile(k, -1)} title="Smaller"><Minus size={14} /></button>
      <button onClick={() => actions.resizePerfTile(k, 1)} title="Bigger"><Plus size={14} /></button>
      <button className="rm" onClick={() => actions.removePerfTile(k)} title="Remove"><X size={15} /></button>
    </div>
  );
}

export default function Performance() {
  const accounts = useAccounts();
  const activity = useActivity();
  const settings = useSettings();
  const editing = useEditing();
  const perfLayout = usePerfLayout();
  const [params] = useSearchParams();
  const [view, setView] = useState(params.get("tab") === "development" ? "development" : "performance");
  // Let the guided tour (and deep links) drive the sub-tab via ?tab=.
  useEffect(() => { const t = params.get("tab"); if (t === "development" || t === "performance") setView(t); }, [params]);
  const [range, setRange] = useState("month");
  const [dragKey, setDragKey] = useState(null);
  const P = useMemo(() => computePerformance(accounts, activity, settings, range), [accounts, activity, settings, range]);
  const jpayOn = settings.trackJpay !== false;
  const RANGES = [["month", "This month"], ["last", "Last month"], ["quarter", "Quarter"]];
  const maxSig = Math.max(1, ...P.signalRows.map((r) => r.close));

  // Tile bodies (the inner content of each grid card).
  const TILES = {
    bestTimes: () => (<>
      <div className="ch"><div className="htitle"><span className="hic"><Clock4 /></span><h3>Best times to call</h3></div></div>
      <div className="pinsight"><Lightbulb /> You connect best <b>Tue &amp; Thu, 8–10am</b></div>
      <div className="hm">
        <div />{HM_HOURS.map((h) => <div className="hh" key={h}>{h}</div>)}
        {HM_DAYS.map((d, di) => (
          <>
            <div className="rl" key={d}>{d}</div>
            {HM_HOURS.map((_, hi) => { const lv = heatLevel(di, hi); return cell(`l${lv} ${(di === 1 || di === 3) && (hi === 2 || hi === 3) ? "best" : ""}`.trim(), lv === 4 ? `${38 + hi}` : ""); })}
          </>
        ))}
      </div>
      <div className="scale">Low {cell("")}{cell("l1")}{cell("l2")}{cell("l3")}{cell("l4")} High</div>
    </>),
    weather: () => (<>
      <div className="ch"><div className="htitle"><span className="hic"><CloudRain /></span><h3>Weather &amp; connect</h3></div><span className="star-c">★</span></div>
      <p className="csub">Outdoor trades</p>
      <div className="cmp">
        <div className="cmprow"><div className="top"><span>Rainy</span><b>41%</b></div><div className="cmptrack"><i className="rain" style={{ width: "82%" }}>41%</i></div></div>
        <div className="cmprow"><div className="top"><span>Clear</span><b>23%</b></div><div className="cmptrack"><i className="clear" style={{ width: "46%" }}>23%</i></div></div>
      </div>
      <div className="deltabox">+18 pts on rainy days</div>
    </>),
    signal: () => (<>
      <div className="ch"><div className="htitle"><span className="hic"><Target /></span><h3>Signal hit-rate</h3></div><span className="star-c">★</span></div>
      <table className="tbl">
        <thead><tr><th>Signal</th><th>Surfaced</th><th>Connect</th><th>Close</th><th>New MRR</th><th /></tr></thead>
        <tbody>
          {P.signalRows.map((r, i) => (
            <tr key={r.label}>
              <td>{r.label}</td><td>{r.surfaced}</td><td>{r.connect}%</td>
              <td><span className="mini"><i style={{ width: `${(r.close / maxSig) * 100}%` }} /></span>{r.close}%</td>
              <td>{mrr(r.mrr)}</td>
              <td>{i === 0 ? <span className="badge win">Top</span> : i === P.signalRows.length - 1 ? <span className="badge low">Weak</span> : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pinsight" style={{ margin: "14px 0 0" }}><Cpu /> Boosting your strongest signals on the ranked list, down-weighting the weak ones</div>
    </>),
    activity: () => (<>
      <div className="ch"><div className="htitle"><span className="hic"><BarChart3 /></span><h3>Activity vs target</h3></div></div>
      <div className="prog">
        <div className="pr"><div className="top"><b>Dials</b><span className="g">{P.month.dials} / {P.target.dials}</span></div><div className="track"><i style={{ width: `${Math.min(100, (P.month.dials / P.target.dials) * 100)}%` }} /></div></div>
        <div className="pr"><div className="top"><b>SMS</b><span className="g">{P.month.sms} / {P.target.sms}</span></div><div className="track"><i className="lime" style={{ width: `${Math.min(100, (P.month.sms / P.target.sms) * 100)}%` }} /></div></div>
        <div className="pr"><div className="top"><b>Talk time</b><span className="g">{P.month.talk} / {P.target.talk}m</span></div><div className="track"><i style={{ width: `${Math.min(100, (P.month.talk / P.target.talk) * 100)}%` }} /></div></div>
        <div className="pr"><div className="top"><b>Opps created</b><span className="g">{P.month.opps} / {P.target.opps}</span></div><div className="track"><i className="green" style={{ width: `${Math.min(100, (P.month.opps / P.target.opps) * 100)}%` }} /></div></div>
      </div>
    </>),
    cadence: () => (<>
      <div className="ch"><div className="htitle"><span className="hic"><Repeat /></span><h3>Cadence effectiveness</h3></div><span className="star-c">★</span></div>
      <table className="tbl">
        <thead><tr><th>Channel</th><th>Sent</th><th>Response</th><th>Close</th></tr></thead>
        <tbody>
          {P.cadenceRows.map((r) => (
            <tr key={r.channel}>
              <td><span className="chan">{chanIcon(r.key)} {r.channel}</span></td><td>{r.sent}</td><td>{r.response}%</td>
              <td><span className="mini"><i style={{ width: `${Math.min(100, r.close * 2)}%` }} /></span>{r.close}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pinsight" style={{ margin: "14px 0 0" }}><Repeat /> Calls out-convert async channels — keep a call early in the cadence</div>
    </>),
    funnel: () => (<>
      <div className="ch"><div className="htitle"><span className="hic"><Filter /></span><h3>Call funnel</h3></div></div>
      <div className="funnel">
        <div className="fstep"><div className="lab">Dials</div><div className="fbar"><i className="navy" style={{ width: "100%" }}>{P.dials}</i></div><div className="pct">100%</div></div>
        <div className="fstep"><div className="lab">Connected</div><div className="fbar"><i className="g1" style={{ width: `${P.connRate}%` }}>{P.connects}</i></div><div className="pct">{P.connRate}%</div></div>
        <div className="fstep"><div className="lab">One-call close</div><div className="fbar"><i className="g2" style={{ width: `${Math.min(100, (P.oneCallClose / Math.max(1, P.connects)) * 100)}%` }}>{P.oneCallClose}</i></div><div className="pct">{Math.round((P.oneCallClose / Math.max(1, P.connects)) * 100)}%</div></div>
        <div className="fstep"><div className="lab">Opps won</div><div className="fbar"><i className="g3" style={{ width: `${Math.min(100, P.winRate)}%` }}>{P.oppsWon}</i></div><div className="pct">{P.winRate}%</div></div>
      </div>
    </>),
    whereWin: () => (<>
      <div className="ch"><div className="htitle"><span className="hic"><Award /></span><h3>Where you win</h3></div></div>
      <div className="twocol">
        <div>
          <h4>By segment</h4>
          <table className="tbl">
            <thead><tr><th>Segment</th><th>Connect</th><th>Close</th><th>MRR</th></tr></thead>
            <tbody>{P.bySegment.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.connect}%</td><td><span className="mini"><i style={{ width: `${r.close}%` }} /></span>{r.close}%</td><td>{mrr(r.mrr)}</td></tr>)}</tbody>
          </table>
        </div>
        <div>
          <h4>By industry</h4>
          <table className="tbl">
            <thead><tr><th>Industry</th><th>Connect</th><th>Close</th><th>MRR</th></tr></thead>
            <tbody>{P.byIndustry.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.connect}%</td><td><span className="mini"><i style={{ width: `${r.close}%` }} /></span>{r.close}%</td><td>{mrr(r.mrr)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>),
  };

  const present = new Set(perfLayout.map((t) => t.key));
  const hidden = Object.keys(TILES).filter((k) => !present.has(k)).map((k) => ({ key: k, label: PERF_TILE_LABELS[k] }));

  return (
    <Shell showCustomize={view === "performance"}>
      <div className="pagehead">
        <div><h1>Performance</h1></div>
        <div className="ptabs">
          <button className={`ptab ${view === "performance" ? "on" : ""}`} onClick={() => setView("performance")}>Performance</button>
          <button className={`ptab ${view === "development" ? "on" : ""}`} onClick={() => setView("development")}>Development</button>
        </div>
      </div>

      {view === "development" ? <DevelopmentPanel /> : (
        <>
          {editing && (
            <div className="editbar">
              <span className="et"><SlidersHorizontal size={16} /> Customize</span>
              <span className="hint">Drag to move · − / + to resize · × to remove</span>
              <span className="tiles">
                {hidden.length === 0 && <span className="hint">All tiles are showing.</span>}
                {hidden.map((t) => <button className="tlchip" key={t.key} onClick={() => actions.addPerfTile(t.key)}><Plus size={14} /> {t.label}</button>)}
              </span>
              <button className="reset" onClick={() => actions.resetPerfLayout()}><RotateCcw size={14} /> Reset</button>
              <button className="done" onClick={() => actions.setEditing(false)}>Done</button>
            </div>
          )}

          <div className="controls" style={{ marginBottom: 16 }}>{RANGES.map(([k, l]) => <div key={k} className={`chip ${range === k ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setRange(k)}>{l}</div>)}</div>

          <div className="hero">
            <div className="hcard"><div className="k">Total Expansion Revenue</div><div className="v num">{P.expRevPct}%</div><div className={`d ${P.expRevPct >= 75 ? "up" : "down"}`}>{P.expRevPct >= 75 ? <ArrowUp /> : <ArrowDown />} to target</div><span className="subt">Upgrade MRR + JPay PGPV</span></div>
            <div className="hcard"><div className="k">Upgrade MRR</div><div className="v num">{money(P.upgradeMRR)}</div><div className="d up"><ArrowUp /> {P.upgrades} upgrades</div><span className="subt">ASP {mrr(P.asp)}</span></div>
            {jpayOn && <div className="hcard"><div className="k">JPay PGPV</div><div className="v num">{money(P.jpayPGPV)}</div><div className="d"><CloudRain size={14} /> {P.jpayCount} enablements</div><span className="subt">processed volume</span></div>}
            <div className="hcard"><div className="k">Win rate</div><div className="v num">{P.winRate}%</div><div className="d up"><ArrowUp /> won vs lost</div><span className="subt">closed opps</span></div>
          </div>

          <div className="strip2">
            <div className="scard"><div className="si"><Phone /></div><div><div className="v num">{P.connRate}%</div><div className="k">Connection rate · {P.dials} dials</div></div></div>
            <div className="scard"><div className="si"><Target /></div><div><div className="v num">{P.trialConv}%</div><div className="k">Trial conversion</div></div></div>
            <div className="scard"><div className="si"><BarChart3 /></div><div><div className="v num">{P.openOppCount}</div><div className="k">Open opportunities</div></div></div>
            <div className="scard"><div className="si"><Lock /></div><div><div className="v num">{P.retained}%</div><div className="k">90-day retained MRR</div></div></div>
            <div className="scard"><div className="si"><Clock /></div><div><div className="v num">{P.talkPerDay}m</div><div className="k">Talk time / day · goal 90</div></div></div>
          </div>

          <div className="grid">
            {perfLayout.map((t) => {
              const body = TILES[t.key];
              if (!body) return null;
              const w = t.w;
              return (
                <div key={t.key} className={`card c${w}${dragKey === t.key ? " dragging" : ""}`}
                  draggable={editing}
                  onDragStart={() => editing && setDragKey(t.key)}
                  onDragEnd={() => setDragKey(null)}
                  onDragOver={(e) => { if (dragKey) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (dragKey) actions.reorderPerfTile(dragKey, t.key); setDragKey(null); }}>
                  {editing && <PerfTileControls k={t.key} />}
                  {body()}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
