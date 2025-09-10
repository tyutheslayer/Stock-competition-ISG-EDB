// pages/api/user/profile.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

const ALLOWED_PROMOS = ["BM1","BM2","BM3","M1","M2","Intervenant(e)","Bureau"];
const NAME_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000; // 15 jours

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true, email: true, name: true, role: true, isAdmin: true,
      promo: true, lastNameChangeAt: true
    }
  });
  if (!me) return res.status(404).json({ error: "Utilisateur introuvable" });

  if (req.method === "GET") {
    return res.json({
      email: me.email,
      name: me.name,
      role: me.role || (me.isAdmin ? "ADMIN" : "USER"),
      promo: me.promo || "",
      lastNameChangeAt: me.lastNameChangeAt
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non supportée" });
  }

  const { name, promo } = req.body || {};
  const data = {};
  let changingName = false;

  // — Maj du nom (avec cooldown si pas admin) —
  if (typeof name === "string" && name.trim() && name.trim() !== me.name) {
    const isAdmin = !!(me.isAdmin || me.role === "ADMIN");
    if (!isAdmin) {
      const last = me.lastNameChangeAt ? new Date(me.lastNameChangeAt).getTime() : 0;
      const now = Date.now();
      const since = now - last;
      if (since < NAME_COOLDOWN_MS && last !== 0) {
        const remainingDays = Math.ceil((NAME_COOLDOWN_MS - since) / (24*60*60*1000));
        return res.status(429).json({ error: "Trop tôt", remainingDays });
      }
    }
    data.name = name.trim();
    data.lastNameChangeAt = new Date();
    changingName = true;
  }

  // — Maj de la promo (SANS cooldown, mais avec liste blanche) —
  if (typeof promo === "string") {
    if (promo !== "" && !ALLOWED_PROMOS.includes(promo)) {
      return res.status(400).json({ error: "Promo invalide" });
    }
    data.promo = promo || null; // vide => null
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Aucune modification" });
  }

  const updated = await prisma.user.update({
    where: { id: me.id },
    data,
    select: {
      email: true, name: true, role: true, isAdmin: true,
      promo: true, lastNameChangeAt: true
    }
  });

  return res.json({
    email: updated.email,
    name: updated.name,
    role: updated.role || (updated.isAdmin ? "ADMIN" : "USER"),
    promo: updated.promo || "",
    lastNameChangeAt: updated.lastNameChangeAt
  });
}