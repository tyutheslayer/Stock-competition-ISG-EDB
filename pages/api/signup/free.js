// pages/api/signup/free.js
import prisma from "../../../lib/prisma";
import nodemailer from "nodemailer";
import { miniCourseWelcomeEmail } from "../../../lib/emailTemplates";

function parseEmail(raw) {
  const e = String(raw || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

function getTransporterOrNull() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null; // pas de SMTP -> on skip l’envoi
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non supportée" });
  }

  const dry = String(req.query.dry || "0") === "1";

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { email, source = "hero" } = body;
    const parsed = parseEmail(email);
    if (!parsed) return res.status(400).json({ error: "Email invalide" });

    // 1) Enregistrer / mettre à jour l’inscription gratuite
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;
    const ua = req.headers["user-agent"] || null;

    const rec = await prisma.freeSignup.upsert({
      where: { email: parsed },
      update: { source, ip: String(ip || ""), userAgent: String(ua || "") },
      create: { email: parsed, source, ip: String(ip || ""), userAgent: String(ua || "") },
    });

    // 2) SMTP
    const transporter = getTransporterOrNull();
    const from = process.env.SMTP_FROM || "École de la Bourse <no-reply@edb.local>";

    if (dry) {
      // Mode test prod sans envoyer d’email
      return res.status(200).json({
        ok: true,
        dry: true,
        db: rec ? "upserted" : "unknown",
        smtpConfigured: !!transporter,
        note: "Aucun email envoyé (dry=1).",
      });
    }

    if (!transporter) {
      // Pas de SMTP → on considère l’inscription ok, mais mail non envoyé
      return res.status(200).json({
        ok: true,
        mail: false,
        reason: "SMTP non configuré (vérifie SMTP_HOST/PORT/SECURE/USER/PASS/FROM).",
      });
    }

    // 3) Envoi du mail
    const { subject, text, html } = miniCourseWelcomeEmail({ toEmail: parsed });
    try {
      const info = await transporter.sendMail({ from, to: parsed, subject, text, html });
      return res.status(200).json({ ok: true, mail: true, messageId: info?.messageId || null });
    } catch (smtpErr) {
      console.error("[signup/free] SMTP error:", smtpErr);
      return res.status(502).json({
        error: "SMTP_ERROR",
        detail: smtpErr?.message || String(smtpErr),
        hint:
          "Vérifie l’adresse d’expéditeur (SMTP_FROM) déclarée chez Brevo, les identifiants SMTP et que l’IP Vercel n’est pas bloquée.",
      });
    }
  } catch (e) {
    console.error("[signup/free] fatal:", e);
    return res.status(500).json({
      error: "INTERNAL",
      detail: e?.message || String(e),
    });
  }
}