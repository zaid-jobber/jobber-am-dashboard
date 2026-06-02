// Shared account chips — the SAME pills the Worklist row and Pipeline card show,
// so list ↔ pipeline ↔ account view stay visually unified. Takes a scored
// account (run through rankAccounts so `_factors` is present).
import { patternFor } from "./cadences.js";

const FACTOR_TAG = { followup: "Follow-up today", trial: "Trial", behavioral: "Active now", easyUpgrade: "Easy upgrade", newAccount: "New", upgradeTag: "Clicked locked", promo: "Promo", nba: "NBA" };
const FACTOR_CLASS = { followup: "opp", trial: "trial", behavioral: "", easyUpgrade: "", newAccount: "", upgradeTag: "opp", promo: "jpay", nba: "nba" };
const isWon = (a) => /closed won|won/i.test(a.upgradeStatus || "");
const isLost = (a) => /closed lost|lost|disqualif/i.test(a.upgradeStatus || "");

// Returns an array of [className, label] chips. Closed deals show only their
// status chip (no cadence/signal noise); open accounts show cadence + top signal.
export function accountTags(acc) {
  if (isWon(acc)) return [["won", acc.followDueToday ? "Won · follow-up" : "Closed Won"]];
  if (isLost(acc)) return [["lost", acc.followDueToday ? "Lost · follow-up" : "Closed Lost"]];
  const f = acc._factors || [];
  const tags = [];
  if (acc.cadence) tags.push(["cad", `${acc.cadence.name.replace("EXP - ", "")} ${acc.cadence.step}/${patternFor(acc.cadence.name).length}`]);
  else tags.push(["needcad", "Needs cadence"]);
  const top = [...f].sort((x, y) => y.pts - x.pts)[0];
  if (top && FACTOR_TAG[top.key]) tags.push([FACTOR_CLASS[top.key], FACTOR_TAG[top.key]]);
  if (acc.nba && top?.key !== "nba") tags.push(["nba", `NBA ${acc.nba}`]);
  return tags;
}
