import { getDb } from "../lib/store.mjs";
import { unsubToken } from "../lib/session.mjs";

const page = (m) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;max-width:440px;margin:60px auto;padding:0 16px;color:#3a2418"><h2>Jhoa's Alfajores</h2><p>${m}</p><p><a href="/">Volver a la página</a></p>`, { headers: { "content-type": "text/html; charset=utf-8" } });
export default async (req) => {
  const u = new URL(req.url); const c = u.searchParams.get("c") || "", t = u.searchParams.get("t") || "";
  if (!/^[a-f0-9]{24}$/.test(c) || t !== unsubToken(c)) return page("Enlace inválido.");
  const db = await getDb("customers"); const rec = await db.get(c);
  if (rec) { rec.marketing = false; await db.setJSON(c, rec); }
  return page("Listo, ya no recibirás promociones por correo.");
};
export const config = { path: "/api/unsubscribe" };
