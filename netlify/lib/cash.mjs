import { getDb } from "./store.mjs";
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const METHODS = ["efectivo", "qr", "otro"];

async function all(db, prefix) {
  const { blobs } = await db.list({ prefix });
  const out = []; for (const b of blobs.slice(0, 3000)) { const v = await db.get(b.key); if (v) out.push(v); }
  return out;
}
export function summarize(shift, movs) {
  const s = { ingresos: { efectivo: 0, qr: 0, otro: 0 }, egresos: { efectivo: 0, qr: 0, otro: 0 } };
  for (const m of movs) s[m.type === "egreso" ? "egresos" : "ingresos"][m.method] += m.amount;
  const expectedCash = shift.openingAmount + s.ingresos.efectivo - s.egresos.efectivo;
  const totalIn = s.ingresos.efectivo + s.ingresos.qr + s.ingresos.otro, totalOut = s.egresos.efectivo + s.egresos.qr + s.egresos.otro;
  return { ...s, expectedCash, totalIn, totalOut, net: totalIn - totalOut };
}
export async function state() {
  const db = await getDb("cash");
  const cur = await db.get("current");
  const shifts = (await all(db, "shift-")).sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
  const open = cur ? shifts.find((s) => s.id === cur.id && s.status === "open") : null;
  const movs = await all(db, "mov-");
  const movements = open ? movs.filter((m) => m.shiftId === open.id).sort((a, b) => (a.at < b.at ? 1 : -1)) : [];
  const orphans = movs.filter((m) => !m.shiftId).length;
  return { open, summary: open ? summarize(open, movements) : null, movements, orphans, history: shifts.filter((s) => s.status === "closed").slice(0, 30) };
}
export async function openShift(amount) {
  const db = await getDb("cash");
  const cur = await db.get("current");
  if (cur && (await db.get("shift-" + cur.id))?.status === "open") throw Object.assign(new Error("turno_ya_abierto"), { status: 409 });
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e6) throw Object.assign(new Error("monto_invalido"), { status: 400 });
  const s = { id: id(), status: "open", openedAt: new Date().toISOString(), openingAmount: Math.round(amount * 100) / 100 };
  await db.setJSON("shift-" + s.id, s); await db.setJSON("current", { id: s.id });
  // Cobros hechos sin turno abierto se adoptan en este turno.
  for (const m of await all(db, "mov-")) if (!m.shiftId) { m.shiftId = s.id; await db.setJSON("mov-" + m.id, m); }
  return s;
}
export async function addMovement({ type, method, amount, concept, orderCode, fixedId }) {
  if (!["ingreso", "egreso"].includes(type) || !METHODS.includes(method)) throw Object.assign(new Error("movimiento_invalido"), { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e6) throw Object.assign(new Error("monto_invalido"), { status: 400 });
  const db = await getDb("cash");
  const cur = await db.get("current");
  const open = cur && (await db.get("shift-" + cur.id));
  const m = { id: fixedId || id(), at: new Date().toISOString(), type, method, amount: Math.round(amount * 100) / 100, concept: String(concept || "").slice(0, 120), orderCode: orderCode || null, shiftId: open && open.status === "open" ? open.id : null };
  await db.setJSON("mov-" + m.id, m);
  return m;
}
export async function removeMovement(mid) {
  const db = await getDb("cash");
  const m = await db.get("mov-" + mid); if (!m) return false;
  const sh = m.shiftId && (await db.get("shift-" + m.shiftId));
  if (sh && sh.status === "closed") throw Object.assign(new Error("turno_cerrado"), { status: 409 });
  await db.delete("mov-" + mid); return true;
}
export async function closeShift(counted, note) {
  const db = await getDb("cash");
  const cur = await db.get("current");
  const sh = cur && (await db.get("shift-" + cur.id));
  if (!sh || sh.status !== "open") throw Object.assign(new Error("sin_turno"), { status: 409 });
  if (!Number.isFinite(counted) || counted < 0 || counted > 1e6) throw Object.assign(new Error("monto_invalido"), { status: 400 });
  const movs = (await all(db, "mov-")).filter((m) => m.shiftId === sh.id);
  const sum = summarize(sh, movs);
  sh.status = "closed"; sh.closedAt = new Date().toISOString();
  sh.closing = { counted: Math.round(counted * 100) / 100, expected: sum.expectedCash, diff: Math.round((counted - sum.expectedCash) * 100) / 100, note: String(note || "").slice(0, 200), summary: sum };
  await db.setJSON("shift-" + sh.id, sh); await db.delete("current");
  return sh;
}
export async function movementsCsv() {
  const db = await getDb("cash");
  return (await all(db, "mov-")).sort((a, b) => (a.at < b.at ? -1 : 1));
}
