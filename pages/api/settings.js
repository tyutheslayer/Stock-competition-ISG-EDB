// pages/api/settings.js
import prisma from "../../lib/prisma";

const FALLBACK_BPS = Number(process.env.DEFAULT_TRADING_FEE_BPS ?? 0);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const row = await prisma.settings.findUnique({ where: { id: 1 } });
    if (row && typeof row.tradingFeeBps === "number") {
      return res.json({ tradingFeeBps: row.tradingFeeBps, source: "db" });
    }
  } catch {/* noop: peut ne pas exister en prod */}
  return res.json({ tradingFeeBps: FALLBACK_BPS, source: "env" });
}