const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function sendMail({ to, subject, text, html }) {
  if (process.env.JHOAS_TEST_MEMORY === "1") { (globalThis.__mails ||= []).push({ to, subject, text, html }); return true; }
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("gmail_no_configurado");
  const nodemailer = (await import("nodemailer")).default;
  const tr = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await tr.sendMail({ from: `"Jhoa's Alfajores" <${user}>`, to, subject, text, html });
  return true;
}
// Arma el correo de promoción: reemplaza {nombre} y agrega el enlace para darse de baja.
export function promoMail(body, customer, unsubUrl) {
  const first = (customer.name || "").split(" ")[0] || "";
  const t = String(body).replace(/\{nombre\}/gi, first);
  const text = t + "\n\n—\nJhoa's Alfajores. Si no quieres recibir más promociones: " + unsubUrl;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#3a2418"><p>${esc(t).replace(/\n/g, "<br>")}</p><hr style="border:0;border-top:1px solid #e6d8c9"><p style="font-size:12px;color:#7a6657">Jhoa's Alfajores. <a href="${esc(unsubUrl)}">Dejar de recibir promociones</a></p></div>`;
  return { text, html };
}
export function siteUrl(req) { return process.env.URL || new URL(req.url).origin; }
