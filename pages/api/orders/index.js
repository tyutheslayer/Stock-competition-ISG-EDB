import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });
  const email = session.user.email;

  const orders = await prisma.order.findMany({
    where: { user: { email } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json(orders);
}
