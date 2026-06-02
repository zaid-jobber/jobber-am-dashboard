// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines).
export function parseCSV(text) {
  const rows = [];
  let cur = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const headers = (rows.shift() || []).map((h) => h.trim());
  const objs = rows
    .filter((r) => r.some((x) => (x || "").trim() !== ""))
    .map((r) => { const o = {}; headers.forEach((h, i) => { o[h] = (r[i] || "").trim(); }); return o; });
  return { headers, rows: objs };
}
