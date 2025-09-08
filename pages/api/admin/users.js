import prisma from "../../../lib/prisma";
import { requireAdmin } from "./_guard";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const users = await prisma.user.findMany({
    select: { email: true, role: true, cash: true, startingCash: true }
  });
  const result = users.map(u => ({ ...u, equity: u.cash }));
  res.json(result);
}
