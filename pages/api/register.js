import prisma from "../../lib/prisma";
import bcrypt from "bcryptjs";

// Domaine autorisé
const ALLOWED_DOMAINS = ["isg.fr", "isg-luxury.fr", "esme.fr"];

/**
 * Retourne le prochain jeudi 12h (heure de Paris)
 */
function nextThursdayNoonParis() {
  const now = new Date();
  // On force le fuseau Europe/Paris
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const day = tzNow.getDay(); // 0=dim, 4=jeudi
  const add = (4 - day + 7) % 7;
  const target = new Date(tzNow);
  target.setDate(tzNow.getDate() + (add === 0 && tzNow.getHours() < 12 ? 0 : add));
  target.setHours(12, 0, 0, 0);
  if (add === 0 && tzNow >= target) target.setDate(target.getDate() + 7);
  return target;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // 🕒 Vérification du verrou temporel
  const nowParis = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const openAt = nextThursdayNoonParis();
  if (nowParis < openAt) {
    const msg = `Les inscriptions ouvriront le ${openAt.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    })}`;
    return res.status(403).json({ error: msg });
  }

  const { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  // ✅ Vérification de domaine @isg.fr
  const domain = String(email).split("@")[1]?.toLowerCase() || "";
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return res
      .status(400)
      .json({ error: `Seules les adresses ${ALLOWED_DOMAINS.map(d => '@' + d).join(', ')} sont autorisées.` });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: "Email déjà utilisé." });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name: name || null, email, password: hash },
  });

  res.status(201).json({ ok: true });
}