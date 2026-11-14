export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}
export async function readJson(req, maxBytes = 20000) {
  const text = await req.text();
  if (text.length > maxBytes) throw Object.assign(new Error("too_big"), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error("bad_json"), { status: 400 }); }
}
export function clean(s, max) {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
