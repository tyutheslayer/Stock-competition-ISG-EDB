// pages/api/plus/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(200).json({ status: "none" });
    }

    // 1) Rôle ADMIN = considéré actif
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });
    if (!me) return res.status(200).json({ status: "none" });
    if (me.role === "ADMIN") return res.status(200).json({ status: "active" });

    // 2) Abonnement en base
    try {
      const sub = await prisma.plusSubscription.findUnique({
        where: { userId: me.id },
        select: { status: true },
      });
      const s = String(sub?.status || "none").toLowerCase();
      // normalise
      if (s === "active" || s === "trial" || s === "granted") {
        return res.status(200).json({ status: "active" });
      }
      if (s === "pending") return res.status(200).json({ status: "pending" });
      return res.status(200).json({ status: "none" });
    } catch {
      // si le modèle / table n'existe pas encore → fallback none
      return res.status(200).json({ status: "none" });
    }
  } catch (e) {
    console.error("[plus/status] fatal:", e);
    return res.status(200).json({ status: "none" });
  }
}