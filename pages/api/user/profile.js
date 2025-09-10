// pages/api/user/profile.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

const ALLOWED_PROMOS = ["BM1","BM2","BM3","M1","M2","Intervenant(e)","Bureau"];
const NAME_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;

function normalizeUser(u) {
  const isAdmin = u.role === "ADMIN"; // 👈 déduit du rôle
  return {
    email: u.email,
    name: u.name,
    role: u.role || (isAdmin ? "ADMIN" : "USER"),
    isAdmin,                           // 👈 renvoyé pour le client mais non stocké
    promo: u.promo || "",
    lastNameChangeAt: u.lastNameChangeAt || null,
  };
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,          // ✅ ok
        promo: true,         // ✅ ok
        lastNameChangeAt: true
      }
    });
    if (!me) return res.status(404).json({ error: "Utilisateur introuvable" });

    if (req.method === "GET") {
      return res.json(normalizeUser(me));
    }

    if (!["POST", "PATCH"].includes(req.method)) {
      return res.status(405).json({ error: "Méthode non supportée" });
    }

    const { name, promo } = req.body || {};
    const data = {};
    const isAdmin = me.role === "ADMIN"; // 👈 déduit

    // Nom (cooldown si pas admin)
    if (typeof name === "string" && name.trim() && name.trim() !== me.name) {
      if (!isAdmin) {
        const last = me.lastNameChangeAt ? new Date(me.lastNameChangeAt).getTime() : 0;
        const since = Date.now() - last;
        if (since < NAME_COOLDOWN_MS && last !== 0) {
          const remainingDays = Math.ceil((NAME_COOLDOWN_MS - since) / (24*60*60*1000));
          return res.status(429).json({ error: "Trop tôt", remainingDays });
        }
      }
      data.name = name.trim();
      data.lastNameChangeAt = new Date();
    }

    // Promo (liste blanche, pas de cooldown)
    if (typeof promo === "string") {
      if (promo !== "" && !ALLOWED_PROMOS.includes(promo)) {
        return res.status(400).json({ error: "Promo invalide", allowed: ALLOWED_PROMOS });
      }
      data.promo = promo || null; // vide => null
    }

    // Rien à modifier → renvoyer l’état actuel
    if (Object.keys(data).length === 0) {
      return res.json(normalizeUser(me));
    }

    const updated = await prisma.user.update({
      where: { id: me.id },
      data,
      select: {
        email: true,
        name: true,
        role: true,
        promo: true,
        lastNameChangeAt: true
      }
    });

    return res.json(normalizeUser(updated));
  } catch (e) {
    console.error("[api/user/profile] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur de modification" });
  }
}