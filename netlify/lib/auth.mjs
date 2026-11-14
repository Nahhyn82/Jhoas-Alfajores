import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "./store.mjs";
const h = (s) => createHash("sha256").update(String(s)).digest();

// Devuelve true si la contraseña enviada coincide con ADMIN_PASSWORD. Sin variable configurada, el panel queda cerrado.
export function passwordOk(given) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || real.length < 8) return false;
  return timingSafeEqual(h(given || ""), h(real));
}
export function adminConfigured() {
  return !!process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8;
}
// Limita intentos: guarda un contador por hash de IP (nunca la IP real) por ventana de tiempo.
export async function hit(req, bucket, limit, windowSec) {
  const ip = req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const day = process.env.RATE_SALT || "jhoas";
  const id = createHash("sha256").update(day + ip).digest("hex").slice(0, 24);
  const slot = Math.floor(Date.now() / (windowSec * 1000));
  const key = `${bucket}-${id}-${slot}`;
  const db = await getDb("ratelimit");
  const cur = (await db.get(key)) || { n: 0 };
  cur.n++;
  await db.setJSON(key, cur);
  return cur.n <= limit;
}
