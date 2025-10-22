// pages/api/admin/users.js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const users = await prisma.user.findMany({
    select: { email: true, role: true, cash: true, startingCash: true },
  });
  const result = users.map((u) => ({ ...u, equity: u.cash }));
  res.json(result);
}