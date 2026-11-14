import { getDb } from "./store.mjs";
import { PRODUCTS, ZONES } from "./catalog.mjs";

// Catálogo "efectivo" = catálogo base + cambios guardados desde el panel (precios, nombres, zonas).
export async function effective() {
  let c = {};
  try { c = (await (await getDb("config")).get("content")) || {}; } catch { /* sin base: valores por defecto */ }
  const products = {};
  for (const [k, p] of Object.entries(PRODUCTS)) {
    const price = c.prices && Number.isInteger(c.prices[k]) ? c.prices[k] : p.price;
    const name = c.names && c.names[p.flavor] ? c.names[p.flavor] : p.name;
    products[k] = { ...p, price, name };
  }
  const zones = c.zones && Object.keys(c.zones).length ? c.zones : ZONES;
  return { content: c, products, zones };
}

const KEY = /^[a-z0-9:_\-|./]{1,60}$/;
const str = (v, n) => typeof v === "string" && v.length <= n;
const noTags = (s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, "");

// Valida y limpia lo que envía el panel. Devuelve el objeto limpio o lanza Error con mensaje.
export function validateContent(b) {
  if (!b || typeof b !== "object") throw new Error("contenido_invalido");
  const out = { texts: {}, images: {}, alts: {}, prices: {}, names: {}, descs: {}, zones: {}, phone: "", links: [] };
  if (b.links != null) {
    if (!Array.isArray(b.links) || b.links.length > 12) throw new Error("enlaces_invalidos");
    for (const l of b.links) {
      const label = noTags(String(l && l.label || "")).trim(), url = String(l && l.url || "").trim();
      let ok = false; try { const u = new URL(url); ok = u.protocol === "https:" || u.protocol === "http:"; } catch { /* inválida */ }
      if (!label || label.length > 40 || !ok || url.length > 300) throw new Error("enlaces_invalidos");
      out.links.push({ label, url });
    }
  }
  for (const [k, v] of Object.entries(b.texts || {})) { if (!KEY.test(k) || !str(v, 600)) throw new Error("texto_invalido"); out.texts[k] = noTags(v); }
  for (const [k, v] of Object.entries(b.alts || {})) { if (!KEY.test(k) || !str(v, 200)) throw new Error("alt_invalido"); out.alts[k] = noTags(v); }
  for (const [k, v] of Object.entries(b.images || {})) { if (!KEY.test(k) || !/^u-[a-f0-9]{16}$/.test(String(v))) throw new Error("imagen_invalida"); out.images[k] = v; }
  const flavors = new Set(Object.values(PRODUCTS).map((p) => p.flavor));
  for (const [k, v] of Object.entries(b.prices || {})) {
    if (!PRODUCTS[k] || !Number.isInteger(v) || v < 1 || v > 9999) throw new Error("precio_invalido");
    out.prices[k] = v;
  }
  for (const [k, v] of Object.entries(b.names || {})) { if (!flavors.has(k) || !str(v, 60) || !v.trim()) throw new Error("nombre_invalido"); out.names[k] = noTags(v).trim(); }
  for (const [k, v] of Object.entries(b.descs || {})) { if (!flavors.has(k) || !str(v, 300)) throw new Error("descripcion_invalida"); out.descs[k] = noTags(v).trim(); }
  const cities = Object.entries(b.zones || {});
  if (cities.length > 10) throw new Error("zonas_invalidas");
  for (const [city, zs] of cities) {
    if (!str(city, 30) || !city.trim() || typeof zs !== "object" || Object.keys(zs).length > 80) throw new Error("zonas_invalidas");
    out.zones[noTags(city).trim()] = {};
    for (const [z, fee] of Object.entries(zs)) {
      if (!str(z, 40) || !z.trim() || !Number.isInteger(fee) || fee < 0 || fee > 500) throw new Error("zonas_invalidas");
      out.zones[noTags(city).trim()][noTags(z).trim()] = fee;
    }
  }
  if (b.phone) { if (!/^\d{8,15}$/.test(String(b.phone))) throw new Error("telefono_invalido"); out.phone = String(b.phone); }
  return out;
}
