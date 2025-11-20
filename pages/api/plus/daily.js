// pages/api/plus/daily.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --------- Helpers live data ---------

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

/**
 * Live FX via exchangerate.host
 * Paires: EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD
 */
async function getLiveForex() {
  const base = "USD";
  const symbols = "EUR,GBP,JPY,CHF,XAU";

  // today
  const latest = await fetchJson(
    `https://api.exchangerate.host/latest?base=${base}&symbols=${symbols}`
  );

  // yesterday
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yStr = d.toISOString().slice(0, 10);
  const yesterday = await fetchJson(
    `https://api.exchangerate.host/${yStr}?base=${base}&symbols=${symbols}`
  );

  const cur = latest.rates || {};
  const prev = yesterday.rates || {};

  function pctChange(now, before) {
    if (!now || !before) return 0;
    return ((now - before) / before) * 100;
  }

  const out = [];

  // EUR/USD : inverse de USD/EUR
  if (cur.EUR && prev.EUR) {
    const eurusd = 1 / cur.EUR;
    const eurusdPrev = 1 / prev.EUR;
    const c = pctChange(eurusd, eurusdPrev);
    out.push({
      pair: "EUR/USD",
      value: Number(eurusd.toFixed(4)),
      change_pct: Number(c.toFixed(2)),
      color: c >= 0 ? "green" : "red",
      trend: c > 0 ? "bullish EUR" : c < 0 ? "bearish EUR" : "neutral",
    });
  }

  // GBP/USD : inverse de USD/GBP
  if (cur.GBP && prev.GBP) {
    const gbpusd = 1 / cur.GBP;
    const gbpusdPrev = 1 / prev.GBP;
    const c = pctChange(gbpusd, gbpusdPrev);
    out.push({
      pair: "GBP/USD",
      value: Number(gbpusd.toFixed(4)),
      change_pct: Number(c.toFixed(2)),
      color: c >= 0 ? "green" : "red",
      trend: c > 0 ? "bullish GBP" : c < 0 ? "bearish GBP" : "neutral",
    });
  }

  // USD/JPY : direct (base=USD)
  if (cur.JPY && prev.JPY) {
    const now = cur.JPY;
    const before = prev.JPY;
    const c = pctChange(now, before);
    out.push({
      pair: "USD/JPY",
      value: Number(now.toFixed(2)),
      change_pct: Number(c.toFixed(2)),
      color: c >= 0 ? "green" : "red",
      trend: c > 0 ? "bullish USD" : c < 0 ? "bearish USD" : "neutral",
    });
  }

  // USD/CHF : direct (base=USD)
  if (cur.CHF && prev.CHF) {
    const now = cur.CHF;
    const before = prev.CHF;
    const c = pctChange(now, before);
    out.push({
      pair: "USD/CHF",
      value: Number(now.toFixed(4)),
      change_pct: Number(c.toFixed(2)),
      color: c >= 0 ? "green" : "red",
      trend: c > 0 ? "bullish USD" : c < 0 ? "bearish USD" : "neutral",
    });
  }

  // XAU/USD : inverse de USD/XAU
  if (cur.XAU && prev.XAU) {
    const xauusd = 1 / cur.XAU;
    const xauusdPrev = 1 / prev.XAU;
    const c = pctChange(xauusd, xauusdPrev);
    out.push({
      pair: "XAU/USD",
      value: Number(xauusd.toFixed(2)),
      change_pct: Number(c.toFixed(2)),
      color: c >= 0 ? "green" : "red",
      trend: c > 0 ? "bullish gold" : c < 0 ? "bearish gold" : "neutral",
    });
  }

  return out;
}

/**
 * Live crypto (Binance API publique)
 */
async function getLiveCrypto() {
  const symbols = ["BTCUSDT", "ETHUSDT"];
  const requests = symbols.map((s) =>
    fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${s}`).then(
      (data) => ({ symbol: s, data })
    )
  );
  const results = await Promise.allSettled(requests);

  const out = [];

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { symbol, data } = r.value;
    const price = Number(data.lastPrice || data.weightedAvgPrice || 0);
    const changePct = Number(data.priceChangePercent || 0);
    const prettyName =
      symbol === "BTCUSDT"
        ? "Bitcoin"
        : symbol === "ETHUSDT"
        ? "Ethereum"
        : symbol;
    out.push({
      asset: prettyName,
      symbol,
      value: Number(price.toFixed(2)),
      change_pct: Number(changePct.toFixed(2)),
      color: changePct >= 0 ? "green" : "red",
      trend:
        changePct > 3
          ? "strong bullish"
          : changePct > 0
          ? "bullish"
          : changePct < -3
          ? "strong bearish"
          : "bearish",
    });
  }

  return out;
}

/**
 * Live indices via Finnhub (SPY, QQQ, EWQ en proxy S&P500 / Nasdaq / France)
 */
async function getLiveIndices() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  const symbols = [
    { symbol: "SPY", name: "S&P 500 (SPY)" },
    { symbol: "QQQ", name: "Nasdaq 100 (QQQ)" },
    { symbol: "EWQ", name: "France (EWQ)" },
  ];

  const requests = symbols.map((s) =>
    fetchJson(
      `https://finnhub.io/api/v1/quote?symbol=${s.symbol}&token=${apiKey}`
    ).then((data) => ({ meta: s, data }))
  );

  const results = await Promise.allSettled(requests);
  const out = [];

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { meta, data } = r.value;
    const current = Number(data.c || 0);
    const previous = Number(data.pc || 0);
    if (!current || !previous) continue;
    const changePct = ((current - previous) / previous) * 100;
    out.push({
      name: meta.name,
      symbol: meta.symbol,
      value: Number(current.toFixed(2)),
      change_pct: Number(changePct.toFixed(2)),
      color: changePct >= 0 ? "green" : "red",
      trend:
        changePct > 1
          ? "bullish"
          : changePct < -1
          ? "bearish"
          : "neutral",
    });
  }

  return out;
}

// --------- Handler principal ---------

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "MISSING_OPENAI_API_KEY" });
  }

  try {
    // 🔐 Accès réservé Plus / Admin
    const session = await getServerSession(req, res, authOptions);
    const u = session?.user || {};
    const isPlus =
      u.isPlusActive === true ||
      u.plusStatus === "active" ||
      u.role === "ADMIN";

    if (!isPlus) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // 📅 on parle du jour précédent
    const today = new Date();
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const dateStr = d.toISOString().slice(0, 10);

    // 1) Live data (FX, crypto, indices)
    const [forex, crypto, indices] = await Promise.all([
      getLiveForex().catch(() => []),
      getLiveCrypto().catch(() => []),
      getLiveIndices().catch(() => []),
    ]);

    const liveMarkets = {
      indices,
      forex,
      commodities: [], // tu pourras les remplir plus tard via une autre API
      crypto,
      bonds: [],
    };

    // 2) Appel OpenAI avec TON prompt (sans la partie markets)
    const systemPrompt = `
Tu es **EDB Global Macro AI**, un analyste macro-financier institutionnel chargé de produire
chaque jour un rapport économique complet pour les membres EDB Plus.

Règles OBLIGATOIRES :
- Toujours du JSON strict.
- AUCUN texte avant ou après le JSON.
- Valeurs chiffrées plausibles mais pas forcément exactes (pas de live).
- Tu parles des informations de la journée précédente (${dateStr}).
- Écris en français, ton professionnel, style desk de salle de marché.
- NE FOURNIS PAS le champ "markets" (il est créé côté back avec des données live).
`;

    const userPrompt = `
Génère un rapport JSON ULTRA COMPLET au format suivant, SANS le champ "markets" :

{
  "date": "YYYY-MM-DD",
  "summary": "Synthèse macro de 2–3 phrases sur l'ambiance du marché la veille",
  "top_movers": {
    "top_gainers": [
      { "ticker": "NVDA", "name": "Nvidia", "change_pct": +4.2, "reason": "résultats supérieurs aux attentes" }
    ],
    "top_losers": [
      { "ticker": "TSLA", "name": "Tesla", "change_pct": -2.8, "reason": "news négative" }
    ]
  },
  "macro": {
    "growth": [
      { "region": "US", "indicator": "GDP QoQ", "value": "+2.8%", "comment": "croissance robuste" }
    ],
    "inflation": [
      { "region": "US", "indicator": "CPI YoY", "value": "+3.2%", "comment": "stabilisation" }
    ],
    "employment": [
      { "region": "US", "indicator": "NFP", "value": "+175k" }
    ],
    "central_banks": [
      { "institution": "Federal Reserve", "stance": "dovish", "comment": "baisse probable en septembre" }
    ]
  },
  "geopolitics": [
    { "region": "Moyen-Orient", "event": "tensions énergétiques", "impact": "hausse du pétrole" }
  ],
  "corporate": [
    { "company": "Apple", "news": "annonce partenariat IA", "impact": "+1.5%" }
  ],
  "agenda": {
    "today": [
      "Publication CPI US 14h30"
    ],
    "week_ahead": [
      "Réunion FOMC mercredi"
    ]
  },
  "sentiment": {
    "fear_greed": 63,
    "vix": 14.8,
    "comment": "optimisme modéré"
  },
  "ai_commentary": "Phrase de synthèse sur l'état des marchés."
}

Contraintes :
- Remplis TOUTES les sections avec un maximum d'informations plausibles.
- Utilise "${dateStr}" comme champ "date".
- NE renvoie PAS le champ "markets" (il sera injecté par le backend).
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("[DAILY PARSE ERROR]", raw);
      return res.status(500).json({ error: "PARSE_FAILED", raw });
    }

    // On enlève markets au cas où le modèle l'aurait ajouté
    const { markets: _ignored, ...rest } = parsed;

    const final = {
      date: rest.date || dateStr,
      ...rest,
      markets: liveMarkets,
    };

    return res.status(200).json(final);
  } catch (e) {
    console.error("[DAILY LIVE ERROR]", e);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      detail: e?.message || String(e),
    });
  }
}