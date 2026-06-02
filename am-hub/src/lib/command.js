// Pattern-based parser for the smart command bar (LLM upgrade later).
// Handles shapes like:
//  "email Connect accounts with 5+ users and 5+ quotes about Grow benefits"
//  "dial core accounts with 10+ quotes, give me 15"
const PLANS = ["core", "connect", "grow", "plus"];

export function parseCommand(text) {
  const t = (text || "").toLowerCase();
  const plans = PLANS.filter((p) => new RegExp(`\\b${p}\\b`).test(t));
  const num = (re) => { const m = re.exec(t); return m ? parseInt(m[1], 10) : null; };
  const minUsers = num(/(\d+)\s*\+?\s*users?/);
  const minQuotes = num(/(\d+)\s*\+?\s*quotes?/);
  const count = num(/(?:list of|give me|top|first)\s*(\d+)/) || num(/(\d+)\s*accounts?/);
  const action = /\b(email|draft|reach out|write|message)\b/.test(t) ? "email" : /\b(dial|call|phone|list)\b/.test(t) ? "dial" : "list";
  let topic = null;
  if (/\bplus\b/.test(t)) topic = "Plus";
  else if (/\bgrow\b/.test(t)) topic = "Grow";
  else if (/\bconnect\b/.test(t)) topic = "Connect";
  if (/jpay|payments/.test(t)) topic = "JPay";
  return { plans, minUsers, minQuotes, count, action, topic, raw: text };
}

const firstNum = (s) => { const m = /(\d+)/.exec(String(s || "")); return m ? +m[1] : null; };
const userCount = (a) => firstNum(a.users) ?? firstNum(a.signals?.extraUsers);
const quoteCount = (a) => a.signals?.quotes30 ?? firstNum(a.quotes);

export function filterAccounts(accounts, p) {
  let list = Object.values(accounts).filter((a) => {
    if (a.upgradeStatus === "Disqualified") return false;
    if (p.plans.length && !p.plans.includes(String(a.plan || "").toLowerCase())) return false;
    if (p.minUsers != null) { const u = userCount(a); if (u == null || u < p.minUsers) return false; }
    if (p.minQuotes != null) { const q = quoteCount(a); if (q == null || q < p.minQuotes) return false; }
    return true;
  });
  return list.slice(0, p.count || 20);
}

export function draftEmail(a, topic, amName = "your AM") {
  const name = a.contact || "there";
  const sig = `${amName} · Jobber`;
  const bodies = {
    Grow: `Hi ${name},\n\nI was reviewing ${a.name} and saw you're on ${a.plan || "your current plan"} and quoting actively. Grow unlocks Advanced Quoting (optional line items, images, packages) and Two-Way SMS — both tend to help teams win bigger jobs and reply faster.\n\nWorth a quick 15 minutes to walk through it?\n\n${sig}`,
    Plus: `Hi ${name},\n\n${a.name} is running at a level where Plus could pay off — AI Receptionist and the Marketing Suite help capture missed calls and re-engage past clients.\n\nOpen to a quick look this week?\n\n${sig}`,
    JPay: `Hi ${name},\n\nNoticed ${a.name} is processing a healthy amount of volume. Jobber Payments gets businesses paid ~4x faster than cheque and keeps everything in one place.\n\nCan I show you how it'd work for you?\n\n${sig}`,
  };
  const subjects = { Grow: `An idea for ${a.name} on Jobber Grow`, Plus: `Getting more out of Jobber for ${a.name}`, JPay: `Faster payments for ${a.name}` };
  const subject = subjects[topic] || `Quick idea for ${a.name}`;
  const body = bodies[topic] || `Hi ${name},\n\nWanted to share a couple of ways to get more out of Jobber for ${a.name}. Open to a quick chat?\n\n${sig}`;
  const to = a.email || "";
  return { subject, body, url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
