import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import Icon from "../components/Icon.jsx";
import MetricChart from "../components/MetricChart.jsx";
import { useAccount } from "../store/store.js";
import { dollars } from "../lib/metrics.js";
import {
  Cloud, Wrench, Globe, Search, Phone, Mail, MessageSquare, LayoutList, TrendingUp,
  TicketPercent, Briefcase, ArrowUpCircle, History, StickyNote, LineChart,
} from "lucide-react";

const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const num = (v) => { const m = /-?[\d.]+/.exec(String(v ?? "")); return m ? parseFloat(m[0]) : 0; };
const money = (v) => `$${Math.round(v).toLocaleString()}`;
// Snapshot labels that are chartable → metric defs.
const SNAP_METRICS = {
  "Plan MRR": { key: "planMRR", group: "snap", label: "Plan MRR", value: (a) => dollars(a.planMRR), fmt: money },
  "Total MRR": { key: "totalMRR", group: "snap", label: "Total MRR", value: (a) => dollars(a.totalMRR), fmt: money },
  "Upsell MRR": { key: "upsellMRR", group: "snap", label: "Upsell MRR", value: (a) => dollars(a.upsellMRR), fmt: money },
  "GSV 12mo": { key: "gsv", group: "snap", label: "GSV (12 mo)", value: (a) => dollars(a.gsv), fmt: money },
  "Avg invoice": { key: "avgInvoice", group: "snap", label: "Avg invoice", value: (a) => dollars(a.avgInvoice), fmt: money },
  "Invoices/mo": { key: "invoicesMo", group: "snap", label: "Invoices / mo", value: (a) => num(a.invoicesMo) },
  "Users": { key: "users", group: "snap", label: "Users", value: (a) => num(a.signals?.extraUsers || a.users) },
  "pGPV": { key: "pgpv", group: "snap", label: "pGPV", value: (a) => dollars(a.pgpv), fmt: money },
};
const SIGNAL_METRICS = [
  { gk: "quotes30", key: "quotes30", group: "signal", label: "Quotes (30d)", value: (a) => a.signals?.quotes30 || 0 },
  { gk: "invoices30", key: "invoices30", group: "signal", label: "Invoices (30d)", value: (a) => a.signals?.invoices30 || 0 },
  { gk: "activeSms60", key: "activeSms60", group: "signal", label: "Active SMS 60d", value: (a) => a.signals?.activeSms60 || 0, cls: "ok" },
  { gk: "activeEmail60", key: "activeEmail60", group: "signal", label: "Active email 60d", value: (a) => a.signals?.activeEmail60 || 0 },
  { gk: "integrations", key: "integrations", group: "signal", label: "Integrations", value: (a) => a.signals?.integrations || 0 },
  { gk: "creditVol", key: "creditVol", group: "signal", label: "Credit vol %", value: (a) => num(a.signals?.creditVol) },
];
const digits = (s) => (s || "").replace(/[^\d]/g, "");
const googleUrl = (a) => `https://www.google.com/search?q=${encodeURIComponent(`${a.name} ${a.city || ""} reviews`)}`;
const sfUrl = (a) => `https://salesforce.com/lightning/r/Account/${a.id}/view`;
const anchorUrl = (a) => `https://anchor.getjobber.com/accounts/${a.id}`;
const gmailUrl = (a) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(a.email || "")}`;

export default function Account() {
  const { id } = useParams();
  const nav = useNavigate();
  const a = useAccount(id);
  const [tab, setTab] = useState("Opportunities");
  const [metric, setMetric] = useState(null); // selected snapshot/signal metric → chart

  if (!a) return <Shell><div className="card stub"><h2>Account not found</h2></div></Shell>;

  const phone = a.phone || (a.phones && a.phones[0]);
  const snap = [
    ["Plan", a.planLabel || a.plan], ["Billing", a.billing], ["Plan MRR", a.planMRR],
    ["Total MRR", a.totalMRR], ["Upsell MRR", a.upsellMRR], ["GSV 12mo", a.gsv],
    ["Avg invoice", a.avgInvoice], ["Invoices/mo", a.invoicesMo], ["Users", a.users || a.signals?.extraUsers],
    ["pGPV", a.pgpv], ["Tenure", a.tenure], ["NBA", a.nba],
  ].filter(([, v]) => v != null);

  const opps = a.opps || (a.opp ? [a.opp] : []); // SF Opportunities (one card per opp)
  const notes = a.notes || [];

  return (
    <Shell>
      <div className="crumb"><a onClick={() => nav(-1)} style={{ cursor: "pointer" }}>‹ Back</a></div>

      <div className="card ahero">
        <div className="ah-top">
          <div className="ah-logo">{initials(a.name)}</div>
          <div className="ah-meta">
            <h1>{a.name}</h1>
            <div className="who">{[a.contact && `${a.contact}${a.role ? ` (${a.role})` : ""}`, phone, a.email, a.city, a.region, a.industry, a.tenure && `with Jobber ${a.tenure}`].filter(Boolean).join(" · ")}</div>
            <div className="statuses">
              <div className="stat-badge"><span className="d working" /><span className="lab">Upgrade</span><b>{a.upgradeStatus}</b></div>
              <div className="stat-badge"><span className="d on" /><span className="lab">JPay</span><b>{a.jpayStatus}</b></div>
              {a.nba && <div className="stat-badge"><span className="lab">NBA</span><b>{a.nba}</b></div>}
              {a.trial && <div className="stat-badge"><span className="lab">Trial</span><b>{a.trial}</b></div>}
            </div>
          </div>
          <div className="ah-act">
            <div className="links">
              <a className="lnk" href={sfUrl(a)} target="_blank" rel="noreferrer"><Cloud size={15} /> Salesforce</a>
              <a className="lnk" href={anchorUrl(a)} target="_blank" rel="noreferrer"><Wrench size={15} /> Anchor</a>
              {a.website && <a className="lnk" href={a.website} target="_blank" rel="noreferrer"><Globe size={15} /> Website</a>}
              <a className="lnk" href={googleUrl(a)} target="_blank" rel="noreferrer"><Search size={15} /> Google</a>
            </div>
            <div className="actbtns">
              <a className="ab primary" href={phone ? `tel:${digits(phone)}` : undefined}><Phone /> Dial</a>
              <a className="ab" href={gmailUrl(a)} target="_blank" rel="noreferrer"><Mail /> Email</a>
              <a className="ab" href={phone ? `sms:${digits(phone)}` : undefined}><MessageSquare /> Text</a>
            </div>
          </div>
        </div>
      </div>

      <div className="agrid">
        <div className="stack">
          {metric && metric.group === "snap" && (
            <div className="card" style={{ padding: 18 }}>
              <MetricChart account={a} metric={metric} onClose={() => setMetric(null)} />
            </div>
          )}

          <div className="card" style={{ padding: 20 }}>
            <div className="ch"><div className="htitle"><span className="hic"><LayoutList /></span><h3>Snapshot</h3></div></div>
            <div className="sgrid">
              {snap.map(([k, v]) => { const m = SNAP_METRICS[k]; return (
                <div className={`acs ${m ? "clk" : ""} ${metric && m && metric.key === m.key ? "sel" : ""}`} key={k} onClick={m ? () => setMetric(m) : undefined}>
                  <div className="k">{k}{m && <LineChart size={11} className="acs-spark" />}</div>
                  <div className={`v ${k === "Users" ? "warn" : k === "Upsell MRR" ? "ok" : ""}`}>{v}</div>
                </div>
              ); })}
            </div>
            {a.addons && <div className="addons">{a.addons.map(([n, on], i) => <span key={i} className={`ao ${on ? "" : "off"}`}>{n}</span>)}</div>}
          </div>

          {metric && metric.group === "signal" && (
            <div className="card" style={{ padding: 18 }}>
              <MetricChart account={a} metric={metric} onClose={() => setMetric(null)} />
            </div>
          )}

          {a.signals && (
            <div className="card" style={{ padding: 20 }}>
              <div className="ch"><div className="htitle"><span className="hic"><TrendingUp /></span><h3>Upgrade signals</h3></div><span className="src">{a.upgradeProbability}%</span></div>
              <div className="sgrid">
                {SIGNAL_METRICS.map((m) => (
                  <div className={`acs clk ${metric && metric.key === m.key ? "sel" : ""}`} key={m.key} onClick={() => setMetric(m)}>
                    <div className="k">{m.label}<LineChart size={11} className="acs-spark" /></div>
                    <div className={`v ${m.cls || ""}`}>{a.signals[m.gk]}{m.gk === "creditVol" ? "" : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {a.promoRows && (
            <div className="card" style={{ padding: 20 }}>
              <div className="promo-cost">
                <div className="pc-head"><TicketPercent /> Eligible promo <span className="pc-tag">{a.promoTag}</span></div>
                <div className="pc-rows">{a.promoRows.slice(0, 2).map((r, i) => <div className="pc-r" key={i}><span className="pl">{r.label}</span><span className="pv"><b>{r.value}</b>{r.unit} <small>{r.was}</small></span></div>)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="tabs">
            {["Opportunities", "Activity", "Notes"].map((t) => (
              <span key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)} style={{ cursor: "pointer" }}>{t}</span>
            ))}
          </div>

          {tab === "Opportunities" && (
            <>
              <div className="ch"><div className="htitle"><span className="hic"><Briefcase /></span><h3>Opportunities</h3></div></div>
              <div style={{ marginBottom: 8 }}>
                {opps.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>No open opportunities in Salesforce.</div>}
                {opps.map((o, i) => (
                  <div className="opp" key={i}>
                    <div className={`oi ${o.jp ? "jp" : ""}`}><ArrowUpCircle /></div>
                    <div className="ot"><b>{o.name}</b><span>{[o.ageDays != null && `opened ${o.ageDays}d ago`].filter(Boolean).join(" · ")}</span></div>
                    {o.stage && <span className="ostage">{o.stage}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "Activity" && (
            <>
              <div className="ch"><div className="htitle"><span className="hic"><History /></span><h3>Activity</h3></div></div>
              <div className="tl2" style={{ marginBottom: 8 }}>
                {(a.activity || []).length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>No activity logged in Salesforce yet.</div>}
                {(a.activity || []).map((ev, i) => (
                  <div className="ti" key={i}><div className="ic"><Icon name={ev.icon} /></div><div className="tt2"><b>{ev.title}</b><span>{ev.sub}</span></div><span className="tw">{ev.when}</span></div>
                ))}
              </div>
            </>
          )}

          {tab === "Notes" && (
            <>
              <div className="ch"><div className="htitle"><span className="hic"><StickyNote /></span><h3>Notes</h3></div></div>
              {notes.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>No notes synced from Salesforce.</div>}
              {notes.map((n, i) => (
                <div className="note" key={i}><div className="nh"><span>{n.title}</span><span>{n.when}{n.by ? ` · ${n.by}` : ""}</span></div><p>{n.text}</p></div>
              ))}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
