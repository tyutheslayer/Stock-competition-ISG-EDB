import prisma from "../../lib/prisma";
import bcrypt from "bcryptjs";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "isg.fr").toLowerCase();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  // ✅ Vérification de domaine @isg.fr
  const domain = String(email).split("@")[1]?.toLowerCase() || "";
  if (domain !== ALLOWED_DOMAIN) {
    return res.status(400).json({ error: `Seules les adresses @${ALLOWED_DOMAIN} sont autorisées.` });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: "Email déjà utilisé." });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name: name || null, email, password: hash },
  });

  res.status(201).json({ ok: true });
}
