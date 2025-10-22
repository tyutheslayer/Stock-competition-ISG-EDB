// pages/api/admin/user/role.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "POST") return res.status(405).end();

  const { email, role } = req.body || {};
  if (!email || !["USER", "ADMIN"].includes(role)) {
    return res.status(400).json({ error: "Paramètres invalides" });
  }

  await prisma.user.update({ where: { email }, data: { role } }).catch(() => null);
  res.json({ ok: true });
}