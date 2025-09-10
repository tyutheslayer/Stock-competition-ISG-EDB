import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "../../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non supportée" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!me?.isAdmin && me?.role !== "ADMIN") return res.status(403).json({ error: "Admin requis" });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId requis" });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });

  // si la cible est admin : vérifier qu'il en reste au moins 1 après suppression
  const isTargetAdmin = target.isAdmin || target.role === "ADMIN";
  if (isTargetAdmin) {
    const admins = await prisma.user.count({
      where: { OR: [{ isAdmin: true }, { role: "ADMIN" }] }
    });
    if (admins <= 1) {
      return res.status(400).json({ error: "Protection: impossible de supprimer le dernier ADMIN" });
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  return res.json({ ok: true });
}
