import { getDb } from "../lib/store.mjs";

export default async (req) => {
  const key = new URL(req.url).pathname.split("/").pop();
  if (!/^u-[a-f0-9]{16}$/.test(key)) return new Response("no", { status: 404 });
  const rec = await (await getDb("images")).get(key);
  if (!rec) return new Response("no", { status: 404 });
  return new Response(Buffer.from(rec.b64, "base64"), {
    headers: { "content-type": rec.type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" }
  });
};
export const config = { path: "/api/img/*" };
