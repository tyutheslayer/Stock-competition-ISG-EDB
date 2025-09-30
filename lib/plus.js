// lib/plus.js
import prisma from "./prisma";

/**
 * Flags temporaires (raison: tester le Plus sans paiement)
 * - EDB_FORCE_PLUS=1  -> tout le monde est "active"
 * - EDB_PLUS_WHITELIST="mail1@mail.com,mail2@mail.com"
 */
function isForcePlus(email) {
  if (String(process.env.EDB_FORCE_PLUS || "0") === "1") return true;
  const wl = String(process.env.EDB_PLUS_WHITELIST || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  return email && wl.includes(String(email).toLowerCase());
}

/** Retourne { status: "active"|"pending"|"canceled"|"none", reason? } */
export async function getPlusStatusByEmail(email) {
  if (!email) return { status: "none" };
  if (isForcePlus(email)) return { status: "active", reason: "force" };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user) return { status: "none" };

  // Les admins ont toujours l’accès Plus
  if (user.role === "ADMIN") return { status: "active", reason: "admin" };

  const sub = await prisma.plusSubscription.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  const st = String(sub?.status || "none").toLowerCase();
  if (!["active","pending","canceled"].includes(st)) return { status: "none" };
  return { status: st };
}

/** Donne le Plus "active" sans paiement (temporaire). */
export async function grantPlusByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  await prisma.plusSubscription.upsert({
    where: { userId: user.id },
    update: { status: "active" },
    create: { userId: user.id, status: "active" },
  });
  return { ok: true };
}