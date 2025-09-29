// pages/api/auth/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getSettings, updateSettings } from "../../../lib/settings";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).send("Non authentifié");

  // check admin
  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (me?.role !== "ADMIN") return res.status(403).send("Interdit");

  try {
    if (req.method === "GET") {
      const s = await getSettings();
      return res.json(s);
    }

    if (req.method === "POST") {
      const { tradingFeeBps } = req.body || {};
      const s = await updateSettings({ tradingFeeBps });
      return res.json(s);
    }

    return res.status(405).end();
  } catch (e) {
    console.error("[api/auth/settings] fatal:", e);
    return res.status(500).json({ error: "Erreur interne" });
  }
}