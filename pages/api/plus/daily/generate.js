// pages/api/plus/daily/generate.js
import prisma from "../../../../lib/prisma";
import OpenAI from "openai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function startOfDayUTC(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "MISSING_OPENAI_API_KEY" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const role = session?.user?.role || null;
    const isAdmin = role === "ADMIN";

    // 🔐 Pour l’instant : seulement ADMIN peut générer le daily
    if (!isAdmin) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const today = new Date();
    const day = startOfDayUTC(today);

    // 🔁 1) Vérifier si on a DÉJÀ un daily pour aujourd’hui
    const existing = await prisma.dailyInsight.findUnique({
      where: { day },
    });

    if (existing) {
      // On ne regénère pas → on renvoie simplement le daily existant
      return res.status(200).json({ ok: true, fromCache: true, daily: existing });
    }

    // 📅 Date J-1 (car tu veux parler du jour précédent)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    // 🧠 Appel OpenAI avec TON prompt “EDB Global Macro AI”
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es EDB Global Macro AI, un analyste macro-financier institutionnel chargé de produire chaque jour un rapport économique complet pour les membres EDB Plus. Tu dois toujours répondre en JSON STRICT valide.",
        },
        {
          role: "user",
          content: `
Date du jour (aujourd'hui): ${today.toISOString().slice(0, 10)}
Tu dois produire un rapport sur la journée précédente (J-1): ${yStr}.

Voici le FORMAT OBLIGATOIRE (JSON strict) :

{
  "date": "YYYY-MM-DD",
  "summary": "Synthèse macro de 2–3 phrases sur l'ambiance du marché la veille",
  
  "markets": {
    "indices": [
      { "name": "CAC 40", "value": 7521.4, "change_pct": -0.42, "color": "red", "trend": "bearish" },
      { "name": "S&P 500", "value": 5095.2, "change_pct": +0.74, "color": "green", "trend": "bullish" },
      { "name": "Nasdaq 100", "value": 17895.5, "change_pct": +1.02, "trend": "bullish" }
    ],
    "forex": [
      { "pair": "EUR/USD", "value": 1.086, "change_pct": +0.12, "color": "green", "trend": "neutral" },
      { "pair": "GBP/USD", "value": 1.276, "change_pct": -0.08, "color": "red" },
      { "pair": "USD/JPY", "value": 150.1, "change_pct": -0.35, "color": "green", "trend": "bullish JPY" },
      { "pair": "USD/CHF", "value": 0.883, "change_pct": +0.22, "color": "red" },
      { "pair": "XAU/USD", "value": 2358.2, "change_pct": +0.31, "color": "green" }
    ],
    "commodities": [
      { "asset": "Brent", "value": 84.3, "change_pct": +1.1, "comment": "tensions Moyen-Orient" },
      { "asset": "WTI", "value": 80.2, "change_pct": +0.9 },
      { "asset": "Copper", "value": 4.25, "unit": "USD/lb", "change_pct": -0.4 }
    ],
    "crypto": [
      { "asset": "Bitcoin", "value": 67850, "change_pct": -1.4, "trend": "correction" },
      { "asset": "Ethereum", "value": 3520, "change_pct": -0.8 }
    ],
    "bonds": [
      { "country": "US 10Y", "yield": 4.21, "change_bps": -6 },
      { "country": "DE 10Y", "yield": 2.32, "change_bps": -2 },
      { "country": "FR 10Y", "yield": 2.87, "change_bps": -1 }
    ]
  },

  "top_movers": {
    "top_gainers": [
      { "ticker": "NVDA", "name": "Nvidia", "change_pct": +4.2, "reason": "résultats supérieurs aux attentes" },
      { "ticker": "META", "change_pct": +3.1 }
    ],
    "top_losers": [
      { "ticker": "TSLA", "name": "Tesla", "change_pct": -2.8, "reason": "réduction de production Chine" },
      { "ticker": "BABA", "change_pct": -2.1 }
    ]
  },

  "macro": {
    "growth": [
      { "region": "US", "indicator": "GDP QoQ", "value": "+2.8%", "comment": "croissance robuste" },
      { "region": "Eurozone", "indicator": "PMI composite", "value": "47.8", "comment": "contraction persistante" }
    ],
    "inflation": [
      { "region": "US", "indicator": "CPI YoY", "value": "+3.2%", "comment": "stabilisation" }
    ],
    "employment": [
      { "region": "US", "indicator": "NFP", "value": "+175k" }
    ],
    "central_banks": [
      { "institution": "Federal Reserve", "stance": "dovish", "comment": "baisse prob. en septembre" },
      { "institution": "ECB", "stance": "neutral" }
    ]
  },

  "geopolitics": [
    { "region": "Moyen-Orient", "event": "tensions énergétiques", "impact": "hausse du pétrole" },
    { "region": "Asie", "event": "ralentissement exportations Chine" }
  ],

  "corporate": [
    { "company": "Apple", "news": "annonce partenariat IA", "impact": "+1.5%" },
    { "company": "TotalEnergies", "news": "résultats trimestriels supérieurs" }
  ],

  "agenda": {
    "today": [
      "Publication CPI US 14h30",
      "Discours Christine Lagarde 17h00"
    ],
    "week_ahead": [
      "Réunion FOMC mercredi",
      "Résultats NVIDIA jeudi"
    ]
  },

  "sentiment": {
    "fear_greed": 63,
    "vix": 14.8,
    "comment": "optimisme modéré"
  },

  "ai_commentary": "Les marchés digèrent les signaux de ralentissement inflationniste tandis que les taux longs se stabilisent."
}

RÈGLES :
- Toujours du JSON strict.
- Remplis AU MAXIMUM chaque section avec des données PLAUSIBLES.
- Pas un seul caractère hors JSON.
- Les valeurs chiffrées doivent être cohérentes entre elles (pas de trucs absurdes).
        `,
        },
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

    // 2️⃣  On stocke le JSON brut dans la table
    const daily = await prisma.dailyInsight.create({
      data: {
        day,
        payload: parsed,
      },
    });

    return res.status(201).json({ ok: true, fromCache: false, daily });
  } catch (e) {
    console.error("[DAILY GENERATE ERROR]", e);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      detail: e?.message || String(e),
    });
  }
}