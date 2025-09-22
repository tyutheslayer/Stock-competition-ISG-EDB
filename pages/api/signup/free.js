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
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non supportée" });
  }

  const dry = String(req.query.dry || "0") === "1";

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const parsed = parseEmail(body.email);
    if (!parsed) return res.status(400).json({ error: "Email invalide" });

    // --- Important: ne pas toucher aux colonnes manquantes (source/ip/userAgent) ---
    const rec = await prisma.freeSignup.upsert({
      where: { email: parsed },
      update: {},            // rien (évite d’écrire des colonnes inexistantes)
      create: { email: parsed },
    });

    const transporter = getTransporterOrNull();
    const from = process.env.SMTP_FROM || "École de la Bourse <no-reply@edb.local>";

    if (dry) {
      return res.status(200).json({
        ok: true,
        dry: true,
        db: rec ? "upserted" : "unknown",
        smtpConfigured: !!transporter,
        note: "Aucun email envoyé (dry=1).",
      });
    }

    if (!transporter) {
      return res.status(200).json({
        ok: true,
        mail: false,
        reason: "SMTP non configuré (host/user/pass).",
      });
    }

    const { subject, text, html } = miniCourseWelcomeEmail({ toEmail: parsed });
    try {
      const info = await transporter.sendMail({ from, to: parsed, subject, text, html });
      return res.status(200).json({ ok: true, mail: true, messageId: info?.messageId || null });
    } catch (smtpErr) {
      console.error("[signup/free] SMTP error:", smtpErr);
      return res.status(502).json({
        error: "SMTP_ERROR",
        detail: smtpErr?.message || String(smtpErr),
      });
    }
  } catch (e) {
    console.error("[signup/free] fatal:", e);
    return res.status(500).json({ error: "INTERNAL", detail: e?.message || String(e) });
  }
}