import { sendBirthdays } from "../lib/promo.mjs";
// Corre todos los días 12:00 UTC (08:00 hora de La Paz).
export default async () => { await sendBirthdays(process.env.URL || "https://jhoas.netlify.app"); };
export const config = { schedule: "0 12 * * *" };
