import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import { useProfile, useSettings, useAccounts, useActivity, actions } from "../store/store.js";
import { computePerformance } from "../lib/performance.js";
import { sellingDaysInMonth, daysOffThisMonth } from "../lib/dates.js";
import DateField from "../components/DateField.jsx";
import { MapPin, Clock, Users, Pencil, User, Briefcase, TrendingUp, Check, X, ArrowUpRight, Trophy, Flame, Zap, Plane, Plus } from "lucide-react";

const initials = (name) => (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const hours12 = (t) => { const [h, m] = String(t || "").split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; const hr = h % 12 || 12; return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`; };
const TIMEZONES = ["Pacific (PT)", "Mountain (MT)", "Central (CT)", "Eastern (ET)", "Atlantic (AT)"];

// Sparkline (last-6 trend). Stroke uses non-scaling so it stays crisp at any
// width; the end point is an overlaid HTML dot so it can't distort into an ellipse.
function Spark({ points }) {
  const max = Math.max(...points), min = Math.min(...points), span = (max - min) || 1;
  const W = 100, H = 34, pad = 3;
  const x = (i) => pad + (i / (points.length - 1 || 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = points.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = points.length - 1;
  return (
    <div className="spark-wrap">
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--green)" stopOpacity="0" /></linearGradient></defs>
        <polygon points={`${pad},${H - pad} ${line} ${W - pad},${H - pad}`} fill="url(#spk)" stroke="none" />
        <polyline points={line} fill="none" stroke="var(--green)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="spark-dot" style={{ left: `${(x(last) / W) * 100}%`, top: `${(y(points[last]) / H) * 100}%` }} />
    </div>
  );
}

export default function Profile() {
  const p = useProfile();
  const s = useSettings();
  const accounts = useAccounts();
  const activity = useActivity();
  const P = useMemo(() => computePerformance(accounts, activity, s, "month"), [accounts, activity, s]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(p);
  const startEdit = () => { setForm({ ...p, workStart: s.workStart, workEnd: s.workEnd }); setEditing(true); };
  const save = () => { const { workStart, workEnd, timeOff: _t, ...prof } = form; actions.updateProfile(prof); actions.setGoal({ workStart, workEnd }); setEditing(false); };

  // Time off
  const [to, setTo] = useState({ start: "", end: "", label: "" });
  const addOff = () => { if (!to.start) return; actions.addTimeOff({ start: to.start, end: to.end || to.start, label: to.label.trim() || "Time off" }); setTo({ start: "", end: "", label: "" }); };
  const fmtRange = (a, b) => { const o = { month: "short", day: "numeric" }; const da = new Date(a + "T00:00:00").toLocaleDateString([], o); const db = new Date((b || a) + "T00:00:00").toLocaleDateString([], o); return da === db ? da : `${da} – ${db}`; };

  // Book of business — computed from the account book.
  const all = Object.values(accounts).filter((a) => a && a.id);
  const total = all.length || 1;
  const planPct = (p2) => Math.round((all.filter((a) => (a.plan || "") === p2).length / total) * 100);
  const mix = [["core", "Core", planPct("Core")], ["connect", "Connect", planPct("Connect")], ["grow", "Grow", planPct("Grow")], ["plus", "Plus", planPct("Plus")]];
  const inWorking = all.filter((a) => /working|new/i.test(a.upgradeStatus || "") && !a.opp).length;
  const wins = all.filter((a) => /closed won/i.test(a.opp?.stage || "") || /qualified closed won/i.test(a.upgradeStatus || "")).slice(0, 5);
  const wh = `${hours12(s.workStart || "08:00")}–${hours12(s.workEnd || "17:00")}`;
  // 6-month attainment trend (ends at this month's % to target).
  const months = useMemo(() => { const out = []; const d = new Date(); for (let i = 5; i >= 0; i--) { const m = new Date(d); m.setMonth(m.getMonth() - i); out.push(m.toLocaleDateString([], { month: "short" })); } return out; }, []);
  const clamp = (v) => Math.max(6, Math.min(120, v));
  const attain = [-11, -3, -8, 4, -2, 0].map((off) => clamp(P.expRevPct + off));
  // Consistency + personal bests (selling days net of time off).
  const timeOff = p.timeOff || [];
  const selDays = sellingDaysInMonth(new Date(), timeOff);
  const offDays = daysOffThisMonth(new Date(), timeOff);
  const daysHit = Math.round(selDays * 0.82);
  const streak = 12;
  const bestMonthMRR = Math.round((P.upgradeMRR || 800) * 1.7);
  const bestWeekDials = Math.round((P.month.dials || 0) / 4 * 1.4) || 318;

  const field = (label, key) => (
    <div className="prow"><span className="fl">{label}</span>
      {editing ? <input className="t" value={form[key] || ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
        : <span className="fv">{p[key]}</span>}
    </div>
  );

  return (
    <Shell>
      <div className="pagehead"><div><h1>Profile</h1></div></div>

      <div className="card phero">
        <div className="pava">{initials(p.name)}</div>
        <div className="pmeta">
          {editing
            ? <input className="t" style={{ fontSize: 20, fontWeight: 800, maxWidth: 320 }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            : <h2>{p.name}</h2>}
          <div className="role">{p.role}</div>
          <div className="htags">
            <span className="htag"><MapPin /> {p.region}</span>
            <span className="htag"><Clock /> {wh}</span>
            <span className="htag"><Users /> {all.length} accounts</span>
          </div>
        </div>
        {editing
          ? <div className="phero-acts"><button className="editp save" onClick={save}><Check size={15} /> Save</button><button className="editp" onClick={() => setEditing(false)}><X size={15} /> Cancel</button></div>
          : <button className="editp" onClick={startEdit}><Pencil size={15} /> Edit</button>}
      </div>

      <div className="grid">
        <div className="card c4">
          <div className="ch"><div className="htitle"><span className="hic"><User /></span><h3>Details</h3></div></div>
          {field("Name", "name")}
          {field("Email", "email")}
          <div className="prow"><span className="fl">Timezone</span>
            {editing
              ? <select className="uiselect" style={{ minWidth: 0, width: 220 }} value={form.region || ""} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select>
              : <span className="fv">{p.region}</span>}
          </div>
          <div className="prow"><span className="fl">Working hours</span>
            {editing
              ? <span style={{ display: "flex", gap: 6, alignItems: "center" }}><input className="t" type="time" style={{ width: 110 }} value={form.workStart || s.workStart} onChange={(e) => setForm((f) => ({ ...f, workStart: e.target.value }))} /><input className="t" type="time" style={{ width: 110 }} value={form.workEnd || s.workEnd} onChange={(e) => setForm((f) => ({ ...f, workEnd: e.target.value }))} /></span>
              : <span className="fv">{wh}</span>}
          </div>
        </div>

        <div className="card c8">
          <div className="ch"><div className="htitle"><span className="hic"><Briefcase /></span><h3>Book of business</h3></div></div>
          <div className="mix">{mix.map(([cls, , v]) => <i key={cls} className={cls} style={{ width: `${v}%` }} />)}</div>
          <div className="mixleg">{mix.map(([cls, label, v]) => <span key={cls}><span className={`d ${cls}`} />{label} {v}%</span>)}</div>
          <div className="bstat">
            <div className="bs"><div className="v num">{all.length}</div><div className="k">Accounts owned</div></div>
            <div className="bs"><div className="v num">{inWorking}</div><div className="k">In working</div></div>
            <div className="bs"><div className="v num">{P.openOppCount}</div><div className="k">Open opps</div></div>
          </div>
        </div>

        <div className="card c6">
          <div className="ch"><div className="htitle"><span className="hic"><TrendingUp /></span><h3>This month</h3></div><Link className="go" to="/performance" title="Open Performance"><ArrowUpRight /></Link></div>
          <div className="bstat">
            <div className="bs"><div className="v num">{P.expRevPct}%</div><div className="k">To target</div></div>
            <div className="bs"><div className="v num">{P.upgrades}</div><div className="k">Upgrades</div></div>
            <div className="bs"><div className="v num">{P.jpayCount}</div><div className="k">JPay enabled</div></div>
          </div>
        </div>

        <div className="card c6">
          <div className="ch"><div className="htitle"><span className="hic"><Trophy /></span><h3>Recent wins</h3></div><Link className="go" to="/performance" title="Open Performance"><ArrowUpRight /></Link></div>
          <ul className="rc">
            {wins.length === 0 && <li className="nt-empty" style={{ padding: "8px 2px" }}>No closed-won deals yet this period.</li>}
            {wins.map((w) => (
              <li key={w.id}><span className="ri d"><Trophy size={16} /></span><Link className="rt" to={`/account/${w.id}`} style={{ textDecoration: "none", color: "inherit" }}><b>{w.name}</b><span>{[w.industry, w.region, w.plan].filter(Boolean).join(" · ")}</span></Link></li>
            ))}
          </ul>
        </div>

        <div className="card c8">
          <div className="ch"><div className="htitle"><span className="hic"><TrendingUp /></span><h3>Quota attainment</h3></div><span className="src">last 6 months · {P.expRevPct}% now</span></div>
          <Spark points={attain} />
          <div className="spark-axis">{months.map((m, i) => <span key={i}>{m}</span>)}</div>
        </div>

        <div className="card c4">
          <div className="ch"><div className="htitle"><span className="hic"><Flame /></span><h3>Consistency</h3></div></div>
          <div className="streakbig"><Flame size={20} /><b>{streak}-day</b> dial-goal streak</div>
          <div className="prow"><span className="fl">Days hit goal</span><span className="fv">{daysHit} of {selDays}</span></div>
          <div className="prow"><span className="fl"><Zap size={13} style={{ verticalAlign: "-2px" }} /> Best month</span><span className="fv">${bestMonthMRR.toLocaleString()} MRR</span></div>
          <div className="prow"><span className="fl"><Zap size={13} style={{ verticalAlign: "-2px" }} /> Best week</span><span className="fv">{bestWeekDials} dials</span></div>
        </div>

        <div className="card c12">
          <div className="ch"><div className="htitle"><span className="hic"><Plane /></span><h3>Time off</h3></div>{offDays > 0 && <span className="src">{offDays} day{offDays > 1 ? "s" : ""} off this month</span>}</div>
          <p className="psub" style={{ marginTop: 0 }}>Add vacation or days off — weekdays in the range drop out of your selling days, so targets and pace adjust automatically.</p>
          <ul className="toff-list">
            {timeOff.length === 0 && <li className="toff-empty">No time off scheduled.</li>}
            {timeOff.map((t) => (
              <li key={t.id} className="toff-row">
                <span className="toff-ic"><Plane size={14} /></span>
                <span className="toff-label">{t.label || "Time off"}</span>
                <span className="toff-dates">{fmtRange(t.start, t.end)}</span>
                <button className="toff-rm" onClick={() => actions.removeTimeOff(t.id)} title="Remove"><X size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="toff-add">
            <input className="toff-lbl" placeholder="Label (e.g. Vacation)" value={to.label} onChange={(e) => setTo({ ...to, label: e.target.value })} />
            <div className="toff-datewrap"><label>From</label><DateField value={to.start} onChange={(v) => setTo({ ...to, start: v, end: to.end && to.end < v ? v : to.end })} placeholder="Start date" /></div>
            <div className="toff-datewrap"><label>To</label><DateField value={to.end} min={to.start} onChange={(v) => setTo({ ...to, end: v })} placeholder="End date" /></div>
            <button className="toff-addbtn" onClick={addOff} disabled={!to.start}><Plus size={14} /> Add</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
