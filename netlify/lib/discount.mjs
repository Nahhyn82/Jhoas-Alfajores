import { createHash } from "node:crypto";
import { getDb } from "./store.mjs";

const DEV = /^[a-f0-9]{32}$/;
// Llaves que identifican a quien compra: su cuenta (si ingresó) y/o su dispositivo (código aleatorio guardado en el navegador).
export function keysFor(cust, deviceId) {
  const k = [];
  if (cust && cust.cid) k.push("c-" + cust.cid);
  if (DEV.test(String(deviceId || ""))) k.push("d-" + createHash("sha256").update(String(deviceId)).digest("hex").slice(0, 24));
  return k;
}
export async function eligible(keys) {
  if (!keys.length) return false;
  const db = await getDb("discounts");
  for (const k of keys) if (await db.get(k)) return false;
  return true;
}
export async function consume(keys, code) { const db = await getDb("discounts"); for (const k of keys) await db.setJSON(k, { code, at: new Date().toISOString() }); }
export async function release(keys) { const db = await getDb("discounts"); for (const k of keys || []) await db.delete(k); }
