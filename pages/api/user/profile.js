import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

const DAYS_15_MS = 15 * 24 * 60 * 60 * 1000;

function canonicalizeName(raw) {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // enlève accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");        // supprime espaces/ponctuation
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const email = session.user.email;

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true, image: true, lastNameChangeAt: true, role: true }
    });
    return res.json(user ?? {});
  }

  if (req.method === "POST") {
    const { name } = req.body || {};
    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Nom invalide (≥ 2 caractères)" });
    }

    // Récupère rôle & dernière modif
    const current = await prisma.user.findUnique({
      where: { email },
      select: { lastNameChangeAt: true, role: true }
    });
    const isAdmin = current?.role === "ADMIN";

    // ⚠️ Restriction ZEUS pour non-admins
    const canonical = canonicalizeName(name);
    if (!isAdmin && canonical === "zeus") {
      return res.status(403).json({ error: "Ce nom est réservé aux administrateurs." });
    }

    // Cooldown 15j pour non-admins
    const now = Date.now();
    if (!isAdmin && current?.lastNameChangeAt) {
      const elapsed = now - new Date(current.lastNameChangeAt).getTime();
      const remainingMs = DAYS_15_MS - elapsed;
      if (remainingMs > 0) {
        const remainingDays = Math.ceil(remainingMs / (24*60*60*1000));
        return res.status(429).json({
          error: "Changement de nom trop fréquent",
          remainingDays
        });
      }
    }

    const user = await prisma.user.update({
      where: { email },
      data: { name: name.trim(), lastNameChangeAt: new Date(now) },
      select: { email: true, name: true, image: true, lastNameChangeAt: true, role: true }
    });
    return res.json(user);
  }

  return res.status(405).end();
}
