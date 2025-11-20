// pages/api/plus/daily/today.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

function startOfDayUTC(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

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

    const today = new Date();
    const day = startOfDayUTC(today);

    const daily = await prisma.dailyInsight.findUnique({
      where: { day },
    });

    if (!daily) {
      return res.status(404).json({ error: "NO_DAILY_FOR_TODAY" });
    }

    return res.json(daily);
  } catch (e) {
    console.error("[DAILY TODAY ERROR]", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}