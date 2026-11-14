import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "./store.mjs";

const secret = () => process.env.SESSION_SECRET || (process.env.ADMIN_PASSWORD ? "s:" + process.env.ADMIN_PASSWORD : "");
export const accountsEnabled = () => !!secret() && !!process.env.GOOGLE_CLIENT_ID;
const mac = (s) => createHmac("sha256", secret()).update(s).digest("base64url");

export function sign(payload) { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return body + "." + mac(body); }
export function verify(tok) {
  if (!secret() || typeof tok !== "string") return null;
  const [body, sig] = tok.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
export const customerId = (email) => createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 24);
export const unsubToken = (cid) => createHmac("sha256", secret()).update("unsub:" + cid).digest("hex").slice(0, 24);
export const cookie = (value, maxAge) => `jhoas_s=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export async function currentCustomer(req) {
  const m = /(?:^|;\s*)jhoas_s=([^;]+)/.exec(req.headers.get("cookie") || "");
  const p = m && verify(m[1]);
  if (!p || !p.cid) return null;
  return (await (await getDb("customers")).get(p.cid)) || null;
}
// Bloquea envíos desde otros sitios (CSRF) en peticiones que cambian datos.
export function sameOrigin(req) {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === new URL(req.url).host; } catch { return false; }
}
export function publicCustomer(c) { return c && { name: c.name, email: c.email, birthday: c.birthday || "", marketing: !!c.marketing, firstPurchase: !c.usedFirstDiscount }; }
