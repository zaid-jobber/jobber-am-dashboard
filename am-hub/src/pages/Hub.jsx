import { useState } from "react";
import { Link } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import { TileControls, CustomizePanel } from "../components/Tile.jsx";
import Icon from "../components/Icon.jsx";
import { hub, quoteOfDay, pipeline } from "../data/mock.js";
import { gmailSearchUrl } from "../lib/api.js";
import { useSettings, useFeeds, useToday, useAccounts, useLayout, useTasks, useQuickNotes, useEditing, useSpif, useActivity, useProfile, actions, pollFeeds } from "../store/store.js";
import { computeTargets, pacing, activeTargets, goalFromTargets } from "../lib/targets.js";
import { changeFeed } from "../lib/signals.js";
import { todayLabel, sellingDaysLeft, sellingDaysInMonth, daysOffThisMonth, monthKey as monthKeyFn, monthLabel as monthLabelFn, greeting, callWindowNote } from "../lib/dates.js";
import TargetSetup from "../components/TargetSetup.jsx";
import { Target, Zap, Slack, CloudSun, Activity, Calendar, Mail, BarChart3, ArrowUpRight, Quote, Sunrise, Pencil, Check, TrendingUp, TrendingDown, Compass, Trophy, Clock, Award, CheckSquare, Square, StickyNote, Plus, Trash2, CloudRain, RefreshCw, X } from "lucide-react";

const money = (n) => `$${(n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + "k" : n)}`;
const SLACK_URL = "slack://open";
const GCAL_URL = "https://calendar.google.com/calendar/u/0/r";
const GMAIL_URL = "https://mail.google.com";
const AMBITION_URL = "https://jobber.ambition.com/home/scorecards/";

const LinkGo = ({ href, title }) => <a className="go" href={href} target="_blank" rel="noreferrer" title={title}><ArrowUpRight /></a>;

// pull explicit daily-target numbers out of the focus text
function parseTargets(text) {
  const o = {};
  const grab = (re) => { const m = re.exec(text); return m ? parseInt(m[1], 10) : null; };
  const dials = grab(/(\d+)\s*(dials?|calls?)/i); if (dials) o.dials = dials;
  const opps = grab(/(\d+)\s*(opps?|opportunit)/i); if (opps) o.opps = opps;
  const sms = grab(/(\d+)\s*(sms|texts?)/i); if (sms) o.sms = sms;
  const talk = grab(/(\d+)\s*(min|minutes|talk)/i); if (talk) o.talk = talk;
  return o;
}
function suggestFocus(feeds) {
  const rain = (feeds.weather?.zones || []).filter((z) => z.hot).map((z) => z.z);
  if (rain.length) return `Rain in ${rain.join(" & ")} — call landscaping & irrigation accounts`;
  return "Push your trials and grace-period accounts first";
}

// ---- stateful tile bodies ----
function NotesTile() {
  const notes = useQuickNotes();
  const [text, setText] = useState("");
  const save = () => { const t = text.trim(); if (!t) return; actions.addQuickNote(t); setText(""); };
  return (
    <div className="notetile">
      <div className="nt-row"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Jot a quick note…" /><button onClick={save}><Check size={15} /></button></div>
      <ul className="nt-list">
        {notes.length === 0 && <li className="nt-empty">A quick scratchpad — jot anything you need to remember.</li>}
        {notes.slice(0, 5).map((n) => <li key={n.id}><span>{n.text}</span><button className="nt-x" onClick={() => actions.removeQuickNote(n.id)} title="Delete"><Trash2 size={13} /></button></li>)}
      </ul>
    </div>
  );
}
// build a today timestamp from a "HH:MM" time input
function dueFromTime(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.getTime();
}
const fmtDue = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
function TasksTile() {
  const tasks = useTasks();
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const add = () => { const t = text.trim(); if (!t) return; actions.addTask(t, dueFromTime(time)); setText(""); setTime(""); };
  const now = Date.now();
  return (
    <div className="tasktile">
      <div className="tt-add">
        <input className="tt-text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a task…" />
        <input className="tt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} title="Due time (optional)" />
        <button onClick={add} title="Add"><Plus size={15} /></button>
      </div>
      <ul className="tt-list">
        {tasks.length === 0 && <li className="nt-empty" style={{ listStyle: "none" }}>No tasks yet. Add one with an optional due time to get a reminder.</li>}
        {tasks.map((t) => {
          const overdue = t.due && !t.done && now >= t.due;
          return (
            <li key={t.id} className={t.done ? "on" : ""}>
              <span className="tt-ck" onClick={() => actions.toggleTask(t.id)}>{t.done ? <CheckSquare size={16} /> : <Square size={16} />}</span>
              <span className="tt-t">{t.text}</span>
              {t.due && <span className={`tt-due ${overdue ? "over" : ""}`}><Clock size={11} /> {fmtDue(t.due)}</span>}
              <button className="nt-x" onClick={() => actions.removeTask(t.id)} title="Delete"><Trash2 size={13} /></button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Hub() {
  const feeds = useFeeds();
  // Defensive defaults — live feed payloads can arrive partial/malformed.
  const weather = feeds.weather || { zones: [], lead: "" };
  const inbox = feeds.inbox || [];
  const schedule = feeds.schedule || [];
  const slack = feeds.slack || [];
  const today = useToday();
  const accounts = useAccounts();
  const layout = useLayout();
  const editing = useEditing();
  const spifOn = useSpif();
  const activity = useActivity();
  const q = quoteOfDay();
  const [focusInput, setFocusInput] = useState("");
  const [editFocus, setEditFocus] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const doRefresh = async () => { if (refreshing) return; setRefreshing(true); try { await pollFeeds(); } finally { setTimeout(() => setRefreshing(false), 500); } };

  const settings = useSettings();
  const profile = useProfile();
  const timeOff = profile.timeOff || [];
  const daysLeft = sellingDaysLeft(new Date(), timeOff);
  const daysTotal = sellingDaysInMonth(new Date(), timeOff);
  const offDays = daysOffThisMonth(new Date(), timeOff);

  // Active monthly targets: AM-entered set if confirmed, else a projection.
  const mKey = monthKeyFn();
  const AT = activeTargets(settings, null, mKey);
  const targetsEntered = !!settings.monthlyTargets?.[mKey]?.entered;
  const promptDismissed = !!settings.targetPrompt?.[mKey];
  const [setupOpen, setSetupOpen] = useState(false);

  const goal = goalFromTargets(settings, AT);
  const T = computeTargets({ goal, booked: activity.booked, daysLeft });
  const P = pacing({ goal, booked: activity.booked, daysLeft, daysTotal });
  // Daily recommendations come from the month's targets spread over days left.
  const perDay = (total, done) => Math.max(0, Math.ceil((Math.max(0, total) - (done || 0)) / Math.max(1, daysLeft)));
  const monthlyOpps = (AT.createdOppsUpsell || 0) + (AT.createdOppsJpay || 0);
  const rec = {
    dials: perDay(AT.dials, activity.month.dials),
    sms: perDay(AT.sms, activity.month.sms),
    talk: Math.max(0, Math.ceil((AT.talk || 0) / Math.max(1, daysTotal))),
    opps: perDay(monthlyOpps, activity.month.opps),
    ...(today.overrides || {}),
  };

  // live week: only show weekdays elapsed so far, with today highlighted
  const todayIdx = Math.min(4, Math.max(0, (new Date().getDay() + 6) % 7)); // Mon=0…Fri=4 (weekend clamps to Fri)
  const weekElapsed = activity.week.slice(0, todayIdx + 1);
  const weekMax = Math.max(...weekElapsed, 1);
  const weekAvg = Math.round(weekElapsed.reduce((a, b) => a + b, 0) / weekElapsed.length);
  const monthLabel = new Date().toLocaleString(undefined, { month: "long" });
  const mTalk = `${Math.round((activity.month.talk || 0) / 60)}h`;
  const suggestion = suggestFocus(feeds);
  const nameOf = (id) => accounts[id]?.name || id;

  const submitFocus = () => {
    const text = focusInput.trim();
    if (!text) return;
    actions.setToday({ focus: text, overrides: parseTargets(text) });
    actions.addJournal({ type: "Goal", title: "Today's focus", text });
    setFocusInput(""); setEditFocus(false);
  };
  const startEditFocus = () => { setFocusInput(today.focus); setEditFocus(true); };
  const showFocusInput = !today.focus || editFocus;

  const trials = Object.values(accounts).filter((a) => a.trial || /trial/i.test(a.planLabel || ""));
  const wins = (pipeline.find((c) => c.key === "won")?.cards || []);

  // ---- Playbook: what to do this hour, from the data ----
  const win = callWindowNote();
  const dialsDone = activity.today.dials || 0;
  const dialsRec = rec.dials || 40;
  const dialsLeft = Math.max(0, dialsRec - dialsDone);
  const rainZones = (weather.zones || []).filter((z) => z.hot).map((z) => z.z);
  const plays = [];
  if (rainZones.length) plays.push({ icon: CloudRain, text: `Rain in ${rainZones.join(" & ")} — call your outdoor trades (landscaping, irrigation) while they're inside.` });
  if (trials.length) plays.push({ icon: Clock, text: `${trials.length} trial${trials.length > 1 ? "s" : ""} ending — convert before they lapse.` });
  const sched = schedule.filter((e) => e.tone === "navy" || e.tone === "lime").length;
  if (sched) plays.push({ icon: Calendar, text: `${sched} scheduled call${sched > 1 ? "s" : ""} today — prep notes beforehand.` });
  if (plays.length < 3) plays.push({ icon: Target, text: "Work top-ranked accounts in your list — highest close-likelihood first." });

  // ---- tile registry ----
  const TILES = {
    slack: { title: "Slack", Icon: Slack, link: { href: SLACK_URL, title: "Open Slack" }, body: () => (
      <ul className="slk">{(() => {
        const posts = slack.slice(0, 6);
        if (posts.length === 0) return <li className="nt-empty" style={{ padding: "8px 2px" }}>No recent messages.</li>;
        return posts.map((s, i) => (
          <li key={i}><span className={`si2 ${s.tone || ""}`}><Icon name={s.icon} size={18} /></span><a className="st" href={s.url || SLACK_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}><span className="ch2">{s.channel}</span><b>{s.title}</b><span>{s.sub}</span></a><span className="when">{s.when}</span></li>
        ));
      })()}</ul>
    ) },
    activity: { title: "Activity", Icon: BarChart3, link: { href: AMBITION_URL, title: "Open Ambition" }, body: () => (
      <>
        <div className="weekhead"><span className="weeklabel">This week · dials</span><span className="weekavg">avg <b>{weekAvg}</b>/day</span></div>
        <div className="bars big">{weekElapsed.map((n, i) => (
          <div className={`col ${i === todayIdx ? "hot" : ""}`} key={i}><span className="barnum">{n}</span><div className="bk" style={{ height: `${Math.round((n / weekMax) * 100)}%` }} /><div className="dy">{["M", "T", "W", "T", "F"][i]}{i === todayIdx ? "•" : ""}</div></div>
        ))}</div>
        <div className="monthrow">
          <div className="mr-h">{monthLabel} so far</div>
          <div className="mr-stats">
            <div className="mrs"><b>{activity.month.dials}</b><span>dials</span></div>
            <div className="mrs"><b>{activity.month.sms}</b><span>SMS</span></div>
            <div className="mrs"><b>{mTalk}</b><span>talk</span></div>
            <div className="mrs"><b>{activity.month.opps}</b><span>opps</span></div>
            <div className="mrs"><b>{T.pct}%</b><span>to target</span></div>
          </div>
        </div>
      </>
    ) },
    recent: { title: "Recent account changes", Icon: Activity, link: { to: "/pipeline?tab=signals", title: "All account changes" }, body: () => (
      <ul className="rc">
        {changeFeed(accounts, { limit: 6 }).map((c, i) => (
          <li key={i}><span className={`ri ${c.heat ? "b" : "c"}`}><Icon name={c.icon} size={18} /></span><Link className="rt" to={`/activity?focus=${c.accId}`} style={{ textDecoration: "none", color: "inherit" }}><b>{c.name}</b><span>{c.title} · {c.detail}</span></Link><span className="rtag">{c.ageDays}d</span></li>
        ))}
      </ul>
    ) },
    schedule: { title: "Today's schedule", Icon: Calendar, refresh: true, link: { href: GCAL_URL, title: "Open Google Calendar" }, body: () => (
      <div className="tl">{schedule.map((e, i) => (
        <div className="row" key={i}><div className="tm">{e.tm}</div><div className={`ev ${e.tone || "soft"}`}>{e.title}{e.sub ? <small>{e.sub}</small> : null}</div></div>
      ))}</div>
    ) },
    inbox: { title: "Inbox", Icon: Mail, refresh: true, link: { href: GMAIL_URL, title: "Open Gmail" }, body: () => (
      <ul className="mail">{inbox.map((m, i) => (
        <li key={i}><span className={`mav ${m.av}`}>{m.from}</span><a className="mt" href={gmailSearchUrl(m.subject)} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}><b>{m.subject}</b><span>{m.sub}</span></a></li>
      ))}</ul>
    ) },
    weather: { title: "Weather & call timing", Icon: CloudSun, tint: true, refresh: true, body: () => (
      <>
        <div className="wx-lead"><Icon name="CloudRain" /><div>{weather.lead}</div></div>
        <div className="wx-row">{(weather.zones || []).map((z) => (
          <div className={`wx ${z.hot ? "hot" : ""}`} key={z.z}><div className="z">{z.z}</div><Icon name={z.icon} /><div className="t">{z.t}</div></div>
        ))}</div>
      </>
    ) },
    playbook: { title: "What to do now", Icon: Compass, link: { to: "/activity", title: "Open your Worklist" }, body: () => (
      <div className="playtile">
        <div className={`pl-win ${win.good ? "good" : ""}`}><Clock size={14} /> {win.text}</div>
        <div className="pl-dials"><b className="num">{dialsLeft}</b><span>dials to go ({dialsDone}/{dialsRec}) — {win.good ? "good window, keep dialing" : "lighter window"}</span></div>
        <ul className="pl-list">{plays.slice(0, 3).map((p, i) => (<li key={i}><span className="pl-ic"><p.icon size={15} /></span>{p.text}</li>))}</ul>
      </div>
    ) },
    leaderboard: { title: "Leaderboard", Icon: Trophy, body: () => (
      <ul className="lbtile">
        {[["1", "A. Chen", "112%"], ["2", "M. Diaz", "104%"], ["3", "You", "98%"], ["4", "R. Patel", "91%"]].map(([r, n, p]) => (
          <li key={r} className={n === "You" ? "me" : ""}><span className="lb-r">{r}</span><b>{n}</b><span className="lb-p num">{p}</span></li>
        ))}
      </ul>
    ) },
    trials: { title: "Trials ending", Icon: Clock, link: { to: "/activity", title: "Work trials in your list" }, body: () => (
      <ul className="rc">
        {trials.length === 0 && <li className="nt-empty" style={{ padding: "8px 2px" }}>No active trials in your book.</li>}
        {trials.slice(0, 6).map((a) => (
          <li key={a.id}><span className="ri b"><Clock size={18} /></span><Link className="rt" to={`/activity?focus=${a.id}`} style={{ textDecoration: "none", color: "inherit" }}><b>{a.name}</b><span>{a.trial || a.planLabel}</span></Link></li>
        ))}
      </ul>
    ) },
    wins: { title: "Recent wins", Icon: Award, body: () => (
      <ul className="rc">{wins.slice(0, 6).map((w, i) => (
        <li key={i}><span className="ri d"><Award size={18} /></span><div className="rt"><b>{w.name || nameOf(w.id)}</b><span>{w.meta}</span></div><span className="rtag num">{w.mrr || ""}</span></li>
      ))}</ul>
    ) },
    tasks: { title: "Tasks", Icon: CheckSquare, body: () => <TasksTile /> },
    notes: { title: "Notes", Icon: StickyNote, body: () => <NotesTile /> },
  };

  const TILE_LABELS = { slack: "Slack", activity: "Activity", recent: "Recent changes", schedule: "Schedule", inbox: "Inbox", weather: "Weather", playbook: "What to do now", leaderboard: "Leaderboard", trials: "Trials ending", wins: "Recent wins", tasks: "Tasks", notes: "Notes" };
  const present = new Set(layout.map((t) => t.key));
  const hidden = Object.keys(TILES).filter((k) => !present.has(k)).map((k) => ({ key: k, label: TILE_LABELS[k] || k }));
  if (!spifOn) hidden.unshift({ key: "spif", label: "SPIF", add: () => actions.setSpif(true) });

  return (
    <Shell showCustomize>
      <CustomizePanel hidden={hidden} />
      <div className="hello">{greeting(profile.name)}</div>
      <div className="sub">{todayLabel()} · <b>{daysLeft} selling days left</b> this month{offDays > 0 && <> · {offDays} day{offDays > 1 ? "s" : ""} off</>}</div>

      {!targetsEntered && !promptDismissed && (
        <div className="target-banner">
          <div className="tb-l"><span className="tb-ic"><Target size={18} /></span>
            <div><b>Set your {monthLabelFn()} targets</b><span>Enter the revenue you were given — we'll project the activity to hit it. Until then the dashboard runs on estimates.</span></div>
          </div>
          <div className="tb-r">
            <button className="tb-go" onClick={() => setSetupOpen(true)}>Set targets</button>
            <button className="tb-x" onClick={() => actions.dismissTargetPrompt(mKey)} title="Dismiss"><X size={15} /></button>
          </div>
        </div>
      )}
      {setupOpen && <TargetSetup monthKey={mKey} onClose={() => setSetupOpen(false)} />}

      {today.focus && <div className="quote"><Quote size={16} /><span>{q.t}</span><b>— {q.a}</b></div>}

      <div className="targetcard">
        <TileControls />
        <div className="tc-focus">
          {showFocusInput ? (
            <div className="tcf-edit">
              <span className="tcf-ic"><Sunrise size={15} /></span>
              <input autoFocus={editFocus} value={focusInput} onChange={(e) => setFocusInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitFocus()} placeholder="Set today's focus — e.g. Convert Grow trials · 60 dials · push JPay" />
              <button onClick={submitFocus}>{today.focus ? "Save" : "Set focus"}</button>
              {!today.focus && <button className="tcf-sg" onClick={() => setFocusInput(suggestion)} title="Use suggestion">Suggest</button>}
            </div>
          ) : (
            <div className="tcf-set">
              <span className="tcf-ic"><Sunrise size={15} /></span>
              <span className="tcf-tag">Today's focus</span>
              <span className="tcf-text">{today.focus}</span>
              {Object.keys(today.overrides || {}).length > 0 && <span className="tcf-ov">{Object.entries(today.overrides).map(([k, v]) => `${v} ${k}`).join(" · ")}</span>}
              <button className="tcf-edbtn" onClick={startEditFocus} title="Edit focus"><Pencil size={13} /></button>
            </div>
          )}
        </div>
        <div className="tc-top">
          <div className="tc-l">
            <div className="lbl"><Target /> {settings.trackJpay ? "Total Expansion Revenue" : "Upgrade MRR"} · monthly goal</div>
            <div className="big num">{T.pct}%<span> to goal</span></div>
            <div className="goalsub">{money(T.booked)} of {money(goal)} · {money(T.remaining)} to go · {daysLeft} selling days left</div>
          </div>
          <div className="tc-r">
            <div className="kpi"><div className="k">Goal</div><div className="v num">{money(goal)}</div></div>
            <div className="kpi"><div className="k">Upsell MRR</div><div className="v num">{money(AT.upsellMRR || 0)}</div></div>
            {settings.trackJpay !== false && <div className="kpi"><div className="k">JPay MRR</div><div className="v warn num">{money(AT.jpayMRR || 0)}</div></div>}
          </div>
        </div>
        <div className="barwrap">
          <div className="seg-bar"><div className="s1" style={{ width: `${T.pct}%` }} /></div>
          <div className="floor" style={{ left: "75%" }}><span className="tick">75% floor</span></div>
        </div>
        <div className={`pace ${P.status}`}>
          {P.status === "ahead"
            ? <><TrendingUp size={15} /> <b>Ahead of pace by {money(P.delta)}</b> — keep it up. Hold ~{money(P.perDay)}/day to finish strong.</>
            : <><TrendingDown size={15} /> <b>Behind pace by {money(P.delta)}</b> — close ~{money(P.perDay)}/day (≈{P.oppsPerDay} opps/day) to hit goal.</>}
        </div>
      </div>

      <div className="goals">
        {hub.goals.map((g) => {
          const val = activity.today[g.key] ?? g.val;
          const r = rec[g.key] ?? g.goal;
          const pct = r ? Math.min(100, Math.round((parseFloat(val) / r) * 100)) : 0;
          const custom = today.overrides && today.overrides[g.key] != null;
          return (
            <div className="goalpill" key={g.key}>
              <div className="gt"><span className="gl"><Icon name={g.icon} /> {g.label}</span><span className="gv num">{val}<i> /{r}{g.key === "talk" ? "m" : ""}</i></span></div>
              <div className="gbar"><i className={g.color || ""} style={{ width: `${pct}%` }} /></div>
              <div className="recnote">{custom ? "your target" : "recommended"}</div>
            </div>
          );
        })}
      </div>

      {spifOn && (
        <div className="card spifstrip">
          {editing && <button className="spif-rm" onClick={() => actions.setSpif(false)} title="Remove SPIF"><X size={15} /></button>}
          <div className="si"><Zap /></div>
          <div><b>{hub.spif.name}</b><div className="ss">{hub.spif.note}</div></div>
          <div className="right">
            <b className="pv num">{hub.spif.progress}/{hub.spif.total}</b>
            <div className="ptrack"><i style={{ width: `${hub.spif.pct}%` }} /></div>
            <a className="pbtn" href="#">JPay accounts</a>
          </div>
        </div>
      )}

      <div className="grid">
        {layout.map((t) => {
          const def = TILES[t.key];
          if (!def) return null;
          return (
            <div
              className={`card ${def.tint ? "tint " : ""}${def.cls ? def.cls + " " : ""}c${t.w}${dragKey === t.key ? " dragging" : ""}`}
              key={t.key}
              draggable={editing}
              onDragStart={() => editing && setDragKey(t.key)}
              onDragEnd={() => setDragKey(null)}
              onDragOver={(e) => { if (dragKey) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (dragKey) actions.reorderTile(dragKey, t.key); setDragKey(null); }}
            >
              <TileControls tkey={t.key} />
              {!def.bare && (
                <div className="ch">
                  <div className="htitle"><span className="hic"><def.Icon /></span><h3>{def.title}</h3></div>
                  <div className="ch-act">
                    {def.refresh && <button className={`refresh ${refreshing ? "spin" : ""}`} onClick={doRefresh} title="Refresh"><RefreshCw size={15} /></button>}
                    {def.link && (def.link.to
                      ? <Link className="go" to={def.link.to} title={def.link.title}><ArrowUpRight /></Link>
                      : <LinkGo href={def.link.href} title={def.link.title} />)}
                  </div>
                </div>
              )}
              {def.body()}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
