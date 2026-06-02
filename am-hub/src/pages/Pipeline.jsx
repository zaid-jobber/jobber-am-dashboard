import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import PipelineSignals from "../components/PipelineSignals.jsx";
import { useAccounts, useSettings, usePipelineStages, useEditing, actions, STAGE_CATALOG } from "../store/store.js";
import { rankAccounts } from "../lib/ranking.js";
import { accountTags } from "../lib/pills.js";
import { Cloud, ChevronLeft, ChevronRight, X, RotateCcw } from "lucide-react";

// Same scored book the Worklist uses → identical chips. Only the priority
// factors matter for chips, so a light context is fine here.
function useScoredBook(accounts, jpayOn) {
  return useMemo(() => {
    const today = new Date();
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const objs = Object.values(accounts).filter((a) => a && a.id);
    objs.forEach((o) => { o.followDueToday = !!(o.followUpDate && sameDay(new Date(o.followUpDate), today)); });
    const scored = rankAccounts(objs, { jpayOn });
    const map = {}; scored.forEach((o) => { map[o.id] = o; });
    return map;
  }, [accounts, jpayOn]);
}

// Working column matches account status (pre-opp); opp columns match the
// account's Opportunity stage — the Pipeline is the AM's synced SF opps.
const matchStage = (stage, acc) => {
  if (stage.kind === "opp") return acc.opp && (acc.opp.stage || "").toLowerCase() === (stage.oppStage || "").toLowerCase();
  return !acc.opp && (stage.statuses || []).some((s) => (acc.upgradeStatus || "").toLowerCase() === s.toLowerCase());
};

export default function Pipeline() {
  const accounts = useAccounts();
  const settings = useSettings();
  const stages = usePipelineStages();
  const editing = useEditing();
  const jpayOn = settings.trackJpay !== false;
  const scored = useScoredBook(accounts, jpayOn);
  const [params] = useSearchParams();
  const [view, setView] = useState(params.get("tab") === "signals" ? "signals" : "board"); // "board" | "signals"
  // Let the guided tour (and deep links) drive the sub-tab via ?tab=.
  useEffect(() => { const t = params.get("tab"); if (t === "signals" || t === "board") setView(t); }, [params]);

  const all = Object.values(scored);
  const columns = stages.map((st) => ({ ...st, cards: all.filter((a) => matchStage(st, a)) }));
  const inCadence = all.filter((a) => a.cadence).length;                                  // accounts in an active cadence
  const openOpps = all.filter((a) => a.opp && /discovery|evaluating|qualified/i.test(a.opp.stage || "")).length; // open SF opps
  const wonCount = all.filter((a) => a.opp && /closed won/i.test(a.opp.stage || "")).length;
  const lostCount = all.filter((a) => a.opp && /closed lost/i.test(a.opp.stage || "")).length;

  return (
    <Shell showCustomize={view === "board"}>
      <div className="pagehead">
        <div><h1>Pipeline</h1></div>
        <div className="ptabs">
          <button className={`ptab ${view === "board" ? "on" : ""}`} onClick={() => setView("board")}>Board</button>
          <button className={`ptab ${view === "signals" ? "on" : ""}`} onClick={() => setView("signals")}>Account changes</button>
        </div>
      </div>

      {view === "signals" ? <PipelineSignals /> : (<>
      <div className="summ">
        <div className="stile"><div className="v num">{all.length}</div><div className="k">In book</div></div>
        <div className="stile"><div className="v num">{inCadence}</div><div className="k">In cadence</div></div>
        <div className="stile"><div className="v num">{openOpps}</div><div className="k">Open opps</div></div>
        <div className="stile"><div className="v num">{wonCount}</div><div className="k">Closed won MTD</div></div>
        <div className="stile"><div className="v num">{lostCount}</div><div className="k">Closed lost</div></div>
      </div>

      {editing && (() => {
        const available = STAGE_CATALOG.filter((c) => !stages.some((s) => s.id === c.id));
        return (
          <div className="stage-edit-bar">
            <span>Reorder, add or remove stages. Columns map to your Salesforce account &amp; opportunity stages.</span>
            <select className="se-pick" value="" disabled={!available.length} onChange={(e) => { if (e.target.value) actions.addStage(e.target.value); }}>
              <option value="">{available.length ? "+ Add stage…" : "All stages added"}</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button className="se-reset" onClick={() => actions.resetStages()}><RotateCcw size={13} /> Reset</button>
          </div>
        );
      })()}

      <div className="board">
        {columns.map((col, ci) => (
          <div className="bcol" key={col.id}>
            {editing ? (
              <div className="colh edit">
                <span className={`cd ${col.dot}`} />
                <span className="stage-name-fixed">{col.label}</span>
                <div className="se-ctrls">
                  <button disabled={ci === 0} onClick={() => actions.moveStage(col.id, -1)} title="Move left"><ChevronLeft size={14} /></button>
                  <button disabled={ci === columns.length - 1} onClick={() => actions.moveStage(col.id, 1)} title="Move right"><ChevronRight size={14} /></button>
                  <button onClick={() => actions.removeStage(col.id)} title="Remove"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className="colh"><span className={`cd ${col.dot}`} />{col.label}<span className="n">{col.cards.length}</span></div>
            )}
            <div className="bcol-cards">
              {col.cards.map((acc) => (
                <Link className="pcard" to={`/account/${acc.id}`} key={acc.id} style={{ display: "block", textDecoration: "none" }}>
                  <div className="nm">{acc.name} <span className="sf"><Cloud /></span></div>
                  <div className="meta">{[acc.industry, acc.region, acc.plan].filter(Boolean).join(" · ")}</div>
                  <div className="pf">
                    {accountTags(acc).map(([cl, t], i) => <span key={i} className={`sig ${cl}`.trim()}>{t}</span>)}
                  </div>
                </Link>
              ))}
              {col.cards.length === 0 && <div className="bcol-empty">No accounts</div>}
            </div>
          </div>
        ))}
      </div>
      </>)}
    </Shell>
  );
}
