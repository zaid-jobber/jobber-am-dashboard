import Shell from "../components/Shell.jsx";
import { Link } from "react-router-dom";
import {
  Upload, Sprout, AlertTriangle, Ruler, CreditCard, Briefcase, Cpu, Home,
  Sparkles, RotateCcw, Phone, MessageSquare, Mail, GripVertical, Pencil, Trash2, Plus, Save, Download, Copy,
} from "lucide-react";

const Tools = () => <div className="tools"><GripVertical /><Pencil /><Trash2 /></div>;

export default function Cadence() {
  return (
    <Shell>
      <div className="crumb"><Link to="/activity">‹ Activity List</Link></div>
      <div className="pagehead"><div><h1>Cadence Builder</h1><p>Describe it, AI builds it, tune &amp; save</p></div></div>

      <div className="clayout">
        <div className="card lib">
          <div className="libhead"><h3>Your cadences</h3><span className="imp"><Upload /> Import</span></div>
          <div className="seclab">EXP standard sequences</div>
          <div className="cad sel"><div className="ci"><Sprout /></div><div className="ct"><b>EXP - Grow Trial</b><div className="mt">11 steps · 11d <span className="chips"><Phone /><MessageSquare /><Mail /></span></div></div><div className="tools"><Download /><Copy /><Trash2 /></div></div>
          <div className="cad"><div className="ci"><Sprout /></div><div className="ct"><b>EXP - Connect Trial</b><div className="mt">10 steps · 14d <span className="chips"><Phone /><MessageSquare /><Mail /></span></div></div></div>
          <div className="cad"><div className="ci"><AlertTriangle /></div><div className="ct"><b>EXP - Grace Period</b><div className="mt">10 steps · 7d <span className="chips"><Phone /><Mail /></span></div></div></div>
          <div className="cad"><div className="ci"><Ruler /></div><div className="ct"><b>EXP - Quoters by Usage</b><div className="mt">13 steps · 14d <span className="chips"><Phone /><MessageSquare /></span></div></div></div>
          <div className="cad"><div className="ci"><CreditCard /></div><div className="ct"><b>EXP - Jobber Payments</b><div className="mt">10 steps · 9d <span className="chips"><Phone /><Mail /></span></div></div></div>
          <div className="cad"><div className="ci"><Briefcase /></div><div className="ct"><b>EXP - Opp Follow-Up</b><div className="mt">11 steps · 7d <span className="chips"><Mail /><Phone /></span></div></div></div>
          <div className="cad"><div className="ci"><Cpu /></div><div className="ct"><b>EXP - NBA Accounts</b><div className="mt">12 steps · 14d <span className="chips"><Phone /><MessageSquare /></span></div></div></div>
          <div className="seclab">Saved by you</div>
          <div className="cad"><div className="ci"><Home /></div><div className="ct"><b>Grow → Landscaping</b><div className="mt">9 steps · 10d <span className="chips"><Phone /><MessageSquare /></span></div></div><div className="tools"><Download /><Copy /><Trash2 /></div></div>
          <button className="newbtn">+ New cadence</button>
        </div>

        <div className="card builder">
          <div className="aibar">
            <div className="lab"><Sparkles /> Build with AI</div>
            <div className="arow"><input defaultValue="Convert a Grow trial before it ends" /><button className="build">Build</button></div>
          </div>
          <div className="bhead">
            <div>
              <span className="nm">EXP - Grow Trial <small>AI-tuned</small></span>
              <div className="meta">11 steps · 11 days · opens multi-channel to reach fast</div>
            </div>
            <div className="right"><button className="gbtn"><RotateCcw /> Regenerate</button></div>
          </div>
          <div className="enroll">
            <span className="el">Enrollment</span>
            <span className="segtog"><button>Manual</button><button className="on">Auto</button></span>
            <span className="rulechip">When: Grow trial starts <span className="edit">edit</span></span>
          </div>

          <div className="steps">
            <div className="step">
              <div className="railcol"><div className="daychip">DAY<small>1</small></div><div className="rail" /></div>
              <div className="stepcard">
                <div className="sline"><div className="chanico call"><Phone /></div><div className="chanico text"><MessageSquare /></div><div className="stitle">Call + SMS — first contact<small>Reach fast while the trial's hot</small></div><Tools /></div>
                <div className="preview"><span className="copy">Copy SMS</span><div className="pk">On the call · <span className="aitag">AI script</span></div>Live P.L.A.N. script. SMS: "Saw you started a Grow trial — got 10 min this week?"</div>
              </div>
            </div>
            <div className="step">
              <div className="railcol"><div className="daychip">DAY<small>2</small></div><div className="rail" /></div>
              <div className="stepcard">
                <div className="sline"><div className="chanico email"><Mail /></div><div className="stitle">Value email<small>What Grow unlocks for their goals</small></div><Tools /></div>
                <div className="preview"><span className="copy">Open Gmail draft</span><div className="pk">Subject · AI-drafted</div>"Getting the most out of your Grow trial…"</div>
              </div>
            </div>
            <div className="step">
              <div className="railcol"><div className="daychip">DAY<small>4</small></div><div className="rail" /></div>
              <div className="stepcard"><div className="sline"><div className="chanico call"><Phone /></div><div className="chanico email"><Mail /></div><div className="stitle">Call + Email — discovery<small>Streamline vs revenue · 3–4 problems</small></div><Tools /></div></div>
            </div>
            <div className="step">
              <div className="railcol"><div className="daychip">DAY<small>7</small></div><div className="rail" /></div>
              <div className="stepcard"><div className="sline"><div className="chanico text"><MessageSquare /></div><div className="stitle">Text nudge<small>Quick re-touch</small></div><Tools /></div></div>
            </div>
            <div className="step">
              <div className="railcol"><div className="daychip">DAY<small>9</small></div><div className="rail" /></div>
              <div className="stepcard"><div className="sline"><div className="chanico call"><Phone /></div><div className="chanico email"><Mail /></div><div className="stitle">Call + Email — mid-trial review<small>Solution + pricing (push annual/ACBM)</small></div><Tools /></div></div>
            </div>
            <div className="step">
              <div className="railcol"><div className="daychip">DAY<small>12</small></div></div>
              <div className="stepcard"><div className="sline"><div className="chanico call"><Phone /></div><div className="stitle">Close call + update status<small>Convert &amp; book training, or set follow-up</small></div><Tools /></div></div>
            </div>
          </div>

          <button className="addstep"><Plus /> Add step</button>
          <div className="bfoot">
            <button className="save"><Save /> Save</button>
            <button className="save"><Download /> Export</button>
            <button className="apply">Apply to account</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
