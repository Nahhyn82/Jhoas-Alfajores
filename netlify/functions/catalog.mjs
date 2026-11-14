import { json } from "../lib/http.mjs";
import { getDb } from "../lib/store.mjs";
import { PRODUCTS, ZONES } from "../lib/catalog.mjs";

export default async () => {
  let soldOut = [];
  try { soldOut = ((await (await getDb("config")).get("soldout")) || {}).ids || []; } catch { /* sin base: todo disponible */ }
  const prices = {};
  Object.keys(PRODUCTS).forEach((k) => (prices[k] = PRODUCTS[k].price));
  return json({ soldOut, prices, zones: ZONES }, 200, { "cache-control": "public, max-age=30" });
};
export const config = { path: "/api/catalog" };
