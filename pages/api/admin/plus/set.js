// pages/api/admin/plus/set.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "../../../../lib/prisma";
import { setPlusStatusByEmail } from "../../../../lib/plus";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    if (me?.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    const { email, status } = req.body || {};
    if (!email || !status) return res.status(400).json({ error: "Missing email/status" });

    const out = await setPlusStatusByEmail(email, status);
    return res.json({ ok: true, ...out });
  } catch (e) {
    console.error("[admin/plus/set] fatal:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
}