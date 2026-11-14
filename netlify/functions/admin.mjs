import { json, readJson, clean } from "../lib/http.mjs";
import { getDb } from "../lib/store.mjs";
import { passwordOk, adminConfigured, hit } from "../lib/auth.mjs";
import { PRODUCTS } from "../lib/catalog.mjs";

const STATUSES = ["nuevo", "confirmado", "entregado", "cancelado"];

async function allOrders() {
  const db = await getDb("orders");
  const { blobs } = await db.list();
  const out = [];
  for (const b of blobs.slice(0, 3000)) { const o = await db.get(b.key); if (o) out.push(o); }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
// Evita que Excel ejecute fórmulas escondidas en textos que escribió un cliente.
const csvCell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

export default async (req) => {
  if (!adminConfigured()) return json({ error: "admin_no_configurado" }, 503);
  if (!(await hit(req, "admin", 30, 600))) return json({ error: "demasiados_intentos" }, 429);
  if (!passwordOk(req.headers.get("x-admin-password"))) return json({ error: "no_autorizado" }, 401);

  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (path.endsWith("/login")) return json({ ok: true });

    if (path.endsWith("/orders") && req.method === "GET") return json({ orders: await allOrders() });

    if (path.endsWith("/orders") && req.method === "PATCH") {
      const b = await readJson(req);
      if (!STATUSES.includes(b.status)) return json({ error: "estado_invalido" }, 400);
      const db = await getDb("orders");
      const o = await db.get(clean(b.code, 12));
      if (!o) return json({ error: "no_existe" }, 404);
      o.status = b.status; o.updatedAt = new Date().toISOString();
      await db.setJSON(o.code, o);
      return json({ ok: true, order: o });
    }

    if (path.endsWith("/stats")) {
      const orders = (await allOrders()).filter((o) => o.status !== "cancelado");
      const byFlavor = {}, byDay = {};
      let revenue = 0;
      for (const o of orders) {
        revenue += o.total;
        const d = o.createdAt.slice(0, 10); byDay[d] = (byDay[d] || 0) + o.total;
        for (const i of o.items) { const p = PRODUCTS[i.key]; const f = p ? p.name : i.name; byFlavor[f] = (byFlavor[f] || 0) + i.qty; }
      }
      return json({ orders: orders.length, revenue, byFlavor, byDay });
    }

    if (path.endsWith("/soldout")) {
      const db = await getDb("config");
      if (req.method === "GET") return json({ ids: ((await db.get("soldout")) || {}).ids || [] });
      const b = await readJson(req);
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((id) => Object.values(PRODUCTS).some((p) => p.flavor === id));
      await db.setJSON("soldout", { ids: [...new Set(ids)] });
      return json({ ok: true, ids });
    }

    if (path.endsWith("/export.csv")) {
      const rows = [["Código", "Fecha", "Estado", "Cliente", "Modo", "Ciudad", "Zona", "Dirección", "Productos", "Subtotal", "Envío", "Total"]];
      for (const o of await allOrders())
        rows.push([o.code, o.createdAt, o.status, o.name, o.mode, o.city, o.zone, o.address, o.items.map((i) => i.qty + "x " + i.name + " (" + i.label + ")").join("; "), o.subtotal, o.shipping, o.total]);
      return new Response("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="pedidos-jhoas.csv"', "cache-control": "no-store" }
      });
    }
    return json({ error: "no_encontrado" }, 404);
  } catch (e) {
    return json({ error: e.status ? e.message : "error" }, e.status || 500);
  }
};
export const config = { path: ["/api/admin/*"] };
