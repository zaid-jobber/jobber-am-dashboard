import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { actions } from "../store/store.js";
import { Home, ListChecks, GitBranch, Activity, BarChart3, GraduationCap, BookOpen, User, Settings as Cog, ArrowRight, ArrowLeft, X, Check, Sparkles } from "lucide-react";

const STEPS = [
  {
    route: "/", Icon: Home, title: "Hub — your morning brief", sub: null,
    body: "Start here each day. The Hub surfaces what changed overnight so you know who to call before you even open the worklist.",
    points: ["At the start of each month, set the targets you were given — the rest is projected", "New trials, upgrade momentum and account changes", "Announcement-channel Slack posts and today's weather by region"],
  },
  {
    route: "/activity", Icon: ListChecks, title: "Worklist — one ranked list", sub: null,
    body: "Your accounts in priority order — trials and follow-ups first — built by a self-learning ranking that adapts to what closes for you.",
    points: ["Work top-down; log the call and the next one slides in", "AI drafts scripts, emails and texts per account", "Fills your working hours, then rolls leftovers to tomorrow — no doubling"],
  },
  {
    route: "/pipeline?tab=board", Icon: GitBranch, title: "Pipeline — opportunity board", sub: "Board tab",
    body: "Every open opportunity on a board grouped by stage. Click any card to open the full account view.",
    points: ["Grouped by opportunity stage", "See deal value and age at a glance", "Jump straight into an account from a card"],
  },
  {
    route: "/pipeline?tab=signals", Icon: Activity, title: "Pipeline — Account changes", sub: "Account changes tab",
    body: "The second tab inside Pipeline. Tracks momentum and risk across your whole book, not just open opps.",
    points: ["Upgrade momentum and risk alerts", "Learning insights from your own results", "What the ranking noticed and why"],
  },
  {
    route: "/performance?tab=performance", Icon: BarChart3, title: "Performance — how you're tracking", sub: "Performance tab",
    body: "Your numbers against the month's targets, plus the feedback loops that make you better over time.",
    points: ["% to target, ASP, talk time, connect rate — by month or quarter", "Weather, signal hit-rate and cadence effectiveness loops", "Where you win — by segment and industry"],
  },
  {
    route: "/performance?tab=development", Icon: GraduationCap, title: "Performance — Development", sub: "Development tab",
    body: "The second tab inside Performance — your growth space, built for 1:1 prep and accountability.",
    points: ["Goals with auto-tracked progress", "Wins journal that auto-logs weekly and monthly", "AI summaries and plan builder for your next 1:1"],
  },
  {
    route: "/promos?tab=Promos", Icon: BookOpen, title: "Resources — everything to close", sub: "4 sub-tabs",
    body: "Your closing toolkit in one place so you're never digging through Drive or Confluence mid-call. Four tabs across the top.",
    points: ["Promos and a pricing calculator", "Marketing collateral and quote templates", "Proof Hub for case studies and social proof"],
  },
  {
    route: "/profile", Icon: User, title: "Profile — your scorecard", sub: null,
    body: "Your book of business at a glance, consistency stats, and where you add time off so targets and pace adjust.",
    points: ["Book mix, accounts owned and open opps", "Quota attainment trend and dial-goal streak", "Add vacation / days off — selling days update everywhere"],
  },
  {
    route: "/settings", Icon: Cog, title: "Settings — make it yours", sub: null,
    body: "Tune targets, the worklist engine, notifications and the AI coach. Everything you set in onboarding lives here too.",
    points: ["Targets and working hours", "Cadence engine and notification rules", "AI coach toggle, layout resets and replaying this tour"],
  },
];

export default function Tutorial({ onDone }) {
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => { nav(step.route); }, [i]); // eslint-disable-line

  const finish = () => { actions.completeTutorial(); onDone?.(); };
  const next = () => (last ? finish() : setI((n) => n + 1));
  const back = () => setI((n) => Math.max(0, n - 1));

  return (
    <div className="tour-scrim">
      <div className="tour-card">
        <button className="tour-x" onClick={finish} title="Skip tour"><X size={16} /></button>
        <div className="tour-head">
          <span className="tour-ic"><step.Icon size={20} /></span>
          <div><div className="tour-kicker"><Sparkles size={12} /> Step {i + 1} of {STEPS.length}{step.sub && <span className="tour-sub">{step.sub}</span>}</div><h2>{step.title}</h2></div>
        </div>
        <p className="tour-body">{step.body}</p>
        <ul className="tour-points">{step.points.map((p, k) => <li key={k}><Check size={14} /> {p}</li>)}</ul>
        <div className="tour-dots">{STEPS.map((_, k) => <i key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} />)}</div>
        <div className="tour-actions">
          {i > 0 ? <button className="tour-back" onClick={back}><ArrowLeft size={15} /> Back</button> : <button className="tour-back" onClick={finish}>Skip</button>}
          <button className="tour-next" onClick={next}>{last ? <>Finish <Check size={15} /></> : <>Next <ArrowRight size={15} /></>}</button>
        </div>
      </div>
    </div>
  );
}
