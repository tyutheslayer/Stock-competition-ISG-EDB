// lib/settings.js
import prisma from "./prisma";

// Lecture tolérante : soit via le vrai modèle Settings (map → AppSettings),
// soit via un "KV hack" stocké dans VerificationToken si le modèle n'existe pas.
function hasSettingsModel() {
  // Prisma expose toujours prisma.settings si le modèle existe dans le schema
  return Boolean(prisma?.settings);
}

// Fallback "KV hack" : on garde un nombre dans VerificationToken
const KV_TOKEN = "SETTINGS:TRADING_FEE_BPS";
async function kvGetTradingFeeBps() {
  try {
    const row = await prisma.verificationToken.findUnique({
      where: { token: KV_TOKEN },
      select: { identifier: true },
    });
    if (!row?.identifier) return 0;
    const n = Number(row.identifier);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function getSettings() {
  // 1) essaie via Settings (AppSettings)
  if (hasSettingsModel()) {
    try {
      // id=1 unique
      const s = await prisma.settings.findUnique({
        where: { id: 1 },
        select: { tradingFeeBps: true },
      });
      return { tradingFeeBps: Number(s?.tradingFeeBps ?? 0) };
    } catch {
      // tombe en KV
    }
  }
  // 2) fallback KV
  const tradingFeeBps = await kvGetTradingFeeBps();
  return { tradingFeeBps };
}