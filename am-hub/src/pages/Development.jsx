import Shell from "../components/Shell.jsx";
import { Layers, Trophy, Headphones, Users, Lightbulb, Target, GitBranch, Sparkles } from "lucide-react";

const Dots = ({ on }) => (
  <span className="dots">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < on ? "on" : ""} />)}</span>
);

export default function Development() {
  return (
    <Shell>
      <div className="pagehead"><div><h1>Development</h1><p>Your journal, goals &amp; coaching</p></div></div>

      <div className="dlayout">
        <div className="card" style={{ padding: 22 }}>
          <div className="composer"><input placeholder="Log a win, learning, coaching note or reflection…" /><button className="add">Add</button></div>
          <div className="typetabs">
            <span className="tt on"><Layers /> All</span>
            <span className="tt"><Trophy /> Wins</span>
            <span className="tt"><Headphones /> Coaching</span>
            <span className="tt"><Users /> 1:1</span>
            <span className="tt"><Lightbulb /> Learnings</span>
            <span className="tt"><Target /> Goals</span>
          </div>

          <div className="entry"><div className="eico win"><Trophy /></div><div className="ebody"><div className="etop"><span className="etag">Win</span><span className="ed">Today</span></div><b>Closed Summit Roofing → Grow (ACBM, +$180)</b><p>Two-Way SMS demo sealed it. ACBM framing worked — monthly felt expensive.</p></div></div>
          <div className="entry"><div className="eico learn"><Lightbulb /></div><div className="ebody"><div className="etop"><span className="etag">Learning</span><span className="ed">Yest</span></div><b>Leading with pricing too early on JPay calls</b><p>Lost Coastal by quoting fees before value. Next: economic impact first, rate review only if pushed.</p></div></div>
          <div className="entry"><div className="eico oneone"><Users /></div><div className="ebody"><div className="etop"><span className="etag">1:1 · S. Walker</span><span className="ed">Mon</span></div><b>Focus: lift JPay close rate from 33%</b><p>Action — shadow 2 of Louis's JPay calls; use the rate-review tool earlier.</p></div></div>
          <div className="entry"><div className="eico coach"><Headphones /></div><div className="ebody"><div className="etop"><span className="etag">Call coaching</span><span className="ed">Tue</span></div><b>Discovery talk ratio 61% — too high</b><p>Aim ~46/54. Ask 11–14 questions; let silences sit after pricing.</p></div></div>
          <div className="entry"><div className="eico goal"><Target /></div><div className="ebody"><div className="etop"><span className="etag">Goal</span><span className="ed">May 1</span></div><b>Hit 100% annualized quota → Peak Performers</b><p>Both KPIs ≥75%. JPay PGPV is the gap.</p></div></div>
        </div>

        <div>
          <div className="card rcard" style={{ padding: 22 }}>
            <div className="ch"><div className="htitle"><span className="hic"><Target /></span><h3>Goals</h3></div></div>
            <div className="goal-i"><div className="gt">Annualized quota <span>78%</span></div><div className="gtrack"><i style={{ width: "78%" }} /></div></div>
            <div className="goal-i"><div className="gt">JPay close rate <span>33% → 45%</span></div><div className="gtrack"><i style={{ width: "55%" }} /></div></div>
            <div className="goal-i"><div className="gt">Talk time / day <span>78 / 90m</span></div><div className="gtrack"><i style={{ width: "87%" }} /></div></div>
          </div>

          <div className="card rcard" style={{ padding: 22 }}>
            <div className="ch"><div className="htitle"><span className="hic"><GitBranch /></span><h3>Competencies</h3></div></div>
            <div className="comp"><span className="cn">Customer Focus</span><Dots on={4} /></div>
            <div className="comp"><span className="cn">Critical Thinking</span><Dots on={3} /></div>
            <div className="comp"><span className="cn">Execution</span><Dots on={4} /></div>
            <div className="comp"><span className="cn">Leadership</span><Dots on={2} /></div>
          </div>

          <div className="card rcard" style={{ padding: 22 }}>
            <div className="ch"><div className="htitle"><span className="hic"><Users /></span><h3>1:1s</h3></div></div>
            <div className="ones"><div className="od">JUN<br />2</div><div className="ot"><b>Next · S. Walker</b><span>Mon 10:00a</span></div></div>
            <div className="ones"><div className="od">MAY<br />26</div><div className="ot"><b>JPay focus + shadowing</b><span>Logged</span></div></div>
          </div>

          <div className="card rcard" style={{ padding: 22 }}>
            <div className="ch"><div className="htitle"><span className="hic"><Sparkles /></span><h3>Suggested focus</h3></div></div>
            <div className="focus"><Sparkles /><div><b>JPay is your gap.</b><p>Close rate 33% vs 58% on trials. From your logs: pricing comes up too early. Try the rate-review tool later.</p></div></div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
