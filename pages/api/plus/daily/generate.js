// pages/api/plus/daily/generate.js
import prisma from "../../../../lib/prisma";
import OpenAI from "openai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // 🔐 On limite pour l’instant aux admins (tu pourras ouvrir plus tard si tu veux)
    if (!isAdmin) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // J-1 pour le rapport (jour précédent)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

    // 🧠 PROMPT DAILY COMPLET EN FRANÇAIS (celui que tu m'as envoyé, avec la date injectée)
    const userPrompt = `
Tu es **EDB Global Macro AI**, un analyste macro-financier institutionnel chargé de produire
chaque jour un rapport économique complet pour les membres EDB Plus.

===========================================
🎯 OBJECTIF
===========================================
Générer un **rapport JSON STRICT**, ULTRA COMPLET, basé sur les informations du 
**jour précédent** (J-1).

La date du jour précédent est : "${yStr}".

Le rapport est destiné à :
- des traders étudiants niveau avancé
- des investisseurs
- des lecteurs institutionnels (style Bloomberg / JP Morgan Markets Desk)

Tu DOIS :
- inclure beaucoup d’informations
- être factuel, précis, structuré
- écrire en français
- générer des valeurs chiffrées PLAUSIBLES mais pas nécessairement exactes
  (pas de données live — uniquement cohérentes avec les tendances actuelles)
- ne jamais écrire du texte hors JSON
- garantir un JSON valide à 100%

===========================================
📊 FORMAT DE SORTIE — JSON STRICT
===========================================

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

===========================================
🧠 RÈGLES OBLIGATOIRES
===========================================

- Toujours du JSON strict ❗
- La clé "date" doit contenir la date du jour précédent : "${yStr}".
- Valeurs chiffrées PLAUSIBLES mais pas exactes.
- Aucun texte avant/après le JSON.
- Maximum de contenu possible.
- Si une section est vide, remplis-la quand même avec des données plausibles.
`;

    // 🧠 Appel OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Tu es un modèle qui renvoie STRICTEMENT du JSON valide.",
        },
        {
          role: "user",
          content: userPrompt,
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

    // 🔐 Sécurisation minimale : enforce la date = yStr
    parsed.date = yStr;

    // 🗃️ On enregistre / met à jour le DailyInsight de J-1
    const saved = await prisma.dailyInsight.upsert({
      where: { date: yesterday },
      update: { json: parsed, authorId: session.user.id || null },
      create: {
        date: yesterday,
        json: parsed,
        authorId: session.user.id || null,
      },
    });

    return res.status(201).json({ ok: true, insight: saved });
  } catch (e) {
    console.error("[DAILY GENERATE ERROR]", e);
    return res
      .status(500)
      .json({ error: "INTERNAL_ERROR", detail: e?.message || String(e) });
  }
}