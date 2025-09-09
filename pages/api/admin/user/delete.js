import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user?.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email manquant" });

  const target = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (!target) return res.json({ ok: true });
  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return res.status(403).json({ error: "Impossible de supprimer le dernier ADMIN." });
  }

  await prisma.order.deleteMany({ where: { user: { email } } });
  await prisma.position.deleteMany({ where: { user: { email } } });
  await prisma.user.delete({ where: { email } }).catch(() => null);
  res.json({ ok: true });
}
