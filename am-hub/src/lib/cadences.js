// Shared cadence definitions — the real Revenue.io EXP sequences and their
// per-step channel patterns. Used by the Worklist (stepper, channel-aware
// actions) and the account book generator.

// channel tokens (match lucide icon names used in the UI)
export const C = "Phone", S = "MessageSquare", E = "Mail";

// Each entry = one day-step's channels, from the real EXP sequences.
export const STEP_PATTERNS = {
  "EXP - General Outbound Cadence": [[C, S, E], [C], [S], [E], [C], [S], [E], [C, E]],
  "EXP - Connect Trial": [[C, S, E], [S], [C], [E], [S], [C], [E]],
  "EXP - Grow Trial": [[C, S], [E], [C, E], [S], [C, E], [S], [C]],
  "EXP - Marketing Suite Trial Cadence": [[C, S, E], [S, E], [C], [S], [E], [E], [C], [S], [C, E]],
  "EXP - Receptionist Trial": [[C, S, E], [S, E], [C], [S], [E], [E], [C], [S], [C, E]],
  "EXP - Grace Period": [[C, E, S], [C], [C], [C], [C], [C], [C]],
  "EXP - NBA Accounts": [[C, S, E], [C], [S], [E], [C], [S], [E], [C, E]],
  "EXP - Quoters by Usage": [[C, S, E], [C], [C], [E], [S], [C], [E], [S], [C]],
  "EXP - Accounts with Paid Users": [[C, S, E], [C], [C], [E], [S], [C], [E], [S], [C]],
  "EXP - Plus Prospecting": [[C, S, E], [S, C], [E], [S], [C], [E], [S], [C, E]],
  "EXP - Jobber Payments": [[C, S], [E], [C], [E], [S], [C], [E], [S]],
  "EXP - Opp Recommendation Follow-Up": [[E], [C], [C, E], [C], [C, E], [C], [C, E]],
  "EXP - Opp Agreed to Talk": [[C, S, E], [C, S], [E], [C], [S], [C, E]],
};
export const patternFor = (name) => STEP_PATTERNS[name] || STEP_PATTERNS["EXP - General Outbound Cadence"];
export const stepChannels = (cad) => {
  if (!cad) return [];
  const p = patternFor(cad.name);
  return p[Math.min(Math.max(cad.step, 1) - 1, p.length - 1)] || [C];
};
