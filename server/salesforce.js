// Salesforce sync adapter (BUILD-AHEAD — dormant until creds exist in .env).
// Uses the OAuth2 refresh-token flow + REST query API (no SDK). When Zaid gets a
// Connected App from RevOps, fill SF_* in .env and this powers a real account sync.
//
// .env needed (awaiting approval):
//   SF_CLIENT_ID, SF_CLIENT_SECRET, SF_REFRESH_TOKEN
//   SF_LOGIN_URL   (default https://login.salesforce.com)
//   SF_API_VERSION (default v60.0)
//   SF_OWNER_FILTER (optional SOQL, e.g. "OwnerId = '005...'" to scope to your book)
//
// NOTE: custom field API names (Upgrade_Status__c, JPay_Status__c, NBA, etc.) are
// org-specific — finalize the SELECT + mapping with the real schema once connected.

let _token = null; // { access_token, instance_url, exp }

export function sfConfigured() {
  return !!(process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET && process.env.SF_REFRESH_TOKEN);
}

async function getToken() {
  if (_token && _token.exp > Date.now()) return _token;
  const loginUrl = process.env.SF_LOGIN_URL || "https://login.salesforce.com";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    refresh_token: process.env.SF_REFRESH_TOKEN,
  });
  const r = await fetch(`${loginUrl}/services/oauth2/token`, { method: "POST", body });
  if (!r.ok) throw new Error(`SF token ${r.status}: ${await r.text()}`);
  const d = await r.json();
  _token = { access_token: d.access_token, instance_url: d.instance_url, exp: Date.now() + 90 * 60 * 1000 };
  return _token;
}

async function soql(query) {
  const t = await getToken();
  const v = process.env.SF_API_VERSION || "v60.0";
  let url = `${t.instance_url}/services/data/${v}/query?q=${encodeURIComponent(query)}`;
  const records = [];
  // follow pagination so the whole book comes through
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t.access_token}` } });
    if (!r.ok) throw new Error(`SF query ${r.status}: ${await r.text()}`);
    const d = await r.json();
    records.push(...(d.records || []));
    url = d.nextRecordsUrl ? `${t.instance_url}${d.nextRecordsUrl}` : null;
  }
  return records;
}

// Map a Salesforce Account record → AM Hub account shape.
// (Standard fields shown; swap/add custom fields once we see the real schema.)
function mapAccount(r) {
  return {
    id: r.Id,
    name: r.Name,
    industry: r.Industry,
    phone: r.Phone,
    city: r.BillingCity,
    owner: r.Owner?.Name,
    // placeholders for custom fields — wire real API names on approval:
    plan: r.Plan__c || undefined,
    upgradeStatus: r.Upgrade_Status__c || "Working",
    jpayStatus: r.JPay_Status__c || "Eligible",
    nba: r.NBA_Recommended_Upgrade__c || undefined,
    totalMRR: r.Total_MRR__c || undefined,
    sf: r,
  };
}

export async function fetchAccounts() {
  const filter = process.env.SF_OWNER_FILTER ? ` WHERE ${process.env.SF_OWNER_FILTER}` : "";
  const fields = "Id, Name, Industry, Phone, BillingCity, Owner.Name";
  const records = await soql(`SELECT ${fields} FROM Account${filter} ORDER BY LastModifiedDate DESC LIMIT 2000`);
  return records.map(mapAccount);
}

// ---------- Activity (the data Ambition visualizes — sourced here directly) ----------
// Dials/talk-time/connects come from Revenue.io call logs written as Salesforce
// Task records; opps from Opportunity. Dispositions/SMS-logging are org-specific —
// adjust the heuristics below once we see the real picklist values.
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const mondayIdx = (d) => (d.getDay() + 6) % 7; // Mon=0 … Sun=6
function startOfWeek(now) { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - mondayIdx(d)); return d; }
const isCall = (t) => t.TaskSubtype === "Call" || t.Type === "Call" || /call/i.test(t.Subject || "");
const isSms = (t) => /\b(sms|text)\b/i.test(t.Subject || "") || /\b(sms|text)\b/i.test(t.Type || "");
const isConnect = (t) => { const s = String(t.CallDisposition || "").toLowerCase(); return /connect|answered|meaningful|conversation|reached|live/.test(s); };

export async function fetchActivity() {
  const own = process.env.SF_OWNER_FILTER;
  const taskWhere = (own ? `${own} AND ` : "") + "CreatedDate = THIS_MONTH";
  const oppWhere = (own ? `${own} AND ` : "") + "CreatedDate = THIS_MONTH";
  const tasks = await soql(`SELECT Id, Type, TaskSubtype, CallType, CallDurationInSeconds, CallDisposition, Subject, CreatedDate FROM Task WHERE ${taskWhere}`);
  const opps = await soql(`SELECT Id, CreatedDate, IsWon, Amount FROM Opportunity WHERE ${oppWhere}`);

  const now = new Date();
  const sow = startOfWeek(now);
  const today = { dials: 0, sms: 0, talk: 0, opps: 0, connects: 0 };
  const month = { dials: 0, sms: 0, talk: 0, opps: 0, connects: 0 };
  const week = [0, 0, 0, 0, 0]; // Mon–Fri dials this week

  for (const t of tasks) {
    const d = new Date(t.CreatedDate);
    const mins = Math.round((t.CallDurationInSeconds || 0) / 60);
    if (isCall(t)) {
      month.dials++; month.talk += mins;
      if (isConnect(t)) month.connects++;
      if (sameDay(d, now)) { today.dials++; today.talk += mins; if (isConnect(t)) today.connects++; }
      if (d >= sow) { const wi = mondayIdx(d); if (wi >= 0 && wi < 5) week[wi]++; }
    } else if (isSms(t)) {
      month.sms++;
      if (sameDay(d, now)) today.sms++;
    }
  }
  let booked = 0;
  for (const o of opps) {
    const d = new Date(o.CreatedDate);
    month.opps++;
    if (sameDay(d, now)) today.opps++;
    if (o.IsWon) booked += Number(o.Amount) || 0; // placeholder for Total Expansion Rev (MRR+PGPV) — refine on approval
  }
  // talk stored in minutes; client formats hours for the month view
  return { today, week, month, booked: Math.round(booked) };
}
