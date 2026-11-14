import { json, readJson, clean } from "../lib/http.mjs";
import { getDb } from "../lib/store.mjs";
import { hit } from "../lib/auth.mjs";
import { PRODUCTS, ZONES, MAX_QTY_PER_LINE, MAX_LINES } from "../lib/catalog.mjs";

const CODE = /^JH-[A-Z0-9]{6}$/;
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  const b = new Uint8Array(6); crypto.getRandomValues(b);
  return "JH-" + [...b].map((x) => ABC[x % ABC.length]).join("");
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    if (!(await hit(req, "orders", 10, 600))) return json({ error: "demasiados_pedidos" }, 429);
    const b = await readJson(req);

    const lines = Array.isArray(b.items) ? b.items.slice(0, MAX_LINES) : [];
    const items = [];
    let subtotal = 0;
    for (const l of lines) {
      const p = PRODUCTS[String(l && l.key)];
      const qty = Math.floor(Number(l && l.qty));
      if (!p || !(qty >= 1) || qty > MAX_QTY_PER_LINE) return json({ error: "producto_invalido" }, 400);
      items.push({ key: l.key, name: p.name, label: p.label, price: p.price, qty });
      subtotal += p.price * qty;
    }
    if (!items.length) return json({ error: "carrito_vacio" }, 400);

    const mode = b.mode === "pickup" ? "pickup" : "delivery";
    let city = "", zone = "", address = "", shipping = 0;
    if (mode === "delivery") {
      city = clean(b.city, 20); zone = clean(b.zone, 40);
      if (!(ZONES[city] && zone in ZONES[city])) return json({ error: "zona_invalida" }, 400);
      shipping = ZONES[city][zone];
      address = clean(b.address, 200);
      if (!address) return json({ error: "direccion_requerida" }, 400);
    }
    const name = clean(b.name, 60);
    if (!name) return json({ error: "nombre_requerido" }, 400);

    const db = await getDb("orders");
    let code = CODE.test(String(b.code || "")) ? b.code : newCode();
    for (let i = 0; i < 5 && (await db.get(code)); i++) code = newCode();

    const order = {
      code, createdAt: new Date().toISOString(), status: "nuevo",
      name, mode, city, zone, address, items, subtotal, shipping, total: subtotal + shipping,
      clientTotal: Number.isFinite(Number(b.clientTotal)) ? Number(b.clientTotal) : null
    };
    await db.setJSON(code, order);

    const hook = process.env.NOTIFY_WEBHOOK_URL;
    if (hook) {
      const text = `🧁 Pedido ${code}: ${name} · ${items.map((i) => i.qty + "× " + i.name + " (" + i.label + ")").join(", ")} · Total Bs ${order.total} · ${mode === "pickup" ? "Recojo" : zone + ", " + city}`;
      try { await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(4000) }); } catch { /* el aviso es opcional */ }
    }
    return json({ ok: true, code, total: order.total });
  } catch (e) {
    return json({ error: e.status ? e.message : "error" }, e.status || 500);
  }
};
export const config = { path: "/api/orders" };
