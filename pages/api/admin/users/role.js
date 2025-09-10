import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "../../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end("Non authentifié");

  // Autorisation : isAdmin === true OU role === 'ADMIN'
  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, isAdmin: true, role: true },
  });
  if (!me || (!me.isAdmin && me.role !== "ADMIN")) {
    return res.status(403).end("Admin requis");
  }

  const { userId, makeAdmin } = req.body || {};
  if (!userId || typeof makeAdmin !== "boolean") {
    return res.status(400).end("Paramètres invalides");
  }

  // Protection: ne pas rétrograder le dernier ADMIN (isAdmin=true OU role='ADMIN')
  if (makeAdmin === false) {
    const adminCount = await prisma.user.count({
      where: { OR: [{ isAdmin: true }, { role: "ADMIN" }] },
    });
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, role: true },
    });
    const targetIsAdmin = !!target?.isAdmin || target?.role === "ADMIN";
    if (targetIsAdmin && adminCount <= 1) {
      return res.status(400).json({ error: "Impossible de rétrograder le dernier ADMIN" });
    }
  }

  // On aligne les deux flags : isAdmin (bool) ET role ('ADMIN' | 'USER')
  await prisma.user.update({
    where: { id: userId },
    data: {
      isAdmin: makeAdmin,
      role: makeAdmin ? "ADMIN" : "USER",
    },
  });

  return res.json({ ok: true });
}
