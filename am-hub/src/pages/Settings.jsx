import { useState } from "react";
import Shell from "../components/Shell.jsx";
import { useSettings, actions, resetEverything } from "../store/store.js";
import { activeTargets, goalFromTargets } from "../lib/targets.js";
import { monthKey as monthKeyFn, monthLabel as monthLabelFn } from "../lib/dates.js";
import TargetSetup from "../components/TargetSetup.jsx";
import { Target, Repeat, Bell, Sparkles, LayoutGrid, RotateCcw, Pencil } from "lucide-react";

const confirmReset = (what, fn) => () => { if (window.confirm(`Reset ${what} to default? This can't be undone.`)) fn(); };

const money = (n) => `$${Number(n).toLocaleString()}`;
const settings_goalLabel = (s) => (s.trackJpay !== false ? "Expansion Revenue" : "Upsell MRR");
const SECTIONS = [
  { key: "targets", label: "Targets", Icon: Target },
  { key: "worklist", label: "Worklist & cadence", Icon: Repeat },
  { key: "notifications", label: "Notifications", Icon: Bell },
  { key: "ai", label: "AI coach", Icon: Sparkles },
  { key: "layout", label: "Layout & resets", Icon: LayoutGrid },
];

export default function Settings() {
  const s = useSettings();
  const setGoal = actions.setGoal;
  const [section, setSection] = useState("targets");
  const conns = s.connections || {};
  const mKey = monthKeyFn();
  const AT = activeTargets(s, null, mKey);
  const goal = goalFromTargets(s, AT);
  const [setupOpen, setSetupOpen] = useState(false);

  return (
    <Shell>
      <div className="pagehead"><div><h1>Settings</h1></div></div>
      <div className="slayout">
        <div className="card snav">
          {SECTIONS.map((sec) => <a key={sec.key} className={section === sec.key ? "on" : ""} onClick={() => setSection(sec.key)} style={{ cursor: "pointer" }}><sec.Icon /> {sec.label}</a>)}
        </div>

        <div>
          {section === "targets" && (
            <div className="card panel">
              <h2>Targets</h2>
              <p className="psub">Your assigned {monthLabelFn()} revenue target sets the baseline; raise the stretch to aim past it. Daily dials/opps targets recalculate from the goal automatically.</p>
              <div className="frow"><div className="fl"><b>Expansion Revenue target ({monthLabelFn()})</b><span>{AT.source === "entered" ? "Entered at the start of the month" : "Projected — set your real target to lock it in"}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="num" style={{ fontWeight: 800, color: "var(--navy)", fontSize: 16 }}>{money(AT.expRev || 0)}</div>
                  <button className="newbtn-pill" onClick={() => setSetupOpen(true)}><Pencil size={14} /> Edit targets</button>
                </div>
              </div>
              <div className="frow"><div className="fl"><b>Stretch (%)</b><span>Aim past 100% to push yourself (120, 150…)</span></div><input className="t" value={s.stretch} onChange={(e) => setGoal({ stretch: Number(e.target.value) || 100 })} /></div>
              <div className="frow"><div className="fl"><b>Monthly goal</b><span>{settings_goalLabel(s)} × stretch</span></div><div className="num" style={{ fontWeight: 800, color: "var(--navy)", fontSize: 16 }}>{money(goal)}</div></div>
              <div className="frow"><div className="fl"><b>Track Jobber Payments (PGPV)</b><span>Turn off if JPay isn't a target this period — Hub shows upsell only</span></div><span className={`sw ${s.trackJpay ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ trackJpay: !s.trackJpay })} /></div>
              {setupOpen && <TargetSetup monthKey={mKey} onClose={() => setSetupOpen(false)} />}
            </div>
          )}

          {section === "worklist" && (
            <div className="card panel">
              <h2>Worklist &amp; cadence</h2>
              <p className="psub">How your daily Worklist is built and whether it shows.</p>
              <div className="frow"><div className="fl"><b>Show Worklist tab</b><span>Turn off to work straight from Salesforce / Revenue.io — Performance &amp; Pipeline keep syncing</span></div><span className={`sw ${s.worklistEnabled !== false ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ worklistEnabled: !(s.worklistEnabled !== false) })} /></div>
              <div className="frow"><div className="fl"><b>Working hours</b><span>Your list ranks calls for these hours; leftovers roll to the next day</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input className="t" type="time" style={{ width: 120 }} value={s.workStart || "08:00"} onChange={(e) => setGoal({ workStart: e.target.value })} />
                  <span style={{ color: "var(--muted)" }}>to</span>
                  <input className="t" type="time" style={{ width: 120 }} value={s.workEnd || "17:00"} onChange={(e) => setGoal({ workEnd: e.target.value })} />
                </div>
              </div>
              <div className="frow"><div className="fl"><b>Show scheduled calls</b><span>How early a booked call slides into your list before it starts</span></div>
                <select className="uiselect" value={s.schedLeadMin || 30} onChange={(e) => setGoal({ schedLeadMin: Number(e.target.value) })}>
                  <option value={30}>30 minutes before</option><option value={15}>15 minutes before</option><option value={10}>10 minutes before</option><option value={5}>5 minutes before</option>
                </select>
              </div>
              <div className="frow"><div className="fl"><b>Cadence engine</b><span>Who owns your sequences. Switching <b>overwrites all cadence state</b> — only one mode runs at a time.</span></div>
                <select className="uiselect" value={s.cadenceMode || "revio"} onChange={(e) => { if (window.confirm("Switching the cadence engine overwrites all current cadence state. Continue?")) setGoal({ cadenceMode: e.target.value }); }}>
                  <option value="revio">Revenue.io owns (Hub mirrors)</option><option value="hub">Hub owns (Hub schedules)</option>
                </select>
              </div>
              <p className="psub" style={{ marginTop: 4 }}>{(s.cadenceMode || "revio") === "revio"
                ? "Revenue.io decides what's due each day; the Hub reads and displays it. The Hub never schedules or changes cadences."
                : "The Hub stores each account's cadence + step and computes what's due daily. Revenue.io is just the dialer. Opp-cadence prompts appear in this mode."}</p>
            </div>
          )}

          {section === "notifications" && (
            <div className="card panel">
              <h2>Notifications</h2>
              <p className="psub">What surfaces in your morning brief &amp; alerts.</p>
              <div className="frow"><div className="fl"><b>Browser notifications</b><span>Desktop pop-up for new emails, events, Slack &amp; weather changes</span></div>
                <span className={`sw ${s.notifBrowser ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={async () => { if (!s.notifBrowser && typeof Notification !== "undefined") { const p = await Notification.requestPermission(); setGoal({ notifBrowser: p === "granted" }); } else setGoal({ notifBrowser: false }); }} /></div>
              <div className="frow"><div className="fl"><b>Notification sound</b><span>Soft chime when something new arrives</span></div>
                <span className={`sw ${s.notifSound ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ notifSound: !s.notifSound })} /></div>
              <div className="frow"><div className="fl"><b>New trials</b><span>Connect / Grow / Marketing Suite / AIR</span></div><span className={`sw ${s.nfTrials !== false ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ nfTrials: !(s.nfTrials !== false) })} /></div>
              <div className="frow"><div className="fl"><b>Grace period clocks</b></div><span className={`sw ${s.nfGrace !== false ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ nfGrace: !(s.nfGrace !== false) })} /></div>
              <div className="frow"><div className="fl"><b>#sales-critical leads routed to me</b></div><span className={`sw ${s.nfSalesCrit !== false ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ nfSalesCrit: !(s.nfSalesCrit !== false) })} /></div>
              <div className="frow"><div className="fl"><b>Outages (#war_room)</b></div><span className={`sw ${s.nfOutages !== false ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ nfOutages: !(s.nfOutages !== false) })} /></div>
              <div className="frow"><div className="fl"><b>Rainy-day call prompts</b></div><span className={`sw ${s.nfRain !== false ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ nfRain: !(s.nfRain !== false) })} /></div>
              <div className="frow"><div className="fl"><b>Daily target digest</b></div><span className={`sw ${s.nfDigest ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setGoal({ nfDigest: !s.nfDigest })} /></div>
            </div>
          )}

          {section === "ai" && (
            <div className="card panel">
              <h2>AI coach</h2>
              <p className="psub">Powers call scripts, email/text drafts, and development summaries &amp; plans.</p>
              <div className="frow"><div className="fl"><b>AI drafting</b><span>Generate scripts, emails &amp; texts on the Worklist and summaries/plans on Development</span></div>
                <span className={`sw ${conns["ChatGPT Enterprise"] !== false ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => actions.toggleConnection("ChatGPT Enterprise")} /></div>
              <p className="psub" style={{ marginTop: 4 }}>Connects through ChatGPT Enterprise during onboarding. When unavailable, AI features fall back to built-in templates.</p>
            </div>
          )}

          {section === "layout" && (
            <div className="card panel">
              <h2>Layout &amp; resets</h2>
              <p className="psub">Restore any customized view to its default arrangement.</p>
              <div className="frow"><div className="fl"><b>Dashboard tiles</b><span>Hub tile sizes, order &amp; visibility</span></div><button className="newbtn-pill" onClick={confirmReset("dashboard tiles", actions.resetLayout)}><RotateCcw size={15} /> Reset</button></div>
              <div className="frow"><div className="fl"><b>Performance tiles</b><span>Performance grid layout</span></div><button className="newbtn-pill" onClick={confirmReset("the Performance layout", actions.resetPerfLayout)}><RotateCcw size={15} /> Reset</button></div>
              <div className="frow"><div className="fl"><b>Pipeline stages</b><span>Board columns &amp; order</span></div><button className="newbtn-pill" onClick={confirmReset("pipeline stages", actions.resetStages)}><RotateCcw size={15} /> Reset</button></div>
              <div className="frow"><div className="fl"><b>Ranking weights</b><span>Worklist “Tune ranking” weights</span></div><button className="newbtn-pill" onClick={confirmReset("ranking weights", actions.resetRankWeights)}><RotateCcw size={15} /> Reset</button></div>
              <div className="frow"><div className="fl"><b>Guided tour</b><span>Replay the dashboard walkthrough</span></div><button className="newbtn-pill" onClick={actions.startTutorial}><Sparkles size={15} /> Replay</button></div>
              <div className="frow"><div className="fl"><b>Reset everything</b><span>Wipe all data (local &amp; saved) and restart from onboarding — for a fresh demo</span></div><button className="newbtn-pill danger" onClick={() => { if (window.confirm("Reset the entire dashboard and restart onboarding? This erases your saved setup and can't be undone.")) resetEverything(); }}><RotateCcw size={15} /> Reset &amp; restart</button></div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
