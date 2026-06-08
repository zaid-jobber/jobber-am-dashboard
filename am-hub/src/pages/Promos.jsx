import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import { api } from "../lib/api.js";
import {
  Star, Megaphone, Bot, Percent, TrendingDown, Leaf, Calculator,
  BookOpen, FileText, Download, ExternalLink, FileCheck, Layers,
} from "lucide-react";

// The Integrations Hub is its own standalone app, deployed as a Google Apps
// Script web app (access limited to getjobber.com) so the partnership data stays
// internal — this repo only references the URL, never the data.
// Paste the deployed /exec URL below (or set VITE_INTEGRATIONS_URL).
const INTEGRATIONS_URL = import.meta.env.VITE_INTEGRATIONS_URL || "";

const COLLATERAL_URL = "https://jobber.atlassian.net/wiki/spaces/EXP/pages/4697948224/Marketing+Collateral+SP+Content";
const PROOF_HUB_URL = "https://script.google.com/a/macros/getjobber.com/s/AKfycbyMyCquAE5UYgoF-Y2iQ6MFeQeaKZzjm6cpRbiuJi2LcW51sntVylP_iIRYjsXdly_t/exec";
const QUOTE_FOLDER_ID = "1y2l-1AVTkJ5_NoVpRd5ownSuh3JmYHYj";
const QUOTE_FOLDER_EMBED = `https://drive.google.com/embeddedfolderview?id=${QUOTE_FOLDER_ID}#grid`;
const QUOTE_FOLDER_URL = `https://drive.google.com/drive/folders/${QUOTE_FOLDER_ID}`;

const TABS = ["Promos", "Integrations", "Marketing Collateral", "Quote Templates", "Proof Hub"];

// --- Plan brochures (the main collateral) ---
const BROCHURES = [
  { plan: "Connect", color: "g1", blurb: "For solo & small teams getting organized — scheduling, invoicing, reminders." },
  { plan: "Grow", color: "g3", blurb: "Advanced quoting, Two-Way SMS, automations — the core expansion brochure." },
  { plan: "Plus", color: "g4", blurb: "AI Receptionist, Marketing Suite, multi-team — the top-tier upgrade story." },
];
const OTHER_COLLATERAL = [
  { icon: FileText, label: "Feature one-pagers", note: "Advanced Quoting, Two-Way SMS, Job Costing" },
  { icon: FileCheck, label: "ROI & value calculators", note: "Time saved, revenue lift by feature" },
  { icon: Megaphone, label: "Case studies", note: "By trade — HVAC, landscaping, cleaning" },
  { icon: Layers, label: "Feature comparison grid", note: "Connect vs Grow vs Plus" },
];

export default function Promos() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => (TABS.includes(params.get("tab")) ? params.get("tab") : "Promos"));
  // Let the guided tour (and deep links) drive the sub-tab via ?tab=.
  useEffect(() => { const t = params.get("tab"); if (TABS.includes(t)) setTab(t); }, [params]);

  // Live "This month" promos from the Slack canvas; falls back to the seeded
  // list below until SLACK_BOT_TOKEN + PROMO_CANVAS_ID are configured server-side.
  const [livePromos, setLivePromos] = useState(null);
  useEffect(() => { let off = false; api.promos().then((d) => { if (!off && d?.promos?.length) setLivePromos(d.promos); }); return () => { off = true; }; }, []);

  return (
    <Shell>
      <div className="pagehead">
        <div><h1>Resources</h1></div>
        <div className="ptabs">{TABS.map((t) => <button key={t} className={`ptab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>)}</div>
      </div>

      {tab === "Promos" && (
        <>
          <div className="seclab2">This month {livePromos && <span className="live-badge"><Megaphone size={11} /> Live from Slack</span>}</div>
          <div className="pgrid">
            {livePromos
              ? livePromos.map((p, i) => (
                  <div className={`promo${i === 0 ? " feat" : ""}`} key={i}><div className="pi"><Star /></div><h3>{p.title}</h3>{p.terms && <div className="terms">{p.terms}</div>}{p.elig && <div className="elig">{p.elig}</div>}<div className="ptags">{(p.tags || []).map((t) => <span className="pt" key={t}>{t}</span>)}</div></div>
                ))
              : (<>
                  <div className="promo feat"><div className="pi"><Star /></div><h3>Grow → Plus</h3><div className="terms">Apr–Jun</div><div className="elig">Targeted Grow accounts upgrading to Plus. Pair with annual / ACBM framing.</div><div className="ptags"><span className="pt">Grow → Plus</span><span className="pt">Seasonal</span></div></div>
                  <div className="promo"><div className="pi"><Megaphone /></div><h3>Marketing Suite trial</h3><div className="terms">14 days</div><div className="elig">Free trial to drive Marketing Suite adds.</div><div className="ptags"><span className="pt">Add-on</span></div></div>
                  <div className="promo"><div className="pi"><Bot /></div><h3>AI Receptionist trial</h3><div className="terms">14 days</div><div className="elig">For high call / SMS-volume SPs. Grow → Plus angle.</div><div className="ptags"><span className="pt">Add-on</span></div></div>
                </>)}
          </div>

          <div className="seclab2" style={{ marginTop: 22 }}>Always-on back-pocket</div>
          <div className="pgrid">
            <div className="promo"><div className="pi"><Percent /></div><h3>Monthly / ACBM upgrade</h3><div className="terms">30%<small> × 3 months</small></div><div className="elig">Plan upgrades only. Push ACBM over monthly.</div><div className="ptags"><span className="pt warn">No stacking</span><span className="pt code">expansion_30x3</span></div></div>
            <div className="promo"><div className="pi"><Percent /></div><h3>Annual upgrade</h3><div className="terms">10%<small> × 12 months</small></div><div className="elig">Best long-term value for committed SPs.</div><div className="ptags"><span className="pt warn">No stacking</span><span className="pt code">expansion_10x12</span></div></div>
            <div className="promo"><div className="pi"><TrendingDown /></div><h3>Negotiation lever</h3><div className="terms">40%<small> × 2 months</small></div><div className="elig">Escalate from 20×3 → 40×2 when interest wanes.</div><div className="ptags"><span className="pt">Back-pocket</span></div></div>
            <div className="promo"><div className="pi"><Leaf /></div><h3>Canadian accounts</h3><div className="terms">20%<small> × 6 / 12 mo</small></div><div className="elig">CA only · one-time.</div><div className="ptags"><span className="pt warn">No stacking</span></div></div>
          </div>

          <div className="seclab2" style={{ marginTop: 22 }}>Promo calculator</div>
          <div className="calc-placeholder">
            <Calculator size={26} />
            <div><b>Promo calculator</b><p>Being built separately — it'll be embedded here once it's ready.</p></div>
          </div>
        </>
      )}

      {tab === "Integrations" && (
        <>
          <div className="res-head" style={{ marginBottom: 12 }}>
            <div className="seclab2" style={{ margin: 0 }}>3rd-party apps & integrations · search what the SP needs</div>
            {INTEGRATIONS_URL && <a className="res-open" href={INTEGRATIONS_URL} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open full screen</a>}
          </div>
          {INTEGRATIONS_URL
            ? <div className="proofhub"><iframe title="Integrations Hub" src={INTEGRATIONS_URL} /></div>
            : <div className="calc-placeholder"><ExternalLink size={26} /><div><b>Integrations Hub not linked yet</b><p>Paste the deployed Apps Script web-app URL into <code>INTEGRATIONS_URL</code> in <code>Promos.jsx</code>.</p></div></div>}
        </>
      )}

      {tab === "Marketing Collateral" && (
        <>
          <div className="res-head" style={{ marginBottom: 14 }}>
            <div className="seclab2" style={{ margin: 0 }}>Plan brochures</div>
            <a className="res-open" href={COLLATERAL_URL} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open full collateral space</a>
          </div>
          <div className="pgrid">
            {BROCHURES.map((b) => (
              <div className="broch" key={b.plan}>
                <div className={`broch-top ${b.color}`}><BookOpen size={22} /><span>{b.plan}</span></div>
                <div className="broch-body"><p>{b.blurb}</p>
                  <div className="broch-acts">
                    <a className="rbtn primary" href={COLLATERAL_URL} target="_blank" rel="noreferrer"><BookOpen size={14} /> View</a>
                    <a className="rbtn" href={COLLATERAL_URL} target="_blank" rel="noreferrer"><Download size={14} /> PDF</a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="seclab2" style={{ marginTop: 22 }}>More collateral</div>
          <div className="reslist">
            {OTHER_COLLATERAL.map((c) => (
              <a className="resrow" key={c.label} href={COLLATERAL_URL} target="_blank" rel="noreferrer">
                <span className="rr-ic"><c.icon size={18} /></span>
                <div className="rr-t"><b>{c.label}</b><span>{c.note}</span></div>
                <ExternalLink size={15} className="rr-go" />
              </a>
            ))}
          </div>
        </>
      )}

      {tab === "Quote Templates" && (
        <>
          <div className="res-head" style={{ marginBottom: 12 }}>
            <div className="seclab2" style={{ margin: 0 }}>Quote templates · view or download</div>
            <a className="res-open" href={QUOTE_FOLDER_URL} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open in Drive</a>
          </div>
          <div className="proofhub">
            <iframe title="Quote Templates" src={QUOTE_FOLDER_EMBED} />
          </div>
        </>
      )}

      {tab === "Proof Hub" && (
        <>
          <div className="res-head" style={{ marginBottom: 12 }}>
            <div className="seclab2" style={{ margin: 0 }}>Proof Hub</div>
            <a className="res-open" href={PROOF_HUB_URL} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open in new tab</a>
          </div>
          <div className="proofhub">
            <iframe title="Proof Hub" src={PROOF_HUB_URL} />
          </div>
        </>
      )}
    </Shell>
  );
}
