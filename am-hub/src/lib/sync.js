import { api } from "./api.js";
import { actions } from "../store/store.js";

// Pulls accounts from the Salesforce sync endpoint and upserts them into the
// store (preserving local activity/notes). No-op until the Connected App creds
// exist server-side. Returns count synced (0 = not connected / nothing).
export async function syncSalesforce() {
  const d = await api.salesforceAccounts();
  if (d?.accounts?.length) { actions.importAccounts(d.accounts); return d.accounts.length; }
  return 0;
}

// Pulls activity (dials/talk/connects/opps + week/month + booked) and updates the
// store. No-op until the Connected App creds exist server-side.
export async function syncActivity() {
  const d = await api.salesforceActivity();
  if (d?.activity) { actions.setActivity(d.activity); return true; }
  return false;
}
