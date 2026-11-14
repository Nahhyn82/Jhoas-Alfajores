import { json, readJson, clean } from "./http.mjs";
import { getDb } from "./store.mjs";
import { DEFAULT_PROMO, getPromo, listCustomers, sendCampaign, todayLaPaz } from "./promo.mjs";
import { siteUrl } from "./mail.mjs";
import * as cash from "./cash.mjs";

const csvCell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
const csv = (rows, name) => new Response("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });

// Cobro de un pedido -> movimiento de caja (idempotente por código de pedido).
export async function syncOrderPayment(order) {
  if (order.paid) await cash.addMovement({ type: "ingreso", method: order.pay === "qr" ? "qr" : "efectivo", amount: order.total, concept: "Pedido " + order.code, orderCode: order.code, fixedId: "ord-" + order.code });
  else await cash.removeMovement("ord-" + order.code).catch(() => {});
}

export async function handle(req, path) {
  const get = req.method === "GET";
  if (path.endsWith("/customers")) {
    const cs = (await listCustomers()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const { md } = todayLaPaz();
    return json({ total: cs.length, consent: cs.filter((c) => c.marketing).length, birthdaysToday: cs.filter((c) => c.birthday === md).length, customers: cs.map(({ cid, email, name, birthday, marketing, createdAt }) => ({ cid, email, name, birthday, marketing, createdAt })) });
  }
  if (path.endsWith("/customers.csv")) {
    const cs = await listCustomers();
    return csv([["Nombre", "Correo", "Cumpleaños (MM-DD)", "Acepta promociones", "Registrado"], ...cs.map((c) => [c.name, c.email, c.birthday, c.marketing ? "sí" : "no", c.createdAt])], "clientes-jhoas.csv");
  }
  if (path.endsWith("/promo")) {
    const db = await getDb("config");
    if (get) return json({ promo: { ...DEFAULT_PROMO, ...((await db.get("promo")) || {}) } });
    const b = await readJson(req, 8000);
    const p = { birthdayEnabled: b.birthdayEnabled === true, birthdaySubject: clean(b.birthdaySubject, 120), birthdayBody: String(b.birthdayBody || "").replace(/[<>]/g, "").slice(0, 1500) };
    if (!p.birthdaySubject || !p.birthdayBody.trim()) return json({ error: "texto_requerido" }, 400);
    await db.setJSON("promo", p); return json({ ok: true, promo: p });
  }
  if (path.endsWith("/promo/send") && req.method === "POST") {
    const b = await readJson(req, 8000);
    const subject = clean(b.subject, 120), body = String(b.body || "").replace(/[<>]/g, "").slice(0, 2000);
    if (!subject || !body.trim()) return json({ error: "texto_requerido" }, 400);
    try { return json({ ok: true, ...(await sendCampaign({ subject, body, test: b.test === true }, siteUrl(req))) }); }
    catch (e) { return json({ error: e.message || "error_correo" }, 500); }
  }
  if (path.endsWith("/cash") && get) return json(await cash.state());
  if (path.endsWith("/cash/open") && req.method === "POST") return json({ ok: true, shift: await cash.openShift(Number((await readJson(req, 1000)).amount)) });
  if (path.endsWith("/cash/movement") && req.method === "POST") { const b = await readJson(req, 2000); return json({ ok: true, movement: await cash.addMovement({ type: b.type, method: b.method, amount: Number(b.amount), concept: clean(b.concept, 120) }) }); }
  if (path.endsWith("/cash/movement") && req.method === "DELETE") { const id = new URL(req.url).searchParams.get("id") || ""; return json({ ok: await cash.removeMovement(id.replace(/[^a-z0-9\-]/gi, "")) }); }
  if (path.endsWith("/cash/close") && req.method === "POST") { const b = await readJson(req, 2000); return json({ ok: true, shift: await cash.closeShift(Number(b.counted), clean(b.note, 200)) }); }
  if (path.endsWith("/cash.csv")) {
    const ms = await cash.movementsCsv();
    return csv([["Fecha", "Tipo", "Método", "Monto", "Concepto", "Pedido", "Turno"], ...ms.map((m) => [m.at, m.type, m.method, m.amount, m.concept, m.orderCode || "", m.shiftId || ""])], "caja-jhoas.csv");
  }
  return null;
}
