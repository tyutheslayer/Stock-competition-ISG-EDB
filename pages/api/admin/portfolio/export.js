// pages/api/admin/portfolio/export.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "../../../../lib/prisma";
import yahooFinance from "yahoo-finance2";

// --- FX helper: retourne ccy→EUR (nombre) ---
async function fxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const r1 = q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) return r1;
  } catch {}
  try {
    const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
    const r2 = q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
    if (Number.isFinite(r2) && r2 > 0) return 1 / r2;
  } catch {}
  return 1;
}

function toCsv(rows, footer = []) {
  const header = [
    "symbol",
    "name",
    "quantity",
    "avg_price_EUR",
    "last_EUR",
    "market_value_EUR",
    "native_currency",
    "rate_to_EUR",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.symbol,
      (r.name || "").replaceAll(",", " "),
      r.quantity,
      Number(r.avgPriceEUR ?? 0),
      Number(r.lastEUR ?? 0),
      Number(r.marketValueEUR ?? 0),
      r.currency || "EUR",
      Number(r.rateToEUR ?? 1),
    ].join(","));
  }
  if (footer.length) {
    lines.push(""); // ligne vide
    for (const f of footer) lines.push(f.join(","));
  }
  return lines.join("\n");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Méthode non supportée" });
    }

    // --- Auth & check admin ---
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });
    if (!me || (me.role !== "ADMIN")) {
      return res.status(403).json({ error: "Réservé aux admins" });
    }

    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "Paramètre userId requis" });

    // --- Charge user + positions ---
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, cash: true },
    });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const positions = await prisma.position.findMany({
      where: { userId },
      select: { symbol: true, name: true, quantity: true, avgPrice: true },
    });

    // --- Quotes + FX + enrichissement en EUR ---
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const quotes = {};
    for (const s of symbols) {
      try { quotes[s] = await yahooFinance.quote(s); }
      catch { quotes[s] = null; }
    }

    const rows = [];
    for (const p of positions) {
      const q = quotes[p.symbol];
      const lastNative =
        (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
        (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
        (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
        null;

      const ccy = q?.currency || "EUR";
      const rate = await fxToEUR(ccy);

      const lastEUR = Number.isFinite(lastNative) ? Number(lastNative) * rate : null;

      // Heuristique pour convertir un ancien avg natif → EUR
      let avgPriceEUR = Number(p.avgPrice || 0);
      if (ccy !== "EUR") {
        const lastEURnum = Number(lastEUR || 0);
        const lastNatNum = Number(lastNative || 0);
        const ratioToEUR = lastEURnum > 0 ? Math.abs(avgPriceEUR - lastEURnum) / lastEURnum : 0;
        const ratioToNat = lastNatNum > 0 ? Math.abs(avgPriceEUR - lastNatNum) / lastNatNum : Infinity;
        if (ratioToNat <= 0.25 && ratioToEUR >= 0.25) {
          avgPriceEUR = avgPriceEUR * rate;
        }
      }

      const qty = Number(p.quantity || 0);
      const marketValueEUR = (Number.isFinite(lastEUR) ? lastEUR : 0) * qty;

      rows.push({
        symbol: p.symbol,
        name: p.name || "",
        quantity: qty,
        avgPriceEUR,
        lastEUR,
        marketValueEUR,
        currency: ccy,
        rateToEUR: rate,
      });
    }

    const positionsValue = rows.reduce((s, r) => s + Number(r.marketValueEUR || 0), 0);
    const totalEquity = Number(user.cash || 0) + positionsValue;

    // --- CSV ---
    const csv = toCsv(rows, [
      ["cash_EUR", Number(user.cash || 0)],
      ["positions_value_EUR", Number(positionsValue)],
      ["equity_total_EUR", Number(totalEquity)],
    ]);

    const safeName = (user.name || user.email || user.id || "user").replace(/[^a-z0-9_\-\.]/gi, "_");
    const ts = new Date().toISOString().replace(/[:]/g, "-");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="portfolio_${safeName}_${ts}.csv"`);
    return res.status(200).send(csv);
  } catch (e) {
    console.error("[admin][portfolio][export] fatal:", e);
    return res.status(500).json({ error: "Échec export CSV" });
  }
}