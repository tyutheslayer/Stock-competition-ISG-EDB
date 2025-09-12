// lib/settings.js
import prisma from "./prisma";

const KV_IDENTIFIER = "SETTINGS:TRADING_FEE_BPS";

function hasSettingsModel() {
  return !!prisma?.settings;
}

async function kvGetTradingFeeBps() {
  try {
    const row = await prisma.verificationToken.findUnique({
      where: { token: KV_IDENTIFIER },
    });
    if (!row) return 0;
    const n = Number(row.identifier);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function getSettings() {
  // essaie le vrai modèle
  if (hasSettingsModel()) {
    try {
      const s = await prisma.settings.findUnique({ where: { id: 1 } });
      const tradingFeeBps = Number(s?.tradingFeeBps ?? 0);
      return { tradingFeeBps };
    } catch {
      // tombe en KV
    }
  }
  const tradingFeeBps = await kvGetTradingFeeBps();
  return { tradingFeeBps };
}