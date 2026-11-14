import { getDb } from "./store.mjs";
import { sendMail, promoMail } from "./mail.mjs";
import { unsubToken } from "./session.mjs";

export const DEFAULT_PROMO = {
  birthdayEnabled: false,
  birthdaySubject: "🎂 ¡Feliz cumpleaños, {nombre}!",
  birthdayBody: "Hola {nombre}, en Jhoa's queremos celebrar contigo. Escríbenos por WhatsApp y te regalamos un alfajor por tu cumpleaños."
};
export async function getPromo() { return { ...DEFAULT_PROMO, ...((await (await getDb("config")).get("promo")) || {}) }; }
export async function listCustomers() {
  const db = await getDb("customers"); const { blobs } = await db.list(); const out = [];
  for (const b of blobs.slice(0, 5000)) { const c = await db.get(b.key); if (c) out.push(c); }
  return out;
}
export function todayLaPaz(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { md: p.month + "-" + p.day, year: +p.year };
}
const unsub = (base, c) => `${base}/api/unsubscribe?c=${c.cid}&t=${unsubToken(c.cid)}`;

export async function sendBirthdays(base, now = new Date()) {
  const promo = await getPromo(); if (!promo.birthdayEnabled) return { sent: 0, skipped: "desactivado" };
  const { md, year } = todayLaPaz(now); const db = await getDb("customers"); let sent = 0;
  for (const c of await listCustomers()) {
    if (!c.marketing || c.birthday !== md || c.lastBirthdayYear === year) continue;
    const { text, html } = promoMail(promo.birthdayBody, c, unsub(base, c));
    try { await sendMail({ to: c.email, subject: promo.birthdaySubject.replace(/\{nombre\}/gi, (c.name || "").split(" ")[0]), text, html }); c.lastBirthdayYear = year; await db.setJSON(c.cid, c); sent++; } catch { /* se reintenta mañana no: queda sin marcar y se reintenta en la próxima corrida del día */ }
  }
  return { sent };
}
export async function sendCampaign({ subject, body, test }, base) {
  const targets = test ? [{ cid: "0".repeat(24), email: process.env.GMAIL_USER || "", name: "Prueba" }] : (await listCustomers()).filter((c) => c.marketing).slice(0, 100);
  let sent = 0, failed = 0;
  for (const c of targets) {
    if (!c.email) { failed++; continue; }
    const { text, html } = promoMail(body, c, unsub(base, c));
    try { await sendMail({ to: c.email, subject: subject.replace(/\{nombre\}/gi, (c.name || "").split(" ")[0]), text, html }); sent++; } catch { failed++; }
  }
  return { sent, failed, total: targets.length };
}
