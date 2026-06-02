import { useState, useEffect } from "react";
import { actions, useProfile, useSettings, checkRemoteState, hydrateFromServer } from "../store/store.js";
import { Cloud, User, Target, Clock, Check, ArrowRight, ArrowLeft, ShieldCheck, Sparkles, Loader, RotateCcw } from "lucide-react";

const TIMEZONES = ["Pacific (PT)", "Mountain (MT)", "Central (CT)", "Eastern (ET)", "Atlantic (AT)"];
const money = (n) => `$${Number(n || 0).toLocaleString()}`;

export default function Onboarding({ onDone }) {
  const profile = useProfile();
  const settings = useSettings();
  const [step, setStep] = useState(0);

  // Salesforce connect state
  const [sf, setSf] = useState({ domain: "", user: "", pass: "" });
  const [sfState, setSfState] = useState("idle"); // idle | connecting | done

  // Profile + targets
  const [form, setForm] = useState({
    name: profile.name || "",
    email: profile.email || "",
    region: profile.region || "Pacific (PT)",
    quota: settings.quota || 8000,
    workStart: settings.workStart || "08:00",
    workEnd: settings.workEnd || "17:00",
  });
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const connectSf = () => {
    setSfState("connecting");
    setTimeout(() => { actions.setConnection("Salesforce", true); setSfState("done"); }, 1400);
  };

  // Returning AM: if a saved setup exists server-side for this email, offer to
  // restore it (e.g. after a cache clear) instead of setting everything up again.
  const [foundSaved, setFoundSaved] = useState(false);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    const email = form.email;
    if (!/@/.test(email || "")) { setFoundSaved(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => { const found = await checkRemoteState(email); if (!cancelled) setFoundSaved(found); }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.email]);
  const restore = async () => { setRestoring(true); const ok = await hydrateFromServer(form.email.trim().toLowerCase()); if (!ok) { setRestoring(false); return; } onDone?.(); };

  const finish = () => {
    actions.updateProfile({ name: form.name, email: form.email, region: form.region });
    actions.setGoal({ quota: Number(form.quota) || 0, workStart: form.workStart, workEnd: form.workEnd });
    actions.completeOnboarding();
    onDone?.();
  };

  const STEPS = ["Welcome", "Salesforce", "Your profile", "Targets", "Done"];
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  // gate the "Continue" button per step
  const canNext =
    step === 1 ? sfState === "done" :
    step === 2 ? form.name.trim() && /@/.test(form.email) :
    step === 3 ? Number(form.quota) > 0 :
    true;

  return (
    <div className="ob-scrim">
      <div className="ob-card">
        <div className="ob-rail">
          <div className="ob-brand"><span className="ob-jb">Jobber</span><span className="ob-amh">AM Hub</span></div>
          <ul className="ob-steps">
            {STEPS.map((label, i) => (
              <li key={label} className={i === step ? "on" : i < step ? "done" : ""}>
                <span className="ob-dot">{i < step ? <Check size={13} /> : i + 1}</span>{label}
              </li>
            ))}
          </ul>
          <div className="ob-rail-foot"><ShieldCheck size={14} /> Your credentials stay in your browser session</div>
        </div>

        <div className="ob-body">
          {step === 0 && (
            <div className="ob-step">
              <div className="ob-ic green"><Sparkles /></div>
              <h1>Welcome to AM Hub</h1>
              <p className="ob-lead">Your daily command center for Expansion — one ranked worklist, live account signals, pipeline, performance and resources, all fed from Salesforce.</p>
              <ul className="ob-bullets">
                <li><Check size={15} /> Connect Salesforce so your book and activity sync automatically</li>
                <li><Check size={15} /> Set your profile and monthly target</li>
                <li><Check size={15} /> Take a 60-second tour of the dashboard</li>
              </ul>
              <p className="ob-note">Takes about a minute. You can change anything later in Settings.</p>
            </div>
          )}

          {step === 1 && (
            <div className="ob-step">
              <div className="ob-ic blue"><Cloud /></div>
              <h1>Connect Salesforce</h1>
              <p className="ob-lead">Sign in to your Salesforce org. AM Hub reads your assigned accounts, opportunities, cadences and call activity — it never writes back without your action.</p>

              {sfState !== "done" ? (
                <>
                  <button className="ob-sso" disabled={sfState === "connecting"} onClick={connectSf}>
                    <Cloud size={18} /> {sfState === "connecting" ? "Connecting…" : "Sign in with Salesforce"}
                  </button>
                  <div className="ob-or"><span>or sign in manually</span></div>
                  <div className="ob-field"><label>Org domain</label><input value={sf.domain} onChange={(e) => setSf({ ...sf, domain: e.target.value })} placeholder="yourcompany.my.salesforce.com" /></div>
                  <div className="ob-field"><label>Username</label><input value={sf.user} onChange={(e) => setSf({ ...sf, user: e.target.value })} placeholder="you@getjobber.com" /></div>
                  <div className="ob-field"><label>Password + security token</label><input type="password" value={sf.pass} onChange={(e) => setSf({ ...sf, pass: e.target.value })} placeholder="••••••••" /></div>
                  <button className="ob-secondary" disabled={sfState === "connecting"} onClick={connectSf}>
                    {sfState === "connecting" ? <><Loader size={15} className="ob-spin" /> Connecting…</> : "Connect"}
                  </button>
                </>
              ) : (
                <div className="ob-connected">
                  <div className="ob-check"><Check size={26} /></div>
                  <b>Salesforce connected</b>
                  <span>Your book of business is syncing now. You can continue.</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="ob-step">
              <div className="ob-ic green"><User /></div>
              <h1>Your profile</h1>
              <p className="ob-lead">This personalizes your worklist ranking and time-aware call prompts.</p>
              {foundSaved && (
                <div className="ob-restore">
                  <div><b>Welcome back</b><span>We found your saved setup for this email — restore it instead of starting over.</span></div>
                  <button onClick={restore} disabled={restoring}>{restoring ? <><Loader size={14} className="ob-spin" /> Restoring…</> : <><RotateCcw size={14} /> Restore my setup</>}</button>
                </div>
              )}
              <div className="ob-field"><label>Full name</label><input value={form.name} onChange={upd("name")} placeholder="First Last" /></div>
              <div className="ob-field"><label>Work email</label><input value={form.email} onChange={upd("email")} placeholder="you@getjobber.com" /></div>
              <div className="ob-field"><label>Timezone</label>
                <select value={form.region} onChange={upd("region")}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="ob-step">
              <div className="ob-ic green"><Target /></div>
              <h1>Targets &amp; hours</h1>
              <p className="ob-lead">Your daily dial and opp targets are calculated from this and adapt to your pace.</p>
              <div className="ob-field"><label>Monthly quota (Total Expansion Revenue)</label><input value={form.quota} onChange={upd("quota")} placeholder="8000" /><span className="ob-hint">{money(Math.round(Number(form.quota) || 0))} / month</span></div>
              <div className="ob-field"><label><Clock size={13} style={{ verticalAlign: "-2px" }} /> Working hours</label>
                <div className="ob-hours"><input type="time" value={form.workStart} onChange={upd("workStart")} /><span>to</span><input type="time" value={form.workEnd} onChange={upd("workEnd")} /></div>
                <span className="ob-hint">The worklist fills these hours and rolls leftovers to the next day.</span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="ob-step">
              <div className="ob-ic green"><Check /></div>
              <h1>You're all set, {form.name.split(" ")[0] || "there"}</h1>
              <p className="ob-lead">Salesforce is connected and your targets are saved. Take a quick guided tour, or jump straight in.</p>
              <div className="ob-summary">
                <div><span>Salesforce</span><b className="ok"><Check size={13} /> Connected</b></div>
                <div><span>Monthly target</span><b>{money(form.quota)}</b></div>
                <div><span>Working hours</span><b>{form.workStart}–{form.workEnd}</b></div>
                <div><span>Timezone</span><b>{form.region}</b></div>
              </div>
            </div>
          )}

          <div className="ob-actions">
            {step > 0 && step < 4 && <button className="ob-back" onClick={back}><ArrowLeft size={15} /> Back</button>}
            <div style={{ flex: 1 }} />
            {step < 4
              ? <button className="ob-next" disabled={!canNext} onClick={next}>Continue <ArrowRight size={15} /></button>
              : <button className="ob-next" onClick={finish}>Start tour <ArrowRight size={15} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}
