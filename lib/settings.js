import prisma from "./prisma";

/** Retourne l’unique ligne de Settings, la crée si absente. */
export async function getSettings() {
  try {
    const s = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, tradingFeeBps: 0 },
      select: { tradingFeeBps: true }
    });
    return s;
  } catch {
    // fallback si la table n'existe pas encore
    return { tradingFeeBps: 0 };
  }
}

/** Met à jour les bps (entier >= 0). */
export async function updateSettings(nextBps) {
  const bps = Math.max(0, Math.round(Number(nextBps) || 0));
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: { tradingFeeBps: bps },
    create: { id: 1, tradingFeeBps: bps },
    select: { tradingFeeBps: true }
  });
  return s;
}