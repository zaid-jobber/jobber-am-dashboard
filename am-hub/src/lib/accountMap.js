// Maps CSV rows (from a Salesforce report export) into AM Hub account objects.
// Header names vary, so we match case-insensitively against alias lists.
const ALIASES = {
  id: ["account id", "18 digit id", "18-digit id", "sf id", "salesforce id", "id", "account: id"],
  name: ["account name", "account", "name", "company", "company name"],
  contact: ["contact", "primary contact", "contact name", "contact full name"],
  phone: ["phone", "contact phone", "account phone"],
  email: ["email", "contact email"],
  city: ["city", "billing city"],
  region: ["timezone", "time zone", "region"],
  industry: ["industry", "jobber industry"],
  plan: ["plan", "current plan", "plan code", "jaccount: plan code", "plan name"],
  billing: ["billing", "billing type", "billing frequency"],
  totalMRR: ["total mrr", "mrr", "monthly recurring revenue"],
  planMRR: ["plan mrr"],
  gsv: ["gsv", "gross service volume", "gsv 12mo", "gsv (12mo)"],
  avgInvoice: ["avg invoice", "average invoice", "average invoice value"],
  users: ["users", "user count", "user limit", "seats"],
  pgpv: ["pgpv", "potential gpv", "potential gross processing volume"],
  jpayStatus: ["jpay status", "jobber payments status", "jpay", "payments status"],
  upgradeStatus: ["upgrade status", "status", "account status"],
  nba: ["nba", "nba recommended upgrade", "next best action", "nba upgrade"],
  trial: ["trial", "trial status", "active trial"],
  owner: ["account owner", "owner", "owner name"],
  tenure: ["tenure", "customer since", "account age"],
};

const slug = (s) => (s || "acct").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);

export function mapRowsToAccounts(rows) {
  return rows.map((row) => {
    const lower = {};
    for (const k of Object.keys(row)) lower[k.toLowerCase().trim()] = row[k];
    const pick = (field) => { for (const a of ALIASES[field]) if (lower[a] != null && lower[a] !== "") return lower[a]; return undefined; };

    const acct = { sf: row };
    for (const field of Object.keys(ALIASES)) { const v = pick(field); if (v !== undefined) acct[field] = v; }
    acct.id = acct.id || `${slug(acct.name)}-${Math.random().toString(36).slice(2, 6)}`;
    if (!acct.name) acct.name = acct.id;
    acct.upgradeStatus = acct.upgradeStatus || "New";
    acct.jpayStatus = acct.jpayStatus || "Eligible";
    return acct;
  });
}
