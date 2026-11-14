// Capa de almacenamiento. En Netlify usa Netlify Blobs; en pruebas locales (JHOAS_TEST_MEMORY=1) usa memoria.
const mem = new Map();
function memStore(name) {
  const p = name + "/";
  return {
    async get(k) { return mem.has(p + k) ? JSON.parse(mem.get(p + k)) : null; },
    async setJSON(k, v) { mem.set(p + k, JSON.stringify(v)); },
    async delete(k) { mem.delete(p + k); },
    async list(opts = {}) {
      const pre = p + (opts.prefix || "");
      return { blobs: [...mem.keys()].filter((k) => k.startsWith(pre)).map((k) => ({ key: k.slice(p.length) })) };
    }
  };
}
export async function getDb(name) {
  if (process.env.JHOAS_TEST_MEMORY === "1") return memStore(name);
  const { getStore } = await import("@netlify/blobs");
  const s = getStore({ name, consistency: "strong" });
  return {
    get: (k) => s.get(k, { type: "json" }),
    setJSON: (k, v) => s.setJSON(k, v),
    delete: (k) => s.delete(k),
    list: (o) => s.list(o)
  };
}
