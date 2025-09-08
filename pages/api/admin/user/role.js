import prisma from "../../../../lib/prisma";
import { requireAdmin } from "../_guard";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== "POST") return res.status(405).end();

  const { email, role } = req.body || {};
  if (!email || !["USER", "ADMIN"].includes(role)) {
    return res.status(400).json({ error: "Paramètres invalides" });
  }

  await prisma.user.update({ where: { email }, data: { role } }).catch(() => null);
  res.json({ ok: true });
}
