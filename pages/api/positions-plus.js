// pages/api/positions-plus.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    const user = session?.user;

    if (!user?.email) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    // ✅ Gate PLUS (même logique que NavBar / PageShell / auth)
    const isPlus =
      user.isPlus === true ||
      user.isPlusActive === true ||
      user.plusStatus === "active" ||
      user.role === "PLUS" ||
      user.role === "ADMIN";

    if (!isPlus) {
      return res.status(403).json({ error: "PLUS_REQUIRED" });
    }

    const me = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!me) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const rows = await prisma.position.findMany({
      where: {
        userId: me.id,
        OR: [
          { symbol: { contains: "::LEV:" } },
          { symbol: { contains: "::OPT:" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      // IMPORTANT: id est inclus
      select: {
        id: true,
        symbol: true,
        name: true,
        quantity: true,
        avgPrice: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(rows);
  } catch (e) {
    console.error("[/api/positions-plus] fatal:", e);
    return res.status(500).json({ error: "LIST_PLUS_FAILED" });
  }
}