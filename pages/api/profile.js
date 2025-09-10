import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

const ALLOWED_PROMOS = ["BM1","BM2","BM3","M1","M2","Intervenant(e)","Bureau"];

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!me) return res.status(404).json({ error: "Utilisateur introuvable" });

  if (req.method !== "PATCH") return res.status(405).json({ error: "Méthode non supportée" });

  const { name, promo } = req.body || {};
  const data = {};

  if (typeof name === "string" && name.trim().length >= 2) {
    data.name = name.trim();
  }
  if (typeof promo === "string") {
    if (!ALLOWED_PROMOS.includes(promo)) {
      return res.status(400).json({ error: "Promo invalide" });
    }
    data.promo = promo;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Aucune modification" });
  }

  await prisma.user.update({ where: { id: me.id }, data });
  res.json({ ok: true });
}