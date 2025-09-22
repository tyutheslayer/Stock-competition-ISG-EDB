// lib/mailer.js
import nodemailer from "nodemailer";

let _transporter;

/**
 * Crée (lazy) un transporter SMTP depuis les variables d'env.
 * Requiert: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
export function getTransporter() {
  if (_transporter) return _transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE, // "true" pour SMTPS/465, sinon TLS opportuniste sur 587
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "[mailer] SMTP non configuré. Défini SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS."
    );
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE || "").toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return _transporter;
}

/**
 * Envoi générique
 */
export async function sendMail({ to, subject, text, html, from }) {
  const transporter = getTransporter();
  const mailFrom = from || process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html,
  });

  // Optionnel: logger l'ID du message
  if (process.env.NODE_ENV !== "production") {
    console.log("[mailer] sent:", info.messageId);
  }
  return info;
}

/**
 * Gabarit: email de bienvenue mini-cours
 */
export function renderWelcomeEmail({ appUrl }) {
  const url = appUrl || process.env.APP_URL || "https://example.com";
  const calendarUrl = `${url}/calendar`;

  const subject = "Bienvenue — Mini-cours du jeudi (13h–13h30, heure de Paris)";
  const text = [
    "Bienvenue à l’École de la Bourse !",
    "",
    "Tu es inscrit au mini-cours gratuit du jeudi, 13h–13h30 (heure de Paris).",
    "Nous t’enverrons un rappel le jeudi à 12h55.",
    "",
    `Calendrier des sessions: ${calendarUrl}`,
    "",
    "À bientôt,",
    "L’équipe EDB",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111">
      <h2>Bienvenue à l’<em>École de la Bourse</em> !</h2>
      <p>Tu es inscrit au <b>mini-cours gratuit du jeudi</b>, <b>13h–13h30 (heure de Paris)</b>.<br/>
      Nous t’enverrons un rappel le jeudi à <b>12h55</b>.</p>
      <p>
        <a href="${calendarUrl}" style="background:#4f46e5;color:white;text-decoration:none;padding:10px 14px;border-radius:8px;display:inline-block">
          Voir le calendrier
        </a>
      </p>
      <p style="font-size:12px;color:#666">Astuce: ajoute l’adresse d’envoi à tes contacts pour éviter le spam.</p>
      <p>À bientôt,<br/>L’équipe EDB</p>
    </div>
  `;

  return { subject, text, html };
}