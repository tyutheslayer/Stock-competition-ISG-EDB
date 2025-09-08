import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  res.json({ user: { email: user.email, cash: user.cash, startingCash: user.startingCash } });
}
