import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import Icon from "../components/Icon.jsx";
import { useAccounts, useToday, useSettings, useActivity, useFeeds, useWorklist, useProfile, actions } from "../store/store.js";
import { computeTargets } from "../lib/targets.js";
import { sellingDaysLeft } from "../lib/dates.js";
import { rankAccounts, RANK_FACTORS } from "../lib/ranking.js";
import { computeUpgrade } from "../lib/upgrade.js";
import { aiGenerate } from "../lib/ai.js";
import { C, S, E, patternFor, stepChannels } from "../lib/cadences.js";
import { genAccount } from "../data/book.js";
import { accountTags } from "../lib/pills.js";
import {
  ChevronLeft, ChevronRight, Cloud, Wrench, TrendingUp, TicketPercent,
  ChevronDown, Phone, Mail, MessageSquare, Check, Play, Search, X, Star, Route,
  Sliders, RotateCcw, CalendarDays, PartyPopper, Globe, Clock,
} from "lucide-react";

// SF follow-up date helpers — compare to the day being viewed.
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isWon = (acc) => /closed won|won/i.test(acc.upgradeStatus || "");
const isLost = (acc) => /closed lost|lost|disqualif/i.test(acc.upgradeStatus || "");
const isClosed = (acc) => isWon(acc) || isLost(acc);

const CADENCES = [
  { name: "EXP - Grow Trial", use: "Core/Connect started a Grow trial", recFor: "trial-grow" },
  { name: "EXP - Connect Trial", use: "Core started a Connect trial", recFor: "trial-connect" },
  { name: "EXP - Marketing Suite Trial Cadence", use: "Active Marketing Suite trial", recFor: "trial-ms" },
  { name: "EXP - Receptionist Trial", use: "Active AI Receptionist (AIR) trial", recFor: "trial-air" },
  { name: "EXP - Grace Period", use: "Over user limit — auto-upgrade in 7 days", recFor: "grace" },
  { name: "EXP - NBA Accounts", use: "Next Best Action model target", recFor: "nba" },
  { name: "EXP - Quoters by Usage", use: "High quote volume — Grow upsell", recFor: "quoter" },
  { name: "EXP - Accounts with Paid Users", use: "Added paid users under plan limit", recFor: "users" },
  { name: "EXP - Plus Prospecting", use: "Qualifies for the Plus plan", recFor: "plus" },
  { name: "EXP - Jobber Payments", use: "JPay not enabled / disabled", recFor: "jpay" },
  { name: "EXP - General Outbound Cadence", use: "First contact, any direction", recFor: "new" },
  { name: "EXP - Opp Recommendation Follow-Up", use: "After sending a recommendation", recFor: "opp" },
  { name: "EXP - Opp Agreed to Talk", use: "Opp created, schedule a meeting", recFor: "opp" },
];
function recommendedCadence(a, jpayOn) {
  const t = `${a.trial || ""} ${a.planLabel || ""}`.toLowerCase();
  if (/grow/.test(t)) return "EXP - Grow Trial";
  if (/connect/.test(t)) return "EXP - Connect Trial";
  if (/grace/i.test(a.upgradeStatus || "") || a.grace) return "EXP - Grace Period";
  if (a.nba) return "EXP - NBA Accounts";
  if ((a.signals?.quotes30 || 0) >= 5 && a.plan !== "Plus") return "EXP - Quoters by Usage";
  if (jpayOn && /eligible/i.test(a.jpayStatus || "")) return "EXP - Jobber Payments";
  return "EXP - General Outbound Cadence";
}

const IND = ["HVAC", "Plumbing", "Landscaping", "Cleaning", "Roofing", "Painting", "Electrical", "Pest Control", "Handyman", "Moving"];
const REG = ["ET", "CT", "MT", "PT", "AT"];
const REGION_TZ = { ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver", PT: "America/Los_Angeles", AT: "America/Halifax" };
// Local YYYY-MM-DD (the account's next-cadence-touch due date lives in cadence.nextDue).
const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return dayStr(x); };
// Days until a cadence's next step is due (aggressive cadences come back sooner).
const cadenceGap = (name) => (/grace/i.test(name || "") ? 1 : /trial/i.test(name || "") ? 2 : 3);
const toMin = (t) => { const [h, m] = String(t || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

const TOPIC = { "Trial conversion": "Grow", "Connect→Grow": "Grow", "Grow→Plus": "Plus", JPay: "JPay", "Check-in": null };

const Row = ({ item, acct, due, selected, done, onSelect, rowRef }) => (
  <div ref={rowRef} className={`lrow ${selected ? "sel" : ""} ${done ? "done" : ""}`} onClick={onSelect}>
    {item.now && <span className="nowtag">NOW</span>}
    {item.pri ? (
      <div className={`pri ${item.priClass || ""}`}>
        {item.priSub ? <>{item.pri}<small>{item.priSub}</small></> : /^[0-9]/.test(item.pri) ? item.pri : <Icon name={item.pri} />}
      </div>
    ) : (<div className="rank">{item.rank}</div>)}
    <div className="info">
      <b>{acct.name}</b>
      <div className="meta">{item.meta}</div>
      <div className="reason">{(item.tags || []).map(([c, t], i) => <span key={i} className={`sig ${c}`.trim()}>{t}</span>)}</div>
      {item.whyParts && item.whyParts.length > 0
        ? <div className="whyrank">{item.whyParts.map((p, i) => <span key={i} className={p.up ? "wup" : "wdn"}>{(p.up ? "↑ " : "↓ ") + p.txt}</span>)}</div>
        : item.why && <div className="whyrank">{item.why}</div>}
    </div>
    <div className={`due ${due === "Route" ? "needcad" : ""}`} title={due === "Route" ? "Needs a cadence" : ""}><Icon name={due} /></div>
  </div>
);

const hashId = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; };
// Ensure a real store account carries the fields the ranking engine reads.
const enrichForRank = (a) => {
  const i = hashId(a.id) % 97;
  return { region: REG[i % REG.length], industry: IND[i % IND.length], plan: "Connect", signals: {}, ...a };
};

// Compact account brief passed to the AI for grounded drafts.
const ctxFor = (a, amName) => ({ name: a.name, contact: a.contact, plan: a.planLabel || a.plan, trial: a.trial, industry: a.industry, upgradeStatus: a.upgradeStatus, signals: a.signals, promo: a.promoTag, amName });

// Inline AI composer for the cadence's due email / text step. The AM types what
// they want, generates a draft (ChatGPT when connected, template otherwise),
// edits it, then sends. Lets them override the cadence's preloaded copy.
function Compose({ kind, account, amName }) {
  const [prompt, setPrompt] = useState(kind === "text" ? "Quick nudge about their trial" : "Recap the upgrade value and ask for a call");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const gen = async () => { setBusy(true); const r = await aiGenerate(kind, prompt, ctxFor(account, amName)); setOut(r.text); setLive(r.live); setBusy(false); };
  const openGmail = () => { const su = `Quick idea for ${account.name}`; window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(account.email || "")}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(out)}`, "_blank", "noopener"); };
  const copy = async () => { try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } };
  return (
    <div className="compose">
      <div className="cmp-h">{kind === "text" ? <MessageSquare size={15} /> : <Mail size={15} />}<b>{kind === "text" ? "Text" : "Email"}</b><span className="ai">AI</span></div>
      <div className="cmp-ask">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={kind === "text" ? "What should the text say?" : "What should the email say?"} />
        <button className="gen" onClick={gen} disabled={busy}>{busy ? "Generating…" : "Generate"}</button>
      </div>
      {out && (
        <>
          <textarea className="cmp-out" value={out} onChange={(e) => setOut(e.target.value)} rows={kind === "text" ? 3 : 7} />
          <div className="cmp-acts">
            {kind === "text"
              ? <button className="cmp-send" onClick={copy}><Check size={13} /> {copied ? "Copied" : "Copy text"}</button>
              : <button className="cmp-send" onClick={openGmail}><Mail size={13} /> Open in Gmail</button>}
            {!live && <span className="cmp-note">Template — connect ChatGPT in Settings for AI drafts</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function ActivityList() {
  const nav = useNavigate();
  const accounts = useAccounts();
  const today = useToday();
  const settings = useSettings();
  const activity = useActivity();
  const feeds = useFeeds();
  const worklist = useWorklist();
  const profile = useProfile();
  const amName = (profile.name || "").trim().split(/\s+/)[0] || "your AM";
  const jpayOn = settings.trackJpay !== false;
  const hubMode = settings.cadenceMode === "hub";

  const [params] = useSearchParams();
  const [sel, setSel] = useState(params.get("focus") || "apex");
  const [showMore, setShowMore] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [ask, setAsk] = useState("Convert their Grow trial before it ends");
  const [topic, setTopic] = useState("Trial conversion");
  const [copied, setCopied] = useState(false);
  const [phoneIdx, setPhoneIdx] = useState(0);
  const [actOpen, setActOpen] = useState(null);
  const [cadOpen, setCadOpen] = useState(false);
  const [cadSearch, setCadSearch] = useState("");
  const [localCad, setLocalCad] = useState({});
  const [localPatch, setLocalPatch] = useState({});
  const [tuneOpen, setTuneOpen] = useState(false);
  const [script, setScript] = useState(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptLive, setScriptLive] = useState(false);
  const [dateOff, setDateOff] = useState(0); // 0 = today, N = N days back
  const [bump, setBump] = useState(0); // extra accounts pulled in beyond the dial goal
  const [skipTrayOpen, setSkipTrayOpen] = useState(false);
  const isPast = dateOff > 0;
  const viewDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - dateOff); return d; }, [dateOff]);

  const done = useMemo(() => new Set(today.done || []), [today.done]);
  const skipped = useMemo(() => new Set(today.skipped || []), [today.skipped]);
  const viewDayStr = dayStr(viewDate);

  // Live clock — re-evaluates time-based ranking (call windows) and scheduled-
  // call slide-in every minute so the list stays accurate as the day moves.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 60000); return () => clearInterval(id); }, []);
  // AM working hours — the list knows when the AM is on the clock.
  const workStart = settings.workStart || "08:00";
  const workEnd = settings.workEnd || "17:00";
  const nowMin = new Date(clock).getHours() * 60 + new Date(clock).getMinutes();
  const outsideHours = !isPast && (nowMin < toMin(workStart) || nowMin >= toMin(workEnd));

  const daysLeft = sellingDaysLeft();
  const goal = Math.round(settings.quota * (settings.stretch / 100));
  const T = computeTargets({ goal, booked: activity.booked, daysLeft });
  const targetDials = (today.overrides && today.overrides.dials) || T.rec.dials;
  const effTarget = targetDials + bump; // dial goal + any "add more accounts" the AM pulled in

  const pool = useMemo(() => {
    const p = ["EXP - General Outbound Cadence", "EXP - Quoters by Usage", "EXP - Plus Prospecting", "EXP - Accounts with Paid Users", "EXP - NBA Accounts", "EXP - Grow Trial", "EXP - Connect Trial", "EXP - Opp Recommendation Follow-Up", "EXP - Jobber Payments"];
    return jpayOn ? p : p.filter((n) => !/Payments/.test(n));
  }, [jpayOn]);

  // Weather zones currently "hot" (rain) — a ranking input for outdoor trades.
  const rainZones = useMemo(() => (feeds.weather?.zones || []).filter((z) => z.hot).map((z) => z.z), [feeds]);
  // Real current local hour per region (handles DST + the AM's own timezone),
  // so call windows are correct no matter where the AM is sitting.
  const regionHours = useMemo(() => {
    const d = new Date(clock); const out = {};
    for (const [r, tz] of Object.entries(REGION_TZ)) {
      try { out[r] = (+new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(d)) % 24; }
      catch { out[r] = d.getHours(); }
    }
    return out;
  }, [clock]);
  // Ranking context: learning weights + real time-of-day + weather. (Past days
  // use a fixed mid-morning hour so the historical order is stable, not "now".)
  const rankCtx = useMemo(() => ({
    weights: settings.rankWeights, jpayOn, rainZones,
    regionHours: isPast ? { ET: 10, CT: 10, MT: 10, PT: 10, AT: 10 } : regionHours,
  }), [settings.rankWeights, jpayOn, rainZones, isPast, regionHours]);

  // The unified ranked pool: the WHOLE store book (same accounts the Pipeline
  // and Account view use), scored by the engine and sorted into ONE list.
  const { ranked, objMap } = useMemo(() => {
    const objs = Object.values(accounts).filter((a) => a && a.id).map((a) => enrichForRank(a));
    // Annotate for the ranker: is a CALL due today (time-of-day logic), and is a
    // SF follow-up date set for the day being viewed (force-surfaces the account).
    objs.forEach((o) => {
      o.callDueToday = stepChannels(o.cadence).includes(C);
      o.followDueToday = !!(o.followUpDate && sameDay(new Date(o.followUpDate), viewDate));
    });
    const scored = rankAccounts(objs, rankCtx);
    const map = {}; scored.forEach((o) => { map[o.id] = o; });
    return { ranked: scored, objMap: map };
  }, [accounts, rankCtx, viewDate]);

  // Scheduled calls (ChiliPiper) slide in only within the AM's lead-time window
  // before start (Settings → schedLeadMin), pinned at top. (Today only.)
  const leadMin = settings.schedLeadMin || 30;
  const sched = useMemo(() => {
    const items = []; const map = {};
    if (isPast) return { items, map };
    const now = clock;
    const defs = [{ id: "sched-1", mins: 12 }, { id: "sched-2", mins: 210 }]; // one near, one later
    defs.forEach((d, k) => {
      const at = now + d.mins * 60000;
      const acc = genAccount(900 + k, pool); acc.id = d.id;
      acc.upgradeStatus = "Qualified Open Opp";
      acc.cadence = { name: "EXP - Opp Agreed to Talk", step: 2, due: "Scheduled call via ChiliPiper" };
      acc.scheduledAt = at; map[d.id] = acc;
      if (now >= at - leadMin * 60000) {
        const dt = new Date(at);
        items.push({ id: d.id, now: true, pri: dt.toLocaleTimeString([], { hour: "numeric" }).replace(/\s?[AP]M/, ""), priSub: dt.getHours() >= 12 ? "PM" : "AM", priClass: "time", meta: `${acc.plan} · ${acc.region} · scheduled now`, tags: [["", "Scheduled · ChiliPiper"]] });
      }
    });
    return { items, map };
  }, [pool, isPast, leadMin, clock]);

  // Build a display row from a scored account object (shared chips via accountTags).
  const toRow = (acc, rank) => ({ id: acc.id, rank, meta: `${acc.plan} · ${acc.region} · ${acc.upgradeStatus}`, tags: accountTags(acc), why: acc._why, whyParts: acc._whyParts });

  const lookup = (id) => {
    // Never return undefined: fall back to the top-ranked account (or any account)
    // so a stale/missing selected id can't crash the worklist (and works with live
    // Salesforce ids, which won't include the demo's "apex").
    let a = sched.map[id] || objMap[id] || accounts[id] || accounts.apex || ranked[0] || Object.values(accounts)[0] || null;
    if (!a) return null;
    if (localPatch[id]) a = { ...a, ...localPatch[id] };
    if (localCad[id]) a = { ...a, cadence: localCad[id] };
    return a;
  };

  // Final ordered list (airtight). An account is on today's list only if its
  // next cadence touch is DUE (cadence.nextDue ≤ today) and it wasn't skipped to
  // a later day. Done accounts get a future nextDue (so a dialed account doesn't
  // come back tomorrow); missed accounts stay due and roll forward; scheduled,
  // follow-up-today and manually-pinned accounts are always shown.
  const view = useMemo(() => {
    const pinnedSet = new Set(isPast ? [] : (worklist.pinned || []));
    const pat = (acc) => (localPatch[acc.id] ? { ...acc, ...localPatch[acc.id] } : acc);
    const ndOf = (id) => localCad[id]?.nextDue || objMap[id]?.cadence?.nextDue || accounts[id]?.cadence?.nextDue || null;
    const dueToday = (acc) => { const nd = ndOf(acc.id); return !nd || nd <= viewDayStr; };
    const overdue = (acc) => { const nd = ndOf(acc.id); return nd && nd < viewDayStr; };
    const isCall = (id) => objMap[id]?.callDueToday ?? stepChannels(sched.map[id]?.cadence || accounts[id]?.cadence).includes(C);
    const hidden = (acc) => (acc.id in sched.map) || skipped.has(acc.id); // sched shown via pinned; skipped pushed to tomorrow
    const cadOf = (id) => localCad[id] || sched.map[id]?.cadence || objMap[id]?.cadence || accounts[id]?.cadence;
    let calls = sched.items.filter((it) => stepChannels(cadOf(it.id)).includes(C)).length;
    const rows = []; const added = new Set();
    const addRow = (acc, lead = []) => {
      const r = toRow(acc, rows.length + 1);
      const ov = overdue(acc) && !done.has(acc.id) ? [["needcad", "Overdue"]] : [];
      if (lead.length || ov.length) r.tags = [...lead, ...ov, ...r.tags];
      rows.push(r); added.add(acc.id); if (isCall(acc.id)) calls++;
    };
    // 0) Manually added → always shown.
    for (const acc of ranked) { if (hidden(acc) || !pinnedSet.has(acc.id)) continue; addRow(acc, [["nba", "Added by you"]]); }
    // 1) Follow-up date today → always shown, regardless of cadence/cap.
    for (const acc of ranked) { if (hidden(acc) || added.has(acc.id) || !acc.followDueToday) continue; addRow(acc); }
    // 2) Ranked fill — due today, not closed, up to the dial goal. Done accounts
    //    stay visible today even past the cap; new ones stop once the goal is met.
    for (const acc of ranked) {
      if (hidden(acc) || added.has(acc.id)) continue;
      const isDone = done.has(acc.id);
      if (!isDone) {
        const a2 = pat(acc);
        if (isClosed(a2) && !a2.followUpDate) continue;
        if (!dueToday(acc)) continue;       // dialed earlier → next step not due yet
        if (calls >= effTarget) continue;   // dial goal met → don't pull new accounts
      }
      addRow(acc);
    }
    return [...sched.items, ...rows];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, sched, isPast, effTarget, localCad, localPatch, objMap, accounts, skipped, done, worklist.pinned, viewDayStr]);

  // due channel(s) per account: cadence step channels, or "needs cadence"
  const rowDue = (acct) => { if (!acct.cadence) return "Route"; const ch = stepChannels(acct.cadence); return ch[0] || "Phone"; };

  const total = view.length;
  const callSteps = view.filter((it) => objMap[it.id]?.callDueToday ?? stepChannels(sched.map[it.id]?.cadence || lookup(it.id).cadence).includes(C)).length;
  const idx = Math.max(0, view.findIndex((x) => x.id === sel));
  const a = lookup(sel);
  const leftCount = view.filter((it) => !done.has(it.id)).length;
  const callsDone = view.filter((it) => done.has(it.id) && (objMap[it.id]?.callDueToday ?? stepChannels(sched.map[it.id]?.cadence || lookup(it.id).cadence).includes(C))).length;
  const allDone = !isPast && total > 0 && leftCount === 0;
  const dch = stepChannels(a.cadence);
  const upg = useMemo(() => computeUpgrade(a), [a]);
  // Account's current local time (shown by its timezone) + after-hours flag.
  const acctTz = REGION_TZ[a.region];
  const acctLocalTime = useMemo(() => {
    if (!acctTz) return null;
    try { return new Intl.DateTimeFormat("en-US", { timeZone: acctTz, hour: "numeric", minute: "2-digit" }).format(new Date(clock)).replace(/\s?AM/, "am").replace(/\s?PM/, "pm"); }
    catch { return null; }
  }, [acctTz, clock]);
  const acctLate = !isPast && regionHours[a.region] != null && !(regionHours[a.region] >= 8 && regionHours[a.region] < 19);

  // Open-opp popup (hub-cadence mode only): a new opp appeared and the AM hasn't
  // decided whether to move it into an opp cadence yet.
  const oppPrompt = !isPast && hubMode && a && a.opp && !/closed/i.test(a.opp.stage || "")
    && !/Opp/.test(a.cadence?.name || "") && !(worklist.oppAck || []).includes(a.id);

  const rowRefs = useRef({});
  useEffect(() => { rowRefs.current[sel]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); setPhoneIdx(0); setActOpen(null); setScript(null); }, [sel]);
  // Keep the detail in sync with the list: if the selection isn't in the current
  // view (e.g. switching to a past day), fall back to the top row.
  useEffect(() => {
    if (view.length && !view.some((v) => v.id === sel) && !objMap[sel] && !accounts[sel] && !sched.map[sel]) setSel(view[0].id);
  }, [view, sel, objMap, accounts, sched]);

  const persistCad = (id, cad) => { if (accounts[id]) actions.updateAccount(id, { cadence: cad }); else setLocalCad((m) => ({ ...m, [id]: cad })); };
  const patchAccount = (id, patch) => { if (accounts[id]) actions.updateAccount(id, patch); else setLocalPatch((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } })); };
  const go = (i) => { const n = (i + total) % total; setSel(view[n].id); };
  const markDoneNext = () => {
    if (isPast) return; // past days are read-only
    if (!done.has(sel)) { // only advance the step the first time it's completed
      const acct = lookup(sel);
      if (acct.cadence) {
        const pat = patternFor(acct.cadence.name);
        const next = Math.min(acct.cadence.step + 1, pat.length);
        // Schedule the next touch out by the cadence gap → it won't resurface
        // tomorrow, only when that step is actually due.
        const nextDue = addDays(viewDate, cadenceGap(acct.cadence.name));
        persistCad(sel, { ...acct.cadence, step: next, due: `Step ${next} due`, nextDue });
      }
      if ((worklist.pinned || []).includes(sel)) actions.unpinFromWorklist(sel); // worked → no longer manually pinned
      actions.toggleWorklistDone(sel);
    }
    for (let step = 1; step <= total; step++) { const cand = view[(idx + step) % total]; if (cand && !done.has(cand.id) && cand.id !== sel) { setSel(cand.id); return; } }
  };
  const skip = () => {
    if (isPast) return;
    const next = view.find((x) => x.id !== sel && !done.has(x.id)); // pick a survivor before sel leaves the list
    actions.skipWorklist(sel);
    if (next) setSel(next.id);
  };
  // Keyboard shortcuts for a dial-heavy day: J/K move, D done, S skip.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "j") { e.preventDefault(); go(idx + 1); }
      else if (k === "k") { e.preventDefault(); go(idx - 1); }
      else if (k === "d") { e.preventDefault(); markDoneNext(); }
      else if (k === "s") { e.preventDefault(); skip(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, view, total, sel, done, skipped, isPast]);

  const phones = (a.phones && a.phones.length) ? a.phones : (a.phone ? [a.phone] : []);
  const num = phones[phoneIdx] || phones[0];
  const genScript = async () => { setScriptBusy(true); const r = await aiGenerate("script", ask, ctxFor(a, amName)); setScript(r.text); setScriptLive(r.live); setScriptBusy(false); };
  const copyText = async () => {
    const msg = `Hi ${a.contact || "there"}, it's ${amName} from Jobber. ${topic === "JPay" ? "Quick idea on getting you paid faster with Jobber Payments" : "Wanted to share a quick idea for " + a.name}. Got a few minutes?`;
    try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
  };

  const assignCadence = (name) => { persistCad(sel, { name, step: 1, due: "Step 1 due today" }); setCadOpen(false); setCadSearch(""); };
  const recName = recommendedCadence(a, jpayOn);
  const cadList = CADENCES.filter((c) => jpayOn || !/Payments/.test(c.name));
  const cadResults = cadList.filter((c) => (c.name + " " + c.use).toLowerCase().includes(cadSearch.toLowerCase()));

  const promoRows = (a.promoRows || []).filter((r) => jpayOn || !/jpay|payment/i.test(r.label));
  const numBlock = (label, canText) => (
    <div className="numblock">
      <div className="nb-h">{label}</div>
      <div className="nb-row">
        {num
          ? (canText
            ? <span className="phonenum" onClick={copyText} title="Click to copy a text message">{num}</span>
            : <span className="phonenum static">{num}</span>)
          : <span className="phonenum off">No number on file</span>}
        {canText && copied && <span className="copied"><Check size={13} /> SMS copied</span>}
      </div>
      {phones.length > 1 && <select className="numsel" value={phoneIdx} onChange={(e) => setPhoneIdx(+e.target.value)}>{phones.map((p, i) => <option key={i} value={i}>{p}</option>)}</select>}
    </div>
  );
  const pat = a.cadence ? patternFor(a.cadence.name) : null;
  const cur = a.cadence ? Math.min(a.cadence.step, pat.length) : 0;

  return (
    <Shell>
      <div className="pagehead">
        <div>
          <h1>Worklist</h1>
          <p>{isPast ? <>Viewing <b>{viewDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</b> · read-only · {callSteps} calls that day</> : <>{total} accounts · {callSteps} calls queued for your {targetDials} dial goal{bump > 0 && <> · +{bump} added</>}</>}</p>
        </div>
        <div className="wl-head-tools">
          <div className="datepick">
            <button className="dp-btn" title="Earlier day" onClick={() => setDateOff((d) => Math.min(d + 1, 60))}><ChevronLeft size={15} /></button>
            <span className="dp-lab"><CalendarDays size={13} /> {isPast ? viewDate.toLocaleDateString([], { month: "short", day: "numeric" }) : "Today"}</span>
            <button className="dp-btn" title="Later day" disabled={dateOff === 0} onClick={() => setDateOff((d) => Math.max(d - 1, 0))}><ChevronRight size={15} /></button>
            {isPast && <button className="dp-today" onClick={() => setDateOff(0)}>Today</button>}
          </div>
          {!isPast && <button className={`tunebtn ${tuneOpen ? "on" : ""}`} onClick={() => setTuneOpen((v) => !v)} title="Tune how the list is ranked"><Sliders size={15} /> Tune ranking</button>}
        </div>
      </div>

      {tuneOpen && !isPast && (
        <div className="card tunepanel">
          <div className="tp-head"><b>How your list is ranked</b><span>These weights personalize over time. Nudge what matters most to you.</span><button className="tp-reset" onClick={() => actions.resetRankWeights()}>Reset</button></div>
          <div className="tp-rows">
            {Object.entries(RANK_FACTORS).map(([k, f]) => (
              <div className="tp-row" key={k}>
                <span className="tp-lab">{f.label}</span>
                <input type="range" min="0.2" max="2.5" step="0.1" value={settings.rankWeights[k] ?? 1} onChange={(e) => actions.setRankWeight(k, +e.target.value)} />
                <span className="tp-val">{(settings.rankWeights[k] ?? 1).toFixed(1)}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {outsideHours && !allDone && (
        <div className="wh-banner">
          <Clock size={15} />
          <span>Outside your working hours ({workStart}–{workEnd}). Anything you don't get to rolls to tomorrow automatically — set hours in Settings.</span>
        </div>
      )}

      <div className="alayout">
        <div className="card list">
          {!isPast && skipped.size > 0 && (
            <div className="skiptray">
              <button className="skipchip" onClick={() => setSkipTrayOpen((v) => !v)}>{skipped.size} skipped to tomorrow · {skipTrayOpen ? "hide" : "view"}</button>
              {skipTrayOpen && (
                <div className="skiplist">
                  {[...skipped].map((id) => { const acc = lookup(id); return (
                    <div className="skipitem" key={id}><span>{acc.name}</span><button onClick={() => actions.unskipWorklist(id)}>Undo</button></div>
                  ); })}
                </div>
              )}
            </div>
          )}
          <div className="listscroll">
            {view.map((it) => { const acct = lookup(it.id); return <Row key={it.id} item={it} acct={acct} due={rowDue(acct)} selected={sel === it.id} done={done.has(it.id)} onSelect={() => setSel(it.id)} rowRef={(el) => (rowRefs.current[it.id] = el)} />; })}
          </div>
          {!isPast && <button className="addmore" onClick={() => setBump((b) => b + 10)}>+ Add 10 more accounts</button>}
        </div>

        <div className="card detail">
          {allDone ? (
          <div className="wrapup">
            <div className="wu-ic"><PartyPopper size={30} /></div>
            <h2>You're done for the day</h2>
            <p>{callsDone} call{callsDone === 1 ? "" : "s"} worked · {targetDials} dial goal{callsDone >= targetDials ? " — goal hit" : ""}</p>
            <p className="wu-sub">Cleared the list early or want to keep going? Pull in more accounts.</p>
            <div className="wu-acts">
              <button className="wu-btn primary" onClick={() => setBump((b) => b + 10)}>Add 10 more accounts</button>
              <button className="wu-btn" onClick={() => setBump((b) => b + 25)}>Add 25</button>
            </div>
          </div>
          ) : (
          <>
          <div className="worklbar">
            <div className="pos">Account <b>{idx + 1}</b> of {total}{isPast ? <> · <span className="ro-chip">read-only</span></> : <> · <b>{leftCount}</b> left</>}</div>
            <div className="navbtns">
              <button className="nbtn" onClick={() => go(idx - 1)} title="Previous"><ChevronLeft size={16} /></button>
              <button className="nbtn" onClick={() => go(idx + 1)} title="Next"><ChevronRight size={16} /></button>
              {!isPast && <button className="nbtn skip" onClick={skip} title="Skip to tomorrow — shifts the cadence one day">Skip</button>}
              {!isPast && <button className="nbtn next" onClick={markDoneNext}>Done · next</button>}
            </div>
          </div>
          <div className="dbody">
            <div className="d-top">
              <div>
                <div className="nm" style={{ cursor: "pointer" }} onClick={() => nav(`/account/${a.id}`)}>{a.name}</div>
                <div className="who">{a.contact} · {num} · {[a.city, a.region, a.industry].filter(Boolean).join(" · ")}{acctLocalTime && <span className={`acttime ${acctLate ? "late" : ""}`}> · {acctLocalTime} local{acctLate ? " · after hours" : ""}</span>}</div>
                <div className="statuses">
                  <div className="stat-badge"><span className="d working" /><span className="lab">Upgrade</span><b>{a.upgradeStatus}</b></div>
                  <div className="stat-badge"><span className="d on" /><span className="lab">JPay</span><b>{a.jpayStatus}</b></div>
                </div>
              </div>
              <div className="links">
                <a className="lnk" href={`https://salesforce.com/lightning/r/Account/${a.id}/view`} target="_blank" rel="noreferrer"><Cloud size={15} /> Salesforce</a>
                <a className="lnk" href={`https://anchor.getjobber.com/accounts/${a.id}`} target="_blank" rel="noreferrer"><Wrench size={15} /> Anchor</a>
                {a.website && <a className="lnk" href={a.website} target="_blank" rel="noreferrer"><Globe size={15} /> Website</a>}
                <a className="lnk" href={`https://www.google.com/search?q=${encodeURIComponent(`${a.name} ${a.city || ""} reviews`)}`} target="_blank" rel="noreferrer"><Search size={15} /> Google</a>
              </div>
            </div>

            {a.trial && <div className="why"><b>Reach now:</b> {a.trial}</div>}

            <div className="ipanel">
              <div className="ih"><TrendingUp /> Plan Upgrade Insight {upg.scorable ? <span className="prob" title={upg.drivers.length ? `Driven by: ${upg.drivers.join(", ")}` : "Computed from the signals below"}>{upg.pct}%</span> : <span className="prob off" title={upg.note}>n/a</span>}</div>
              {upg.scorable && upg.drivers.length > 0 && (
                <div className="upgdrivers"><span className="ud-lab">Top drivers</span>{upg.drivers.map((d, i) => <span className="ud-pill" key={i}>{d}</span>)}</div>
              )}
              <div className="grid6">
                <div className="gi"><div className="k">Extra users</div><div className="v warn">{a.signals?.extraUsers ?? "—"}</div></div>
                <div className="gi"><div className="k">Quotes 30d</div><div className="v">{a.signals?.quotes30 ?? "—"}</div></div>
                <div className="gi"><div className="k">Invoices 30d</div><div className="v">{a.signals?.invoices30 ?? "—"}</div></div>
                <div className="gi"><div className="k">Active SMS 60d</div><div className="v ok">{a.signals?.activeSms60 ?? "—"}</div></div>
                <div className="gi"><div className="k">Active email 60d</div><div className="v">{a.signals?.activeEmail60 ?? "—"}</div></div>
                <div className="gi"><div className="k">Integrations</div><div className="v">{a.signals?.integrations ?? "—"}</div></div>
              </div>
              <button className="moretoggle" onClick={() => setShowMore((v) => !v)}>{showMore ? "Hide JPay insight" : "JPay insight & more"} — GSV {a.gsv || "—"} · Avg invoice {a.avgInvoice || "—"} · pGPV {a.pgpv || "—"}</button>
              {showMore && (
                <div className="grid6" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="gi"><div className="k">Credit volume</div><div className="v">{a.signals?.creditVol ?? "—"}</div></div>
                  <div className="gi"><div className="k">JPay status</div><div className="v">{a.jpayStatus}</div></div>
                  <div className="gi"><div className="k">Total MRR</div><div className="v">{a.totalMRR || "—"}</div></div>
                  <div className="gi"><div className="k">Tenure</div><div className="v">{a.tenure || "—"}</div></div>
                  <div className="gi"><div className="k">Billing</div><div className="v">{a.billing || "—"}</div></div>
                  <div className="gi"><div className="k">Last active</div><div className="v ok">{a.lastActive || "Today"}</div></div>
                </div>
              )}
            </div>

            {a.cadence ? (
              <div className="cadence">
                <div className="ctop"><b>{a.cadence.name}</b><span className="step">Step {cur} of {pat.length}</span><button className="changecad" onClick={() => setCadOpen(true)}>Change</button></div>
                <div className="stepper">
                  {pat.map((chs, i) => { const n = i + 1; return (
                    <div className={`dot ${n < cur ? "done" : n === cur ? "now" : ""}`} key={i}>{chs.map((ch, j) => ch === C ? <Phone key={j} /> : ch === E ? <Mail key={j} /> : <MessageSquare key={j} />)}</div>
                  ); })}
                </div>
                <div className="duenote">{a.cadence.due}</div>
              </div>
            ) : (
              <div className="cadence assign">
                <div className="ctop"><b>No cadence yet</b></div>
                <div className="duenote">Not in a sequence yet.</div>
                <button className="assignbtn" onClick={() => setCadOpen(true)}><Route size={15} /> Assign a cadence</button>
              </div>
            )}

            {/* actions: only what's due on the current cadence step, below the cadence */}
            {a.cadence && !isPast && (dch.includes(C) || dch.includes(S)) && (
              <div className="dialer">
                {numBlock(dch.includes(C) ? (dch.includes(S) ? "Call / Text" : "Call") : "Text", dch.includes(S))}
              </div>
            )}
            {a.cadence && !isPast && dch.includes(S) && <Compose kind="text" account={a} amName={amName} key={`${a.id}-t`} />}
            {a.cadence && !isPast && dch.includes(E) && <Compose kind="email" account={a} amName={amName} key={`${a.id}-e`} />}

            <div className="scriptc">
              <div className="sh" onClick={() => setScriptOpen((v) => !v)} style={{ cursor: "pointer" }}><b>Call script</b><span className="ai">AI</span><span className="tw" style={{ transform: scriptOpen ? "rotate(180deg)" : "none" }}><ChevronDown size={18} /></span></div>
              {scriptOpen && (
                <div className="open">
                  <div className="askrow"><input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="What's this call about?" /><button className="gen" onClick={genScript} disabled={scriptBusy}>{scriptBusy ? "Generating…" : "Generate"}</button></div>
                  <div className="quick">{Object.keys(TOPIC).filter((q) => jpayOn || q !== "JPay").map((q) => <span key={q} className={`q ${topic === q ? "on" : ""}`} onClick={() => { setTopic(q); setAsk(q === "JPay" ? "Pitch Jobber Payments" : q === "Check-in" ? "Quick check-in" : `Move them to ${TOPIC[q]}`); }}>{q}</span>)}</div>
                  {script ? (
                    <div className="generated genai">
                      {script.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                      {!scriptLive && <div className="cmp-note">Template — connect ChatGPT in Settings for AI scripts</div>}
                    </div>
                  ) : (
                    <div className="generated">
                      <div className="seg"><div className="lbl">P.L.A.N.</div><p>"Hi {a.contact || "there"}, it's {amName} from Jobber — I'm your Account Manager. I saw your <span className="hi">{a.trial || "account activity"}</span> and you're using it heavily. Got 10 minutes?"</p></div>
                      <div className="seg"><div className="lbl">Discovery</div><p>Route: <span className="hi">streamline vs revenue?</span> Two-Way SMS usage high → probe missed-call pain. 11–14 questions.</p></div>
                      <div className="seg"><div className="lbl">Solution → close</div><p>Lead <span className="hi">Two-Way SMS</span> + <span className="hi">Advanced Quoting</span>. Push annual/ACBM; back-pocket <span className="hi">30%×3mo</span> or <span className="hi">10%×12mo</span>.</p></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {promoRows.length > 0 && (
              <div className="promo-cost">
                <div className="pc-head"><TicketPercent /> Eligible promo <span className="pc-tag">{a.promoTag}</span></div>
                <div className="pc-rows">
                  {promoRows.map((r, i) => <div className="pc-r" key={i}><span className="pl">{r.label}</span><span className="pv"><b>{r.value}</b>{r.unit} <small>{r.was}</small></span></div>)}
                </div>
              </div>
            )}

            <div className="sfact">
              <div className="lh">Recent activity</div>
              {!(a.activity && a.activity.length) && <div className="sfa-empty">No activity logged in Salesforce yet.</div>}
              {(a.activity || []).slice(0, 5).map((ev, i) => (
                  <div key={i}>
                    <div className="sfa" onClick={() => setActOpen((o) => (o === i ? null : i))} style={{ cursor: "pointer" }}>
                      <span className="ico"><Icon name={ev.icon} /></span><div className="t"><b>{ev.title}</b> — {ev.sub}</div><span className="when">{ev.when}</span>
                    </div>
                    {actOpen === i && (
                      <div className="sfa-detail">
                        <div>{ev.body || ev.sub}</div>
                        {ev.icon === "Phone" && <a className="reclink" href={ev.recording || "#"} target="_blank" rel="noreferrer" onClick={(e) => !ev.recording && e.preventDefault()}><Play size={13} /> {ev.recording ? "Listen to call recording" : "Recording link (from Salesforce)"}</a>}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {oppPrompt && (
        <div className="cadoverlay">
          <div className="cadmodal oppmodal" onClick={(e) => e.stopPropagation()}>
            <div className="cadhead"><TrendingUp size={17} /> <b>New open opportunity</b><span className="cadfor">{a.name}</span></div>
            <div className="oppbody">
              <p><b>{a.name}</b> now has an open Opportunity ({a.upgradeStatus}). In Hub-managed cadence mode, want to move it into an opp follow-up sequence?</p>
              <div className="oppacts">
                <button className="oppbtn primary" onClick={() => { assignCadence("EXP - Opp Agreed to Talk"); actions.ackOpp(a.id); }}>Add to opp cadence</button>
                <button className="oppbtn" onClick={() => { assignCadence("EXP - Opp Recommendation Follow-Up"); actions.ackOpp(a.id); }}>Recommendation follow-up</button>
                <button className="oppbtn ghost" onClick={() => { patchAccount(a.id, { upgradeStatus: "Closed Won" }); actions.ackOpp(a.id); }}>One-call close — won, remove</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cadOpen && (
        <div className="cadoverlay" onClick={() => setCadOpen(false)}>
          <div className="cadmodal" onClick={(e) => e.stopPropagation()}>
            <div className="cadhead"><Route size={17} /> <b>Assign a cadence</b><span className="cadfor">{a.name}</span><button className="cadx" onClick={() => setCadOpen(false)}><X size={16} /></button></div>
            <div className="cadsearch"><Search size={15} /><input autoFocus value={cadSearch} onChange={(e) => setCadSearch(e.target.value)} placeholder="Search cadences…" /></div>
            <div className="cadlist">
              {cadResults.map((c) => (
                <button className={`caditem ${c.name === recName ? "rec" : ""}`} key={c.name} onClick={() => assignCadence(c.name)}>
                  <div className="ci-t"><b>{c.name}</b>{c.name === recName && <span className="recbadge"><Star size={11} /> Recommended</span>}</div>
                  <div className="ci-u">{c.use} · {patternFor(c.name).length} steps</div>
                </button>
              ))}
              {cadResults.length === 0 && <div className="cadempty">No cadences match “{cadSearch}”.</div>}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
