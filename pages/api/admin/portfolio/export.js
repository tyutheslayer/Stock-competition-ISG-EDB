// pages/api/admin/portfolio/export.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../../lib/prisma";                  
import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Méthode non supportée");

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).send("Non authentifié");

  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  const isAdmin = me?.isAdmin || me?.role === "ADMIN";
  if (!isAdmin) return res.status(403).send("Admin requis");

  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).send("userId requis");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, cash: true }
  });
  if (!user) return res.status(404).send("Utilisateur introuvable");

  const positions = await prisma.position.findMany({
    where: { userId },
    select: { symbol: true, name: true, quantity: true, avgPrice: true }
  });

  const symbols = [...new Set(positions.map(p => p.symbol))];
  const prices = {};
  for (const s of symbols) {
    try {
      const q = await yahooFinance.quote(s);
      prices[s] = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? null;
    } catch {
      prices[s] = null;
    }
  }

  const header = [
    "UserName","UserEmail","Cash",
    "Symbol","Name","Quantity","AvgPrice","LastPrice","MarketValue","UnrealizedPnL","UnrealizedPnLPct"
  ];
  const lines = [header.join(",")];

  let totalMV = 0, totalPnL = 0;

  for (const p of positions) {
    const qty = Number(p.quantity);
    const avg = Number(p.avgPrice);
    const last = prices[p.symbol];
    const mv = last == null ? 0 : last * qty;
    const pnl = last == null ? 0 : (last - avg) * qty;
    const pnlPct = last == null || avg === 0 ? 0 : ((last - avg) / avg) * 100;
    totalMV += mv;
    totalPnL += pnl;

    lines.push([
      JSON.stringify(user.name || ""), JSON.stringify(user.email || ""), String(Number(user.cash)),
      JSON.stringify(p.symbol), JSON.stringify(p.name || ""),
      String(qty), String(avg),
      last == null ? "" : String(last),
      String(mv), String(pnl), String(pnlPct)
    ].join(","));
  }

  lines.push([
    JSON.stringify(user.name || ""), JSON.stringify(user.email || ""), String(Number(user.cash)),
    "TOTAL","", "", "", "",
    String(totalMV), String(totalPnL), ""
  ].join(","));

  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="portfolio_${user.name || user.email}.csv"`);
  res.send(csv);
}