// AI draft generation. Calls the local proxy (/api/ai/generate → OpenAI). When
// the proxy/key isn't configured it returns a sensible template so the UI keeps
// working offline. Returns { text, live } — `live` true when AI generated it.
const AM_FALLBACK = "your AM";

export async function aiGenerate(kind, prompt, context = {}) {
  const amName = context.amName || AM_FALLBACK;
  try {
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, prompt, context: { ...context, amName } }),
    });
    if (res.ok) { const j = await res.json(); if (j.text) return { text: j.text, live: true }; }
  } catch { /* proxy down */ }
  return { text: template(kind, prompt, context), live: false };
}

// Offline fallbacks — clearly usable drafts, no AI required.
function template(kind, prompt, a = {}) {
  const who = a.contact || "there";
  const AM_NAME = a.amName || AM_FALLBACK;
  const what = prompt || "a quick idea to get more out of Jobber";
  if (kind === "text") {
    return `Hi ${who}, it's ${AM_NAME} from Jobber. ${cap(what)}. Got a couple minutes this week?`;
  }
  if (kind === "summary") {
    return `Strong stretch on trial conversions and quoting-driven upgrades, and your calls keep out-converting async outreach. The recurring coaching theme is pricing coming up a touch early on JPay. Goal progress is largely on track — JPay close rate is the main gap to close. Keep leaning into the signals that convert and hold price until value lands. (Connect ChatGPT in Settings for a summary written from your actual entries.)`;
  }
  if (kind === "plan") {
    return [
      `Plan for: ${what}`,
      `1. Shadow 2 strong calls in this area each week and log one takeaway.`,
      `2. Block your top connect window (Tue/Thu 8–10am) for these calls.`,
      `3. Hold pricing until after value — target 12 discovery questions/call.`,
      `4. Review one recording weekly against the rubric.`,
      `Accountability: track the number each Friday on this page.`,
    ].join("\n");
  }
  if (kind === "script") {
    return [
      `P.L.A.N. — "Hi ${who}, it's ${AM_NAME}, your Jobber Account Manager. I saw ${a.trial || "how you're using Jobber"} and wanted to share ${what}. Got 10 minutes?"`,
      `Discovery — Where are you losing time today? How are you quoting / following up now? What would winning more jobs change for you?`,
      `Solution — Tie their signals (${a.signals ? Object.keys(a.signals).slice(0, 2).join(", ") : "usage"}) to the upgrade. Show the one feature that solves their pain.`,
      `Close — Confirm value, ask for the upgrade. Back-pocket: ${a.promo || "30% x 3 months"} or annual/ACBM.`,
    ].join("\n\n");
  }
  // email
  return [
    `Hi ${who},`,
    ``,
    `${cap(what)}. Based on what I'm seeing on ${a.name || "your account"}${a.plan ? ` (${a.plan})` : ""}, there's a clear next step that should pay for itself quickly.`,
    ``,
    `Open to a quick call this week? Happy to walk you through it.`,
    ``,
    `Thanks,`,
    AM_NAME,
  ].join("\n");
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
