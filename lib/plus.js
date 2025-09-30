// lib/plus.js
import prisma from "./prisma";

/**
 * Retourne { status: "active"|"pending"|"canceled"|"none", reason?: string }
 * Règle: les ADMIN sont toujours "active".
 */
export async function getPlusStatusByEmail(email) {
  if (!email) return { status: "none" };

  // 1) Si ADMIN => actif
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user) return { status: "none" };
  if (user.role === "ADMIN") return { status: "active", reason: "admin" };

  // 2) Sinon, regarder la souscription enregistrée
  const sub = await prisma.plusSubscription.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  const status = (sub?.status || "none").toLowerCase();
  if (!["active", "pending", "canceled"].includes(status)) return { status: "none" };
  return { status };
}