// pages/api/signup/free.js
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

/** Valide un email très simplement */
function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Créé la table FreeSignup si elle n’existe pas (fallback sans changer le schema Prisma) */
async function ensureFreeSignupTable() {
  // Crée une table simple via SQL brut pour éviter de te faire changer le schema maintenant.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FreeSignup" (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/** Insère en SQL brut (fallback) */
async function insertRawFreeSignup(email) {
  // petit générateur d’ID
  const id = "fs_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FreeSignup"(id, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
    id,
    email
  );
}

/** Essaie d’utiliser le modèle Prisma s’il existe, sinon fallback SQL brut */
async function saveSignup(email) {
  // 1) Tentative via Prisma (si tu as un modèle `model FreeSignup` dans ton schema.prisma)
  try {
    // @ts-ignore - si le modèle n'existe pas, ça throw
    return await prisma.freeSignup.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  } catch {
    // 2) Fallback SQL brut sans schéma
    await ensureFreeSignupTable();
    await insertRawFreeSignup(email);
    return { email };
  }
}

/** Transport mail — optionnel (utilise SMTP_* si dispo) */
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) return null;
  const port = parseInt(String(SMTP_PORT), 10) || 587;
  return {
    transporter: nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    }),
    from: SMTP_FROM,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non supportée" });

  try {
    const { email } = req.body || {};
    const clean = (email || "").trim().toLowerCase();
    if (!isEmail(clean)) return res.status(400).json({ error: "Email invalide" });

    // Enregistre (dédupliqué sur l'email)
    await saveSignup(clean);

    // Envoi d’un mail de bienvenue (si SMTP configuré)
    const mailer = getTransport();
    if (mailer) {
      const { transporter, from } = mailer;
      try {
        await transporter.sendMail({
          from,
          to: clean,
          subject: "Bienvenue — Mini-cours École de la Bourse (jeudi 13h)",
          text:
            "Bienvenue ! Tu recevras un rappel avant chaque mini-cours (jeudi 13h-13h30).\n" +
            "À très vite !",
          html:
            "<p>Bienvenue ! 👋</p>" +
            "<p>Tu recevras un rappel avant chaque <strong>mini-cours (jeudi 13h-13h30)</strong>.</p>" +
            "<p>À très vite !</p>",
        });
      } catch (e) {
        // On ne bloque pas l’inscription si l’email échoue
        console.warn("[signup/free] Mail non envoyé:", e?.message || e);
      }
    } else {
      console.log("[signup/free] SMTP non configuré — inscription enregistrée sans email.");
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[signup/free] fatal:", e);
    return res.status(500).json({ error: "Échec inscription" });
  }
}