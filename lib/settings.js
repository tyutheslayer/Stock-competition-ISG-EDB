// lib/settings.js
import prisma from "./prisma";

const KV_IDENTIFIER = "SETTINGS:TRADING_FEE_BPS";

/** Vrai modèle Prisma présent ? */
function hasSettingsModel() {
  return Boolean(prisma?.settings);
}

/** Fallback “KV” via VerificationToken, pour compat legacy */
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

async function kvSetTradingFeeBps(valueBps) {
  const val = String(Math.max(0, Number(valueBps) || 0));
  await prisma.verificationToken.upsert({
    where: { token: KV_IDENTIFIER },
    update: { identifier: val, expires: new Date(Date.now() + 365 * 86400e3) },
    create: {
      identifier: val,
      token: KV_IDENTIFIER,
      expires: new Date(Date.now() + 365 * 86400e3),
    },
  });
}

/** Lecture centralisée */
export async function getSettings() {
  // 1) Essaie la vraie table Settings (mappée sur AppSettings chez toi)
  if (hasSettingsModel()) {
    try {
      const s = await prisma.settings.findUnique({ where: { id: 1 } });
      const tradingFeeBps = Number(s?.tradingFeeBps ?? 0);
      return { tradingFeeBps };
    } catch {
      // tombe sur KV
    }
  }
  // 2) Fallback KV
  const tradingFeeBps = await kvGetTradingFeeBps();
  return { tradingFeeBps };
}

/** Mise à jour (utilisé par /api/auth/settings.js) */
export async function updateSettings({ tradingFeeBps }) {
  const bps = Math.max(0, Number(tradingFeeBps) || 0);

  if (hasSettingsModel()) {
    try {
      const row = await prisma.settings.upsert({
        where: { id: 1 },
        update: { tradingFeeBps: bps },
        create: { id: 1, tradingFeeBps: bps },
      });
      return { tradingFeeBps: Number(row.tradingFeeBps || 0) };
    } catch {
      // si la table n’existe pas en prod, retombe KV
    }
  }

  await kvSetTradingFeeBps(bps);
  return { tradingFeeBps: bps };
}