import { useState, useMemo } from "react";
import { useJournal, useDevGoals, useActivity, useSettings, useAccounts, actions } from "../store/store.js";
import { computePerformance } from "../lib/performance.js";
import { aiGenerate } from "../lib/ai.js";
import { Layers, Trophy, Headphones, Users, Lightbulb, Target, Sparkles, BarChart3, Trash2, Plus, Minus, CheckSquare, Square, BookmarkPlus } from "lucide-react";

// Metrics a goal can auto-track (read live from Performance).
const AUTO_METRICS = [
  ["", "Manual / milestone"], ["quota", "Quota %"], ["talk", "Talk time / day"], ["winRate", "Win rate %"],
  ["connRate", "Connect rate %"], ["opps", "Opps created"], ["asp", "ASP $"], ["trialConv", "Trial conversion %"],
];

const TYPES = [
  { key: "all", label: "All", Icon: Layers },
  { key: "Win", label: "Wins", Icon: Trophy },
  { key: "Stats", label: "Stats", Icon: BarChart3 },
  { key: "Coaching", label: "Coaching", Icon: Headphones },
  { key: "1:1", label: "1:1", Icon: Users },
  { key: "Learning", label: "Learnings", Icon: Lightbulb },
  { key: "Goal", label: "Goals", Icon: Target },
];
const EICO = { Win: "win", Learning: "learn", "1:1": "oneone", Coaching: "coach", Goal: "goal", Stats: "stats" };
const DATE_RANGES = [["all", "All time"], ["week", "This week"], ["month", "This month"]];
const DAY = 864e5;
const rel = (ts) => { if (!ts) return ""; const d = Date.now() - ts; if (d < DAY) return "Today"; if (d < 2 * DAY) return "Yesterday"; const n = Math.floor(d / DAY); if (n < 7) return `${n}d ago`; if (n < 31) return `${Math.floor(n / 7)}w ago`; return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" }); };

export default function DevelopmentPanel() {
  const journal = useJournal();
  const goals = useDevGoals();
  const activity = useActivity();
  const settings = useSettings();
  const accounts = useAccounts();
  const P = useMemo(() => computePerformance(accounts, activity, settings, "month"), [accounts, activity, settings]);

  const [text, setText] = useState("");
  const [composeType, setComposeType] = useState("Win");
  const [typeF, setTypeF] = useState("all");
  const [dateF, setDateF] = useState("all");
  const [aiOut, setAiOut] = useState("");
  const [aiKind, setAiKind] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [planGoal, setPlanGoal] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [ng, setNg] = useState({ label: "", auto: "", target: 100, unit: "%" });

  // Weekly stats + monthly wins are persisted by the rollup job (store) and live
  // in `journal` — no need to synthesize them here.
  const feed = useMemo(() => {
    return journal.map((j) => ({ ...j, ts: j.ts || Date.now() }))
      .filter((e) => typeF === "all" || e.type === typeF)
      .filter((e) => dateF === "all" || (dateF === "week" && Date.now() - e.ts < 7 * DAY) || (dateF === "month" && Date.now() - e.ts < 31 * DAY))
      .sort((a, b) => b.ts - a.ts);
  }, [journal, typeF, dateF]);

  const add = () => { const t = text.trim(); if (!t) return; actions.addJournal({ type: composeType, title: t, text: "" }); setText(""); };

  // Auto goals read the live metric; manual/milestone use stored value.
  const METRIC = { quota: P.expRevPct, talk: P.talkPerDay, winRate: P.winRate, connRate: P.connRate, opps: P.month.opps, asp: P.asp, trialConv: P.trialConv };
  const goalCurrent = (g) => (g.auto ? (METRIC[g.auto] || 0) : (g.current || 0));

  const summarize = () => {
    setAiBusy(true); setAiKind("summary");
    const period = DATE_RANGES.find(([k]) => k === dateF)?.[1] || "All time";
    const entriesText = feed.slice(0, 24).map((e) => `- [${e.type}] ${e.title}`).join("\n");
    const goalsText = goals.map((g) => g.kind === "milestone" ? `${g.label}: ${g.done ? "done" : "in progress"}` : `${g.label}: ${goalCurrent(g)}/${g.target}${g.unit}`).join("; ");
    const prompt = `Period: ${period}.\nGoals — ${goalsText}.\nJournal entries:\n${entriesText}`;
    aiGenerate("summary", prompt, {}).then((r) => { setAiOut(r.text); setAiBusy(false); });
  };
  const buildPlan = () => {
    const g = planGoal.trim() || goals[0]?.label || "improve my close rate";
    setAiBusy(true); setAiKind("plan"); setPlanGoal(g);
    aiGenerate("plan", g, {}).then((r) => { setAiOut(r.text); setAiBusy(false); });
  };
  const saveAi = () => {
    if (!aiOut) return;
    actions.addJournal(aiKind === "plan" ? { type: "Goal", title: `Growth plan: ${planGoal}`, text: aiOut } : { type: "Coaching", title: "Development summary", text: aiOut });
    setAiOut(""); setAiKind("");
  };
  const addGoal = () => {
    const label = ng.label.trim(); if (!label) return;
    if (ng.auto === "milestone") actions.addDevGoal({ label, kind: "milestone", done: false });
    else actions.addDevGoal({ label, kind: "progress", auto: ng.auto || null, current: 0, target: Number(ng.target) || 100, unit: ng.unit });
    setNg({ label: "", auto: "", target: 100, unit: "%" }); setAddOpen(false);
  };

  return (
    <div className="dlayout">
      <div className="card" style={{ padding: 22 }}>
        <div className="composer2">
          <div className="cmp2-top">
            <select className="comptype" value={composeType} onChange={(e) => setComposeType(e.target.value)}>
              {["Win", "Learning", "Coaching", "1:1", "Goal"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <span className="cmp2-hint">Press ⌘↵ to save</span>
            <button className="add" onClick={add}>Add</button>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => (e.key === "Enter" && (e.metaKey || e.ctrlKey)) && add()} placeholder="Log a win, learning, coaching note or reflection — paste a full call recap if you like…" rows={3} />
        </div>

        <div className="devfilters">
          <div className="typetabs">
            {TYPES.map((t) => <span key={t.key} className={`tt ${typeF === t.key ? "on" : ""}`} onClick={() => setTypeF(t.key)}><t.Icon /> {t.label}</span>)}
          </div>
          <select className="datef" value={dateF} onChange={(e) => setDateF(e.target.value)}>
            {DATE_RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        {feed.length === 0 && <div className="bcol-empty" style={{ padding: "18px 2px" }}>No entries for this filter.</div>}
        {feed.map((e) => (
          <div className="entry" key={e.id}>
            <div className={`eico ${EICO[e.type] || "learn"}`}>{e.type === "Win" ? <Trophy /> : e.type === "Stats" ? <BarChart3 /> : e.type === "1:1" ? <Users /> : e.type === "Coaching" ? <Headphones /> : e.type === "Goal" ? <Target /> : <Lightbulb />}</div>
            <div className="ebody">
              <div className="etop"><span className="etag">{e.type}{e.auto ? " · auto" : ""}</span><span className="ed">{rel(e.ts)}</span>{!e.auto && <button className="entry-x" title="Delete" onClick={() => actions.removeJournal(e.id)}><Trash2 size={13} /></button>}</div>
              <b>{e.title}</b>
              {e.text && (/\n/.test(e.text) ? <div className="entry-lines">{e.text.split(/\n+/).filter(Boolean).map((ln, i) => <p key={i}>{ln}</p>)}</div> : <p>{e.text}</p>)}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="card rcard" style={{ padding: 22 }}>
          <div className="ch"><div className="htitle"><span className="hic"><Sparkles /></span><h3>AI coach</h3></div></div>
          <p className="csub" style={{ margin: "0 0 12px" }}>Summarize your development or build a growth plan.</p>
          <button className="ai-btn" onClick={summarize} disabled={aiBusy}>{aiBusy ? "Thinking…" : `Summarize my development (${DATE_RANGES.find(([k]) => k === dateF)?.[1]})`}</button>
          <div className="ai-planrow">
            <input value={planGoal} onChange={(e) => setPlanGoal(e.target.value)} placeholder="Goal to build a plan for…" />
            <button className="ai-btn sm" onClick={buildPlan} disabled={aiBusy}>Plan</button>
          </div>
          {aiOut && (
            <div className="ai-out">
              {aiOut.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
              <button className="ai-save" onClick={saveAi}><BookmarkPlus size={13} /> {aiKind === "plan" ? "Save plan to journal" : "Save summary"}</button>
            </div>
          )}
        </div>

        <div className="card rcard" style={{ padding: 22 }}>
          <div className="ch"><div className="htitle"><span className="hic"><Target /></span><h3>Goals</h3></div></div>
          {goals.map((g) => {
            if (g.kind === "milestone") return (
              <div className="goal-i ms" key={g.id}>
                <button className="ms-check" onClick={() => actions.updateDevGoal(g.id, { done: !g.done })}>{g.done ? <CheckSquare size={17} /> : <Square size={17} />}</button>
                <span className={`ms-lab ${g.done ? "done" : ""}`}>{g.label}</span>
                <button className="goal-del" onClick={() => actions.removeDevGoal(g.id)}><Trash2 size={12} /></button>
              </div>
            );
            const cur = goalCurrent(g); const pc = Math.min(100, Math.round((cur / g.target) * 100));
            return (
              <div className="goal-i" key={g.id}>
                <div className="gt">{g.label} {g.auto && <span className="auto-tag">auto</span>}<span className="gval">{cur}{g.unit} / {g.target}{g.unit}</span>
                  <span className="goal-ctrls">
                    {!g.auto && <><button onClick={() => actions.updateDevGoal(g.id, { current: Math.max(0, (g.current || 0) - 1) })}><Minus size={11} /></button><button onClick={() => actions.updateDevGoal(g.id, { current: (g.current || 0) + 1 })}><Plus size={11} /></button></>}
                    <button onClick={() => actions.removeDevGoal(g.id)}><Trash2 size={11} /></button>
                  </span>
                </div>
                <div className="gtrack"><i style={{ width: `${pc}%` }} /></div>
              </div>
            );
          })}
          {addOpen ? (
            <div className="goal-form">
              <input autoFocus value={ng.label} onChange={(e) => setNg({ ...ng, label: e.target.value })} placeholder="Goal name" />
              <select value={ng.auto} onChange={(e) => setNg({ ...ng, auto: e.target.value })}>
                {AUTO_METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                <option value="milestone">Milestone (done / not)</option>
              </select>
              {ng.auto !== "milestone" && <div className="goal-form-row"><input type="number" value={ng.target} onChange={(e) => setNg({ ...ng, target: e.target.value })} placeholder="Target" /><input value={ng.unit} onChange={(e) => setNg({ ...ng, unit: e.target.value })} placeholder="Unit" /></div>}
              <div className="goal-form-acts"><button className="ab primary" onClick={addGoal}>Add goal</button><button className="ab" onClick={() => setAddOpen(false)}>Cancel</button></div>
            </div>
          ) : (
            <button className="goal-add" onClick={() => setAddOpen(true)}><Plus size={13} /> Add goal</button>
          )}
        </div>

      </div>
    </div>
  );
}
