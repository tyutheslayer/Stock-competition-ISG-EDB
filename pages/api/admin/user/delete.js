// pages/api/admin/user/delete.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Méthode non supportée" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
    return res.status(403).json({ error: "Admin requis" });
  }

  const { userId, email } = req.body || {};
  if (!userId && !email) return res.status(400).json({ error: "userId ou email requis" });

  const target = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findUnique({ where: { email } });

  if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });

  const isTargetAdmin = target.role === "ADMIN";
  if (isTargetAdmin) {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return res
        .status(400)
        .json({ error: "Protection: impossible de supprimer le dernier ADMIN" });
    }
  }

  await prisma.user.delete({ where: userId ? { id: userId } : { email } });
  return res.json({ ok: true });
}