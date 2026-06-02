// AI generation via OpenAI (Jobber has ChatGPT Enterprise). Build-ahead: dormant
// until OPENAI_API_KEY is in .env. Works with the OpenAI API or any OpenAI-
// compatible endpoint (set OPENAI_BASE_URL for an Azure/enterprise gateway).
// Read-only helper — generates outreach drafts; nothing is persisted server-side.

const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export const aiConfigured = () => !!process.env.OPENAI_API_KEY || !!process.env.ZAPIER_MCP_URL;

// System prompts per draft kind, grounded in the AM's real sales motion.
const SYSTEM = {
  email: "You are an Expansion Account Manager at Jobber writing a short, warm, specific upsell email to a home-service business owner. Plain text, no markdown. 90 words max. One clear ask. Reference their plan and signals when given. Sign off as the AM's first name only.",
  text: "You are an Expansion Account Manager at Jobber writing a single SMS to a home-service business owner. Under 320 characters, friendly, specific, one clear ask, no links unless asked. No markdown.",
  script: "You are a sales coach for a Jobber Expansion Account Manager. Produce a tight call script following Jobber's flow: P.L.A.N. opener, Discovery (a few targeted questions), Solution tie-back to their signals, and a close with a back-pocket promo. Use short labeled sections. Plain text, no markdown headers beyond simple labels. Keep it skimmable for a live call.",
  summary: "You are a sales coaching assistant for a Jobber Expansion Account Manager. Summarize their development for the requested period from the journal entries and goal progress provided: call out wins, recurring learnings/coaching themes, and progress (or gaps) toward goals. 4-6 sentences, specific, encouraging but honest. Plain text, no markdown.",
  plan: "You are a sales coach for a Jobber Expansion Account Manager. From their goal and recent development notes, build a concrete, actionable growth plan: 3-5 numbered steps tied to their data, each with a measurable weekly target. End with one sentence on how to stay accountable. Plain text, short.",
};

// context = { name, contact, plan, trial, signals, promo, ... } → compact brief.
function brief(ctx = {}) {
  const bits = [];
  if (ctx.name) bits.push(`Account: ${ctx.name}`);
  if (ctx.contact) bits.push(`Contact: ${ctx.contact}`);
  if (ctx.plan) bits.push(`Plan: ${ctx.plan}`);
  if (ctx.trial) bits.push(`Trial: ${ctx.trial}`);
  if (ctx.industry) bits.push(`Industry: ${ctx.industry}`);
  if (ctx.upgradeStatus) bits.push(`Status: ${ctx.upgradeStatus}`);
  if (ctx.signals) bits.push(`Signals: ${Object.entries(ctx.signals).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  if (ctx.promo) bits.push(`Eligible promo: ${ctx.promo}`);
  if (ctx.amName) bits.push(`AM first name: ${ctx.amName}`);
  return bits.join("\n");
}

export async function generate({ kind = "email", prompt = "", context = {} }) {
  const system = SYSTEM[kind] || SYSTEM.email;
  const user = [brief(context), prompt ? `\nWhat to write: ${prompt}` : ""].filter(Boolean).join("\n") || "Write the outreach.";
  // Prefer the Zapier MCP ChatGPT action (uses Jobber's ChatGPT Enterprise);
  // fall back to a direct OpenAI key if a Zapier route isn't available.
  if (process.env.ZAPIER_MCP_URL) {
    try { return await zapierChat(system, user); }
    catch (e) { if (!process.env.OPENAI_API_KEY) throw e; }
  }
  return await openaiDirect(system, user);
}

async function openaiDirect(system, user) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || "";
}

// Route through the Zapier MCP "chatgpt_openai_conversation" action.
async function zapierChat(system, user) {
  const { mcpCall } = await import("./mcp.js");
  const tool = process.env.ZAPIER_AI_TOOL || "chatgpt_openai_conversation";
  const { raw, parsed, error } = await mcpCall(process.env.ZAPIER_MCP_URL, tool, {
    instructions: system,
    user_message: user,
    output_hint: "Return only the drafted message body as plain text — no preamble, labels, or quotes.",
    model: MODEL,
  });
  if (error) throw new Error("Zapier AI: " + JSON.stringify(error));
  if (parsed?.isError) throw new Error("Zapier AI: " + (parsed.error || "tool error"));
  const out = extractText(parsed) || (raw || "").trim();
  if (!out || /isError|exceeded your current quota/i.test(out)) throw new Error("Zapier AI returned no usable text");
  return out;
}
function extractText(p) {
  if (!p) return "";
  if (typeof p === "string") return p.trim();
  for (const k of ["response", "output", "content", "text", "message", "reply", "result", "assistant_message", "assistant"]) {
    if (typeof p[k] === "string" && p[k].trim()) return p[k].trim();
  }
  if (Array.isArray(p.results) && p.results[0]) return extractText(p.results[0]);
  if (Array.isArray(p.choices) && p.choices[0]) return extractText(p.choices[0].message || p.choices[0]);
  return "";
}
