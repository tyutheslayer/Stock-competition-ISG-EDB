// pages/api/plus/insights/index.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const u = session?.user || {};
    const isPlus = u.isPlusActive === true || u.plusStatus === "active";
    const isAdmin = u.role === "ADMIN";

    if (!isPlus && !isAdmin) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const list = await prisma.weeklyInsight.findMany({
      orderBy: { weekOf: "desc" },
      take: 8,
    });

    return res.json(
      list.map((it) => ({
        id: it.id,
        weekOf: it.weekOf,
        title: it.title,
        summary: it.summary,
        focus: it.focus,
        macroJson: it.macroJson,
        marketsJson: it.marketsJson,
        sectorsJson: it.sectorsJson,
        createdAt: it.createdAt,
      }))
    );
  } catch (e) {
    console.error("[INSIGHT LIST ERROR]", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}