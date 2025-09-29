// lib/plus.js
import prisma from "./prisma";

/** Retourne (ou crée) l'abonnement pour un userId donné */
export async function ensurePlusSub(userId) {
  let sub = await prisma.plusSubscription.findUnique({ where: { userId } });
  if (!sub) {
    sub = await prisma.plusSubscription.create({
      data: { userId, status: "none" },
    });
  }
  return sub;
}

/** Renvoie { status: 'active'|'pending'|'canceled'|'none', since: Date|null } */
export async function getPlusStatusByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { status: "none", since: null };

  const sub = await prisma.plusSubscription.findUnique({ where: { userId: user.id } });
  if (!sub) return { status: "none", since: null };

  return { status: sub.status || "none", since: sub.createdAt ?? null };
}

export async function setPlusStatusByEmail(email, nextStatus = "active") {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found");

  const sub = await ensurePlusSub(user.id);
  const updated = await prisma.plusSubscription.update({
    where: { userId: user.id },
    data: { status: nextStatus },
  });
  return { status: updated.status, since: updated.createdAt ?? null };
}

export function isPlus(status) {
  return String(status).toLowerCase() === "active";
}