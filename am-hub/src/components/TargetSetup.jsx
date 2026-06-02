import { useState, useMemo } from "react";
import { actions, useSettings, useAccounts, useActivity } from "../store/store.js";
import { computePerformance } from "../lib/performance.js";
import { activeTargets, projectMonthTargets, ratesFromPerf } from "../lib/targets.js";
import { monthLabel } from "../lib/dates.js";
import { X, Target, Activity, RefreshCw, Check, Sparkles } from "lucide-react";

export default function TargetSetup({ monthKey, onClose }) {
  const settings = useSettings();
  const accounts = useAccounts();
  const activity = useActivity();
  const jpay = settings.trackJpay !== false;
  const P = useMemo(() => computePerformance(accounts, activity, settings, "month"), [accounts, activity, settings]);
  const rates = useMemo(() => ratesFromPerf(P), [P]);

  const seed = useMemo(() => activeTargets(settings, P, monthKey), [settings, P, monthKey]);
  const [form, setForm] = useState(() => ({
    expRev: seed.expRev || 0, upsellMRR: seed.upsellMRR || 0, jpayMRR: seed.jpayMRR || 0,
    createdOppsUpsell: seed.createdOppsUpsell || 0, cwOppsUpsell: seed.cwOppsUpsell || 0,
    createdOppsJpay: seed.createdOppsJpay || 0, cwOppsJpay: seed.cwOppsJpay || 0,
    dials: seed.dials || 0, sms: seed.sms || 0, talk: seed.talk || 0,
  }));
  // Activity fields track revenue automatically until the AM edits one by hand.
  const [autoActivity, setAutoActivity] = useState(seed.source !== "entered");

  const num = (v) => Math.max(0, Math.round(Number(v) || 0));
  const setRev = (k) => (e) => {
    const v = num(e.target.value);
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (autoActivity) {
        const proj = projectMonthTargets({ upsellMRR: k === "upsellMRR" ? v : f.upsellMRR, jpayMRR: k === "jpayMRR" ? v : f.jpayMRR, trackJpay: jpay, rates });
        return { ...next, ...proj };
      }
      return next;
    });
  };
  const setAct = (k) => (e) => { setAutoActivity(false); setForm((f) => ({ ...f, [k]: num(e.target.value) })); };
  const reproject = () => {
    setAutoActivity(true);
    setForm((f) => ({ ...f, ...projectMonthTargets({ upsellMRR: f.upsellMRR, jpayMRR: f.jpayMRR, trackJpay: jpay, rates }) }));
  };

  const save = () => {
    actions.setMonthlyTargets(monthKey, { ...form, jpayMRR: jpay ? form.jpayMRR : 0, entered: true, enteredAt: Date.now() });
    actions.dismissTargetPrompt(monthKey);
    onClose?.();
  };

  const money = (v) => `$${num(v).toLocaleString()}`;
  const fld = (label, k, set, prefix) => (
    <label className="tset-f"><span>{label}</span>
      <div className="tset-in">{prefix && <i>{prefix}</i>}<input value={form[k]} onChange={set(k)} inputMode="numeric" /></div>
    </label>
  );

  const [y, m] = monthKey.split("-");
  const label = monthLabel(new Date(Number(y), Number(m) - 1, 1));

  return (
    <div className="tset-scrim">
      <div className="tset-card">
        <button className="tset-x" onClick={onClose}><X size={16} /></button>
        <div className="tset-head">
          <span className="tset-ic"><Target size={20} /></span>
          <div><div className="tset-kick">Monthly targets</div><h2>Set your {label} targets</h2></div>
        </div>
        <p className="tset-lead">Enter the revenue targets you were given. We project the activity you'll need to hit them from your conversion rates — adjust anything that looks off.</p>

        <div className="tset-sec"><h3><Target size={14} /> Targets you were given</h3>
          <div className="tset-grid">
            {fld("Expansion Revenue", "expRev", setRev, "$")}
            {fld("Upsell MRR", "upsellMRR", setRev, "$")}
            {jpay && fld("JPay MRR", "jpayMRR", setRev, "$")}
          </div>
        </div>

        <div className="tset-sec">
          <div className="tset-sechead"><h3><Activity size={14} /> Projected activity</h3>
            <button className="tset-reproj" onClick={reproject} title="Recalculate from revenue"><RefreshCw size={13} /> Recalculate</button>
          </div>
          {autoActivity
            ? <p className="tset-auto"><Sparkles size={12} /> Auto-projected from your rates — ASP {money(rates.asp || 185)}, {Math.round((rates.winRate ?? 0.38) * 100)}% win, {Math.round((rates.connectRate ?? 0.31) * 100)}% connect</p>
            : <p className="tset-auto edited">Edited manually · <button onClick={reproject}>reset to projection</button></p>}
          <div className="tset-grid">
            {fld("Created Opps · Upsell", "createdOppsUpsell", setAct)}
            {fld("Closed Won · Upsell", "cwOppsUpsell", setAct)}
            {jpay && fld("Created Opps · JPay", "createdOppsJpay", setAct)}
            {jpay && fld("Closed Won · JPay", "cwOppsJpay", setAct)}
            {fld("Dials", "dials", setAct)}
            {fld("SMS", "sms", setAct)}
            {fld("Talk time (min)", "talk", setAct)}
          </div>
        </div>

        <div className="tset-actions">
          <button className="tset-skip" onClick={onClose}>Cancel</button>
          <button className="tset-save" onClick={save}><Check size={15} /> Save {label} targets</button>
        </div>
      </div>
    </div>
  );
}
