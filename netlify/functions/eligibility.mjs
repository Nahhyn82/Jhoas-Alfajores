import { json } from "../lib/http.mjs";
import { currentCustomer } from "../lib/session.mjs";
import { keysFor, eligible } from "../lib/discount.mjs";
import { FIRST_PURCHASE_PCT } from "../lib/catalog.mjs";

export default async (req) => {
  let cust = null; try { cust = await currentCustomer(req); } catch { /* sin sesión */ }
  const d = new URL(req.url).searchParams.get("d");
  return json({ eligible: await eligible(keysFor(cust, d)), pct: FIRST_PURCHASE_PCT });
};
export const config = { path: "/api/eligibility" };
