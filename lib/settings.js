// lib/settings.js
import prisma from "./prisma";

const KV_IDENTIFIER = "SETTINGS:TRADING_FEE_BPS";

/** Détecte si le client Prisma a bien le modèle Settings généré. */
function hasSettingsModel() {
  return !!prisma?.settings;
}

/* ---------- Fallback KV via VerificationToken ---------- */
async function kvGetTradingFeeBps() {
  try {
    const row = await prisma.verificationToken.findUnique({
      where: { token: KV_IDENTIFIER },
      select: { identifier: true },
    });
    if (!row) return 0;
    const n = Number(row.identifier);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function kvSetTradingFeeBps(bps) {
  const value = String(Math.max(0, Number(bps) || 0));
  // On stocke dans VerificationToken: token = KV_IDENTIFIER, identifier = valeur
  // expires: mettons loin dans le futur (optionnel)
  const farFuture = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000);
  await prisma.verificationToken.upsert({
    where: { token: KV_IDENTIFIER },
    update: { identifier: value, expires: farFuture },
    create: { token: KV_IDENTIFIER, identifier: value, expires: farFuture },
  });
  return Number(value);
}

/* ---------- API publique ---------- */

/** Lecture des settings globaux (frais en basis points). */
export async function getSettings() {
  // 1) Modèle Prisma natif si dispo
  if (hasSettingsModel()) {
    try {
      const row = await prisma.settings.findUnique({
        where: { id: 1 },
        select: { tradingFeeBps: true },
      });
      return { tradingFeeBps: Number(row?.tradingFeeBps ?? 0) };
    } catch {
      // si la table n'existe pas encore → fallback KV
    }
  }
  // 2) Fallback KV
  const tradingFeeBps = await kvGetTradingFeeBps();
  return { tradingFeeBps };
}

/**
 * Mise à jour des settings (actuellement: tradingFeeBps).
 * @param {{ tradingFeeBps?: number|string }} patch
 * @returns {{ tradingFeeBps: number }}
 */
export async function updateSettings(patch = {}) {
  const hasBps = patch.tradingFeeBps !== undefined && patch.tradingFeeBps !== null;
  const bps = hasBps ? Math.max(0, Number(patch.tradingFeeBps) || 0) : undefined;

  // 1) Modèle Prisma natif si dispo
  if (hasSettingsModel()) {
    try {
      const row = await prisma.settings.upsert({
        where: { id: 1 },
        update: hasBps ? { tradingFeeBps: bps } : {},
        create: { id: 1, tradingFeeBps: hasBps ? bps : 0 },
        select: { tradingFeeBps: true },
      });
      return { tradingFeeBps: Number(row?.tradingFeeBps ?? 0) };
    } catch {
      // si la table n'existe pas → fallback KV
    }
  }

  // 2) Fallback KV
  if (hasBps) {
    const v = await kvSetTradingFeeBps(bps);
    return { tradingFeeBps: v };
  }
  // si pas de champ fourni, on renvoie la valeur actuelle
  const current = await kvGetTradingFeeBps();
  return { tradingFeeBps: current };
}