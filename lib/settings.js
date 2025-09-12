// lib/settings.js
import prisma from "./prisma";


export async function getSettings() {
  // Une seule ligne (id=1). Si absente, on considère 0 bps.
  const row = await prisma.settings.findUnique({ where: { id: 1 } });
  return { tradingFeeBps: Number(row?.tradingFeeBps ?? 0) };
}