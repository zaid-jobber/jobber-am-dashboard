// Minimal MCP (Model Context Protocol) client over Streamable HTTP — enough to
// call a Zapier MCP server's actions (tools/list, tools/call). Stateless per call.
// Zapier MCP gives you a server URL containing your key; put it in ZAPIER_MCP_URL.

async function rpc(url, body, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const sid = res.headers.get("Mcp-Session-Id") || sessionId;
  const ct = res.headers.get("content-type") || "";
  let json = null;
  if (ct.includes("text/event-stream")) {
    // parse SSE: take the last `data:` JSON payload
    const text = await res.text();
    const datas = text.split(/\n\n/).map((b) => b.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("")).filter(Boolean);
    for (let i = datas.length - 1; i >= 0; i--) { try { json = JSON.parse(datas[i]); break; } catch { /* keep looking */ } }
  } else if (ct.includes("application/json")) {
    json = await res.json();
  }
  return { json, sid, status: res.status };
}

let _id = 0;
const nextId = () => ++_id;

async function session(url) {
  const init = await rpc(url, {
    jsonrpc: "2.0", id: nextId(), method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "am-hub", version: "0.1" } },
  });
  const sid = init.sid;
  // best-effort initialized notification
  try { await rpc(url, { jsonrpc: "2.0", method: "notifications/initialized" }, sid); } catch { /* ignore */ }
  return sid;
}

export async function mcpListTools(url) {
  const sid = await session(url);
  const r = await rpc(url, { jsonrpc: "2.0", id: nextId(), method: "tools/list" }, sid);
  return r.json?.result?.tools || [];
}

export async function mcpCall(url, name, args = {}) {
  const sid = await session(url);
  const r = await rpc(url, { jsonrpc: "2.0", id: nextId(), method: "tools/call", params: { name, arguments: args } }, sid);
  const content = r.json?.result?.content || [];
  // Zapier returns results as text content (often JSON). Surface both raw + parsed.
  const text = content.map((c) => c.text).filter(Boolean).join("\n");
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { raw: text, parsed, result: r.json?.result, error: r.json?.error };
}
