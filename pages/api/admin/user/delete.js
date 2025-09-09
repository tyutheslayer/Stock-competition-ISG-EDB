import prisma from "../../../../lib/prisma";
import { requireAdmin } from "../_guard";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== "POST") return res.status(405).end();

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email manquant" });

  // Supprime d'abord ordres & positions (contraintes relationnelles)
  await prisma.order.deleteMany({ where: { user: { email } } });
  await prisma.position.deleteMany({ where: { user: { email } } });
  await prisma.user.delete({ where: { email } }).catch(() => null);

  res.json({ ok: true });
}
