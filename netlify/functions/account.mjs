import { json, readJson, clean } from "../lib/http.mjs";
import { getDb } from "../lib/store.mjs";
import { hit } from "../lib/auth.mjs";
import { accountsEnabled, sign, cookie, customerId, currentCustomer, sameOrigin, publicCustomer } from "../lib/session.mjs";

const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
async function googleProfile(credential) {
  if (process.env.JHOAS_TEST_MEMORY === "1") {
    if (!String(credential).startsWith("test:")) return null;
    const [email, name] = String(credential).slice(5).split("|"); return { email, name: name || email };
  }
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), { signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const g = await r.json();
  if (g.aud !== process.env.GOOGLE_CLIENT_ID || String(g.email_verified) !== "true" || !g.email) return null;
  if (!["accounts.google.com", "https://accounts.google.com"].includes(g.iss)) return null;
  return { email: g.email, name: g.name || g.email };
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (!accountsEnabled()) return json({ error: "cuentas_no_configuradas" }, 503);
    const db = await getDb("customers");

    if (path === "/api/auth/google" && req.method === "POST") {
      if (!sameOrigin(req)) return json({ error: "origen" }, 403);
      if (!(await hit(req, "login", 20, 600))) return json({ error: "demasiados_intentos" }, 429);
      const b = await readJson(req, 6000);
      const g = await googleProfile(b.credential);
      if (!g) return json({ error: "google_invalido" }, 401);
      const cid = customerId(g.email);
      const now = new Date().toISOString();
      const c = (await db.get(cid)) || { cid, email: g.email.toLowerCase(), name: clean(g.name, 60), birthday: "", marketing: false, createdAt: now };
      c.lastLogin = now;
      await db.setJSON(cid, c);
      return json({ ok: true, customer: publicCustomer(c) }, 200, { "set-cookie": cookie(sign({ cid, exp: Date.now() + 30 * 864e5 }), 30 * 86400) });
    }
    if (path === "/api/auth/logout" && req.method === "POST") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });

    if (path === "/api/me") {
      const c = await currentCustomer(req);
      if (req.method === "GET") return json({ customer: publicCustomer(c) });
      if (!c) return json({ error: "no_sesion" }, 401);
      if (!sameOrigin(req)) return json({ error: "origen" }, 403);
      if (req.method === "DELETE") { await db.delete(c.cid); return json({ ok: true }, 200, { "set-cookie": cookie("", 0) }); }
      if (req.method === "PUT") {
        const b = await readJson(req, 4000);
        const name = clean(b.name, 60) || c.name;
        let birthday = "";
        if (b.birthday) {
          const m = /^(\d{2})-(\d{2})$/.exec(String(b.birthday)); const mo = m && +m[1], d = m && +m[2];
          if (!m || mo < 1 || mo > 12 || d < 1 || d > DAYS[mo - 1]) return json({ error: "cumple_invalido" }, 400);
          birthday = b.birthday;
        }
        const marketing = b.marketing === true;
        if (marketing && !c.marketing) c.consentAt = new Date().toISOString();
        if (!marketing) c.consentAt = c.consentAt || null;
        Object.assign(c, { name, birthday, marketing });
        await db.setJSON(c.cid, c);
        return json({ ok: true, customer: publicCustomer(c) });
      }
    }
    return json({ error: "no_encontrado" }, 404);
  } catch (e) { return json({ error: e.status ? e.message : "error" }, e.status || 500); }
};
export const config = { path: ["/api/auth/google", "/api/auth/logout", "/api/me"] };
