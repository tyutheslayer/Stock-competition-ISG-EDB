// pages/api/signup/free.js
import prisma from "../../../lib/prisma";
import nodemailer from "nodemailer";
import { miniCourseWelcomeEmail } from "../../../lib/emailTemplates";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP non configuré (vérifie SMTP_HOST/PORT/USER/PASS).");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function parseEmail(raw) {
  const e = String(raw || "").trim().toLowerCase();
  // validation simple
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Méthode non supportée" });

  try {
    const { email, source = "hero" } = await req.body || {};
    const parsed = parseEmail(email);
    if (!parsed) return res.status(400).json({ error: "Email invalide" });

    // 1) upsert en base (FreeSignup)
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;
    const ua = req.headers["user-agent"] || null;

    await prisma.freeSignup.upsert({
      where: { email: parsed },
      update: { source, ip: String(ip || ""), userAgent: String(ua || "") },
      create: { email: parsed, source, ip: String(ip || ""), userAgent: String(ua || "") },
    });

    // 2) envoi de l’email
    const from = process.env.SMTP_FROM || "École de la Bourse <no-reply@edb.local>";
    const { subject, text, html } = miniCourseWelcomeEmail({ toEmail: parsed });

    const transport = getTransporter();
    await transport.sendMail({
      from,
      to: parsed,
      subject,
      text,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[signup/free] fatal:", e);
    return res.status(500).json({ error: "Échec inscription" });
  }
}