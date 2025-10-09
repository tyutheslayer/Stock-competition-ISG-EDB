// /pages/api/register.js
import prisma from "../../lib/prisma";
import bcrypt from "bcryptjs";

// ✅ plusieurs domaines autorisés
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "isg.fr,isg-luxury.fr,esme.fr")
  .split(",")
  .map(d => d.trim().toLowerCase())
  .filter(Boolean);

// ⚙️ Gate (server-side) – désactivé par défaut
const GATE_ENABLED = String(process.env.GATE_REGISTRATION || "").toLowerCase() === "1";
// Exemple d’horodatage: "2025-10-09T12:00:00+02:00" (heure de Paris)
// Si non défini → pas de blocage
const OPEN_AT_ISO = process.env.REGISTRATION_OPEN_AT || "";

/** Heure “maintenant” en Europe/Paris (robuste à la TZ du serveur) */
function nowParis() {
  const now = new Date();
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = paris.getTime() - utc.getTime();
  return new Date(now.getTime() + offset);
}

function parseParisIso(s) {
  // si on te fournit "2025-10-09T12:00:00+02:00" → new Date(s) suffit
  // si on te fournit "2025-10-09 12:00:00" (sans TZ), on l’interprète en Europe/Paris
  if (!s) return null;
  const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(s) || /T\d{2}:\d{2}:\d{2}/.test(s);
  if (hasTZ) return new Date(s);
  // Interprétation “locale Paris”
  const pNow = nowParis();
  const [date, time = "00:00:00"] = s.split(/[ T]/);
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m, sec] = time.split(":").map(Number);
  const d = new Date(pNow);
  d.setFullYear(Y, (M || 1) - 1, D || 1);
  d.setHours(h || 0, m || 0, sec || 0, 0);
  return d;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // 🔒 Gate côté serveur si activé et horodatage fourni
  if (GATE_ENABLED && OPEN_AT_ISO) {
    const openAt = parseParisIso(OPEN_AT_ISO);
    const now = nowParis();
    if (openAt instanceof Date && !isNaN(openAt) && now < openAt) {
      // message clair + format FR
      return res.status(400).json({
        error: `Les inscriptions ouvriront le ${openAt.toLocaleString("fr-FR")}`,
      });
    }
  }

  const { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  // ✅ Domaines autorisés
  const domain = String(email).split("@")[1]?.toLowerCase() || "";
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return res.status(400).json({
      error: `Seules les adresses ${ALLOWED_DOMAINS.map(d => "@" + d).join(", ")} sont autorisées.`,
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: "Email déjà utilisé." });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name: name || null, email, password: hash },
  });

  res.status(201).json({ ok: true });
}