import { json } from "../lib/http.mjs";
import { getDb } from "../lib/store.mjs";
import { effective } from "../lib/content.mjs";
import { FIRST_PURCHASE_PCT } from "../lib/catalog.mjs";

export default async () => {
  let soldOut = [];
  try { soldOut = ((await (await getDb("config")).get("soldout")) || {}).ids || []; } catch { /* sin base: todo disponible */ }
  const { content, products, zones } = await effective();
  const prices = {};
  Object.keys(products).forEach((k) => (prices[k] = products[k].price));
  return json({ soldOut, prices, zones, content, firstPurchasePct: FIRST_PURCHASE_PCT, googleClientId: process.env.GOOGLE_CLIENT_ID && process.env.ADMIN_PASSWORD ? process.env.GOOGLE_CLIENT_ID : "" }, 200, { "cache-control": "public, max-age=20" });
};
export const config = { path: "/api/catalog" };
