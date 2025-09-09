import prisma from "../../../../lib/prisma";
import { requireAdmin } from "../_guard";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== "POST") return res.status(405).end();

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email manquant" });

  // Bloquer la suppression d'un ADMIN
  const target = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (!target) return res.json({ ok: true }); // déjà supprimé
  if (target.role === "ADMIN") {
    return res.status(403).json({ error: "Impossible de supprimer un ADMIN." });
  }

  // Supprimer ordres & positions avant l'utilisateur
  await prisma.order.deleteMany({ where: { user: { email } } });
  await prisma.position.deleteMany({ where: { user: { email } } });
  await prisma.user.delete({ where: { email } }).catch(() => null);

  res.json({ ok: true });
}
