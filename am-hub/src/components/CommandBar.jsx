import { useState } from "react";
import { Link } from "react-router-dom";
import { useAccounts, useProfile } from "../store/store.js";
import { parseCommand, filterAccounts, draftEmail } from "../lib/command.js";
import { Sparkles, X, Mail, Phone } from "lucide-react";

const EXAMPLES = [
  "Email Connect accounts with 5+ users and 5+ quotes about Grow benefits",
  "Dial Core accounts with 10+ quotes — give me 15",
  "Email Grow accounts about Plus",
];

function interpret(p) {
  const bits = [];
  if (p.plans.length) bits.push(p.plans.join("/"));
  if (p.minUsers) bits.push(`${p.minUsers}+ users`);
  if (p.minQuotes) bits.push(`${p.minQuotes}+ quotes`);
  bits.push(p.action === "email" ? `email${p.topic ? " about " + p.topic : ""}` : "dial list");
  return bits.join(" · ");
}

export default function CommandBar({ onClose }) {
  const accounts = useAccounts();
  const profile = useProfile();
  const amName = (profile.name || "").trim().split(/\s+/)[0] || "your AM";
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const run = () => { const p = parseCommand(text); setRes({ p, matches: filterAccounts(accounts, p) }); };

  return (
    <div className="cmdoverlay" onClick={onClose}>
      <div className="cmdmodal" onClick={(e) => e.stopPropagation()}>
        <div className="cmdhead"><Sparkles size={18} /> <b>Smart command</b><button className="cmdx" onClick={onClose}><X size={16} /></button></div>
        <div className="cmdrow">
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Tell me what to do — e.g. 'email Connect accounts with 5+ users about Grow'" />
          <button onClick={run}>Run</button>
        </div>
        <div className="cmdex">{EXAMPLES.map((e, i) => <button key={i} onClick={() => setText(e)}>{e}</button>)}</div>
        {res && (
          <div className="cmdres">
            <div className="cmdsum">{interpret(res.p)} · <b>{res.matches.length} match{res.matches.length === 1 ? "" : "es"}</b></div>
            {res.matches.length === 0 && <div className="cmdempty">No accounts match. Try fewer filters, or import your book (Pipeline → Import CSV).</div>}
            <ul className="cmdlist">
              {res.matches.map((a) => {
                const d = res.p.action === "email" ? draftEmail(a, res.p.topic, amName) : null;
                return (
                  <li key={a.id}>
                    <div className="cl-t"><b>{a.name}</b><span>{[a.plan, a.industry, a.region].filter(Boolean).join(" · ")}</span></div>
                    {d ? <a className="cl-btn" href={d.url} target="_blank" rel="noreferrer"><Mail size={14} /> Draft in Gmail</a>
                       : <Link className="cl-btn" to={`/account/${a.id}`} onClick={onClose}><Phone size={14} /> Open</Link>}
                  </li>
                );
              })}
            </ul>
            {res.p.action === "email" && res.matches.length > 0 && <div className="cmdhint">Each opens a pre-filled Gmail compose — review and send.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
