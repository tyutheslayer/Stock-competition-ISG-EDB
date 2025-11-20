// pages/api/plus/daily/generate.js
import prisma from "../../../../lib/prisma";
import OpenAI from "openai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FINNHUB_TOKEN = process.env.FINNHUB_API_KEY;

// ---------- Helpers numériques ----------
function round(val, decimals = 2) {
  if (val == null || isNaN(val)) return null;
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

function pctChange(current, prev) {
  if (current == null || prev == null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

// ---------- Helpers Finnhub ----------
async function finnhubQuote(symbol) {
  if (!FINNHUB_TOKEN) {
    throw new Error("MISSING_FINNHUB_API_KEY");
  }
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
    symbol
  )}&token=${FINNHUB_TOKEN}`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error("[FINNHUB QUOTE HTTP ERROR]", symbol, r.status);
      return null;
    }
    const j = await r.json();
    // format attendu : { c, d, dp, h, l, o, pc }
    if (j && typeof j.c === "number") {
      return j;
    }
    return null;
  } catch (e) {
    console.error("[FINNHUB QUOTE EXCEPTION]", symbol, e);
    return null;
  }
}

async function fetchQuotesMap(symbols = []) {
  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      const q = await finnhubQuote(sym);
      if (q) out[sym] = q;
    })
  );
  return out;
}

// ---------- Construction des données de marché live ----------
async function buildLiveMarkets() {
  // 1) Symboles suivis
  const INDEX_SYMBOLS = {
    "^FCHI": "CAC 40",
    "^GSPC": "S&P 500",
    "^NDX": "Nasdaq 100",
  };

  // FX (paires majeures)
  const FX_SYMBOLS = {
    "OANDA:EUR_USD": "EUR/USD",
    "OANDA:GBP_USD": "GBP/USD",
    "OANDA:USD_JPY": "USD/JPY",
    "OANDA:USD_CHF": "USD/CHF",
    "OANDA:XAU_USD": "XAU/USD",
  };

  // Matières via futures/indices (à ajuster si besoin)
  const COMMODITY_SYMBOLS = {
    "CO:US": "Brent",        // Brent spot index (approx)
    "CL:US": "WTI",          // WTI spot index (approx)
    "COMEX:GC1!": "Gold",    // Future or gold index (selon dispo)
  };

  const CRYPTO_SYMBOLS = {
    "BINANCE:BTCUSDT": "Bitcoin",
    "BINANCE:ETHUSDT": "Ethereum",
  };

  // Watchlist pour top movers
  const WATCHLIST = [
    "NVDA",
    "META",
    "TSLA",
    "AAPL",
    "MSFT",
    "AMZN",
    "GOOGL",
    "NFLX",
    "JPM",
    "XOM",
  ];

  // Obligations (approx – selon ce que Finnhub expose)
  const BOND_SYMBOLS = {
    "US10Y": "US 10Y", // rendement 10 ans US
  };

  const allSymbols = [
    ...Object.keys(INDEX_SYMBOLS),
    ...Object.keys(FX_SYMBOLS),
    ...Object.keys(COMMODITY_SYMBOLS),
    ...Object.keys(CRYPTO_SYMBOLS),
    ...WATCHLIST,
    ...Object.keys(BOND_SYMBOLS),
  ];

  const quotes = await fetchQuotesMap(allSymbols);

  // 2) Indices
  const indices = Object.entries(INDEX_SYMBOLS)
    .map(([symbol, name]) => {
      const q = quotes[symbol];
      if (!q) return null;
      const price = q.c ?? q.pc ?? null;
      const prev = q.pc ?? null;
      const changePct = q.dp ?? pctChange(price, prev);
      const cp = round(changePct);
      return {
        name,
        value: round(price),
        change_pct: cp,
        color: cp == null ? null : cp > 0 ? "green" : cp < 0 ? "red" : "neutral",
        trend:
          cp == null
            ? "flat"
            : cp > 0.5
            ? "bullish"
            : cp < -0.5
            ? "bearish"
            : "range",
      };
    })
    .filter(Boolean);

  // 3) Forex
  const forex = Object.entries(FX_SYMBOLS)
    .map(([symbol, pair]) => {
      const q = quotes[symbol];
      if (!q) return null;
      const price = q.c ?? q.pc ?? null;
      const prev = q.pc ?? null;
      const changePct = q.dp ?? pctChange(price, prev);
      const cp = round(changePct, 3);
      return {
        pair,
        value: round(price, 5),
        change_pct: cp,
        color: cp == null ? null : cp > 0 ? "green" : cp < 0 ? "red" : "neutral",
        trend:
          cp == null
            ? "flat"
            : cp > 0.3
            ? "bullish"
            : cp < -0.3
            ? "bearish"
            : "range",
      };
    })
    .filter(Boolean);

  // 4) Matières premières
  const commodities = Object.entries(COMMODITY_SYMBOLS)
    .map(([symbol, asset]) => {
      const q = quotes[symbol];
      if (!q) return null;
      const price = q.c ?? q.pc ?? null;
      const prev = q.pc ?? null;
      const changePct = q.dp ?? pctChange(price, prev);
      const cp = round(changePct);
      return {
        asset,
        value: round(price),
        unit: asset === "Gold" ? "USD/oz" : "USD/bbl",
        change_pct: cp,
        comment: null,
      };
    })
    .filter(Boolean);

  // 5) Crypto
  const crypto = Object.entries(CRYPTO_SYMBOLS)
    .map(([symbol, asset]) => {
      const q = quotes[symbol];
      if (!q) return null;
      const price = q.c ?? q.pc ?? null;
      const prev = q.pc ?? null;
      const changePct = q.dp ?? pctChange(price, prev);
      const cp = round(changePct);
      return {
        asset,
        value: round(price),
        change_pct: cp,
        trend:
          cp == null
            ? "flat"
            : cp > 2
            ? "bullish"
            : cp < -2
            ? "correction"
            : "range",
      };
    })
    .filter(Boolean);

  // 6) Obligations
  const bonds = Object.entries(BOND_SYMBOLS)
    .map(([symbol, label]) => {
      const q = quotes[symbol];
      if (!q) return null;
      const yieldPct = q.c ?? q.pc ?? null;
      const prev = q.pc ?? null;
      const change = yieldPct != null && prev != null ? yieldPct - prev : null;
      // On approxime 1 point de variation de rendement = 1 bp ici (simple)
      const changeBps = change != null ? round(change, 1) : null;
      return {
        country: label,
        yield: round(yieldPct, 2),
        change_bps: changeBps,
      };
    })
    .filter(Boolean);

  // 7) Watchlist pour top movers
  const withChange = WATCHLIST.map((symbol) => {
    const q = quotes[symbol];
    if (!q) return null;
    const price = q.c ?? q.pc ?? null;
    const prev = q.pc ?? null;
    const changePct = q.dp ?? pctChange(price, prev);
    const cp = round(changePct);
    if (cp == null) return null;
    return {
      ticker: symbol,
      name: null,
      change_pct: cp,
    };
  }).filter(Boolean);

  const sorted = [...withChange].sort(
    (a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)
  );
  const top_gainers = sorted.filter((x) => x.change_pct > 0).slice(0, 5);
  const top_losers = sorted
    .filter((x) => x.change_pct < 0)
    .slice(-5)
    .sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0));

  const top_movers = { top_gainers, top_losers };

  return {
    markets: { indices, forex, commodities, crypto, bonds },
    top_movers,
    watchlist_raw: withChange,
  };
}

// ---------- Handler principal ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "MISSING_OPENAI_API_KEY" });
  }
  if (!FINNHUB_TOKEN) {
    return res.status(500).json({ error: "MISSING_FINNHUB_API_KEY" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const role = session?.user?.role || null;
    const isAdmin = role === "ADMIN";

    // Seul un admin peut générer / rafraîchir
    if (!isAdmin) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // 📆 J-1 normalisé à minuit UTC
    const now = new Date();
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    y.setUTCHours(0, 0, 0, 0);
    const yStr = y.toISOString().slice(0, 10);

    // Cache DB : si déjà généré → renvoie direct
    const existing = await prisma.dailyInsight.findUnique({
      where: { day: y },
    });

    if (existing) {
      return res.status(200).json({
        ok: true,
        fromCache: true,
        report: existing.payload,
      });
    }

    // 1) Données live Finnhub
    const live = await buildLiveMarkets();
    const { markets, top_movers, watchlist_raw } = live;

    // 2) Appel OpenAI pour ANALYSE TEXTUELLE
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es EDB Global Macro AI, un analyste macro-financier institutionnel qui commente les marchés à partir de données réelles fournies.",
        },
        {
          role: "user",
          content: `
Tu es **EDB Global Macro AI**, un analyste macro-financier institutionnel chargé de produire
chaque jour un rapport économique complet pour les membres EDB Plus.

🎯 OBJECTIF
- Produire un rapport DAILY pour la date "${yStr}" basé sur les données de marché RÉELLES fournies ci-dessous.
- TU NE DOIS JAMAIS INVENTER DE CHIFFRES.
- Tous les nombres (indices, FX, matières, crypto, taux, variations) sont DÉJÀ calculés et ne doivent PAS être modifiés.
- Tu produis UNIQUEMENT les parties TEXTUELLES du rapport (macro, géopolitique, corporate, agenda, sentiment, etc.).

Voici les données live de marché (issues d'APIs type Finnhub) :

\`\`\`json
${JSON.stringify(
  {
    date: yStr,
    markets,
    top_movers,
    watchlist_raw,
  },
  null,
  2
)}
\`\`\`

À partir de ces données :

1) Analyse l'ambiance globale des marchés (indices, FX, matières, crypto, taux).
2) Commente qualitativement les thèmes macro du moment (croissance, inflation, emploi, banques centrales), **sans inventer de chiffres précis**.
3) Identifie les messages géopolitiques pertinents (s'il n'y a rien de saillant, reste sobre).
4) Commente quelques histoires corporate importantes POTENTIELLES liées aux secteurs/titres en mouvement (sans inventer de chiffres numériques).
5) Propose un petit agenda macro pour aujourd'hui et le reste de la semaine (type NFP, CPI, réunions de banques centrales, résultats big tech).
6) Donne un bloc "sentiment" (ex: prudence, risk-on, risk-off, rotation sectorielle, attentisme, etc.).
7) Termine par une phrase de synthèse professionnelle (ai_commentary).

⚠️ RÈGLES :
- NE PAS inventer de nouveaux nombres ; si tu évoques un mouvement, reste **qualitatif** ("en légère hausse", "fort repli", "stabilisation").
- Tu n'as PAS besoin de renvoyer les données de marché (indices, FX, etc.) dans ta réponse : elles sont déjà stockées.
- Tu dois répondre en FRANÇAIS, ton professionnel, style desk macro institutionnel.

FORMAT DE SORTIE — JSON STRICT :

{
  "summary": "2-3 phrases max sur l'ambiance de marché globale",
  "macro": {
    "growth": [
      { "region": "US", "indicator": "Croissance / activité", "comment": "..." },
      { "region": "Zone euro", "indicator": "Croissance / activité", "comment": "..." }
    ],
    "inflation": [
      { "region": "US", "indicator": "Inflation", "comment": "..." }
    ],
    "employment": [
      { "region": "US", "indicator": "Marché de l'emploi", "comment": "..." }
    ],
    "central_banks": [
      { "institution": "Federal Reserve", "stance": "dovish / hawkish / neutre", "comment": "..." },
      { "institution": "BCE", "stance": "neutre / accommodante / restrictive", "comment": "..." }
    ]
  },
  "geopolitics": [
    { "region": "ex: Moyen-Orient", "event": "...", "impact": "..." }
  ],
  "corporate": [
    { "company": "ex: Nvidia, méga-cap IA", "news": "commentaire qualitatif", "impact": "effet sur le sentiment ou le secteur" }
  ],
  "agenda": {
    "today": [
      "Liste de 2-4 événements macro/banques centrales/résultats à surveiller aujourd'hui"
    ],
    "week_ahead": [
      "Liste de 2-4 gros événements pour le reste de la semaine"
    ]
  },
  "sentiment": {
    "regime": "risk-on / risk-off / range / attentisme",
    "comment": "une phrase courte sur le positionnement ou l'humeur du marché"
  },
  "ai_commentary": "Une phrase de synthèse professionnelle."
}

⚠️ IMPORTANT :
- STRICT JSON.
- AUCUN texte avant/après le JSON.
- Pas de valeurs numériques inventées.
        `,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsedAI;
    try {
      parsedAI = JSON.parse(raw);
    } catch (e) {
      console.error("[DAILY PARSE ERROR]", raw);
      return res.status(500).json({ error: "PARSE_FAILED", raw });
    }

    // 3) Fusion des données live + analyse AI
    const payload = {
      date: yStr,
      summary: parsedAI.summary || "",
      macro: parsedAI.macro || {
        growth: [],
        inflation: [],
        employment: [],
        central_banks: [],
      },
      geopolitics: parsedAI.geopolitics || [],
      corporate: parsedAI.corporate || [],
      agenda: parsedAI.agenda || { today: [], week_ahead: [] },
      sentiment: parsedAI.sentiment || {},
      ai_commentary: parsedAI.ai_commentary || "",
      markets,
      top_movers,
    };

    // 4) Stockage DB
    const saved = await prisma.dailyInsight.create({
      data: {
        day: y,
        payload,
      },
    });

    return res.status(201).json({
      ok: true,
      fromCache: false,
      report: payload,
      id: saved.id,
    });
  } catch (e) {
    console.error("[DAILY GENERATE ERROR]", e);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      detail: e?.message || String(e),
    });
  }
}