import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });
  const email = session.user.email;

  const positions = await prisma.position.findMany({
    where: { user: { email } },
    select: { symbol: true, name: true, quantity: true, avgPrice: true }
  });

  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? \`"\${s.replace(/"/g, '""')}"\` : s;
  };

  const header = ["symbol","name","quantity","avg_price"];
  const lines = [header.join(",")];
  for (const p of positions) {
    lines.push([p.symbol, esc(p.name), p.quantity, p.avgPrice.toFixed(4)].join(","));
  }
  const csv = lines.join("\n");
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition","attachment; filename=portfolio.csv");
  res.send(csv);
}
