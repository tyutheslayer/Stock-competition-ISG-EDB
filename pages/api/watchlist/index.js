import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true }
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (req.method === "GET") {
    const items = await prisma.watchlistItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    return res.json(items);
  }

  if (req.method === "POST") {
    const { symbol, name } = req.body || {};
    if (!symbol) return res.status(400).json({ error: "symbol manquant" });
    await prisma.watchlistItem.upsert({
      where: { userId_symbol: { userId: user.id, symbol } },
      update: { name },
      create: { userId: user.id, symbol, name }
    });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { symbol } = req.body || {};
    if (!symbol) return res.status(400).json({ error: "symbol manquant" });
    await prisma.watchlistItem.delete({ where: { userId_symbol: { userId: user.id, symbol } } }).catch(()=>{});
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
