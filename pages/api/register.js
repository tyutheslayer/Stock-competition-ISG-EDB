import prisma from "../../lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).send("Email et mot de passe requis.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).send("Email déjà utilisé.");
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, password: hash }
  });
  res.status(201).json({ ok: true });
}
