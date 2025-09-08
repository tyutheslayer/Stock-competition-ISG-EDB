import prisma from "../../../lib/prisma";
import { requireAdmin } from "./_guard";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== "POST") return res.status(405).end();

  const startingCash = Number(req.body?.startingCash ?? 100000);
  if (!Number.isFinite(startingCash) || startingCash <= 0) {
    return res.status(400).json({ error: "startingCash invalide" });
  }

  await prisma.order.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.user.updateMany({ data: { cash: startingCash, startingCash } });

  res.json({ ok: true, startingCash });
}
