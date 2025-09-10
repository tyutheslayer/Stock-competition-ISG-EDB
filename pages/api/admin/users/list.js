import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "../../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end("Non authentifié");

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, isAdmin: true, role: true },
  });
  if (!me || (!me.isAdmin && me.role !== "ADMIN")) {
    return res.status(403).end("Admin requis");
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, isAdmin: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
}
