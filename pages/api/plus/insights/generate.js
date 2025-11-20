// pages/api/plus/insights/generate.js
import prisma from "../../../../lib/prisma";
import OpenAI from "openai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function makeSlug(title, todayStr) {
  const base =
    String(title || "weekly-insight")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "weekly-insight";

  return `${base}-${todayStr}`;
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

    // Pour l’instant : génération réservée admin
    if (!isAdmin) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const completion = await client.chat.completions.create({
     model: "gpt-4.1-mini",
     response_format: { type: "json_object" },
     messages: [
        {
          role: "system",
          content: `
    Tu es **EDB Global Macro AI**, un analyste économique institutionnel haut de gamme au ton factuel et synthétique, spécialisé dans la veille macro-financière mondiale.

    RÔLE :
    - Tu écris des synthèses macro & marchés pour des investisseurs, traders et étudiants en finance (niveau avancé).
    - Tu dois faire le lien entre macro, marchés, géopolitique et sentiment.
    - Style : neutre, précis, concis, professionnel (pas de hype, pas de dramatisation).

    RÈGLES :
    - Toujours répondre UNIQUEMENT avec du JSON valide.
    - Les valeurs numériques sont des floats (pas de "%", pas de "NaN").
    - Si une donnée n’est pas certaine, tu produis une valeur plausible cohérente avec les tendances récentes.
    - Tu indiques clairement les liens de causalité macro → marchés quand c’est utile.
    - Pas de texte hors JSON, pas de commentaires.
          `,
        },
       {
          role: "user",
          content: `
    Nous sommes le ${todayStr}.
    Génère un **brief QUOTIDIEN** macro & marchés pour les membres EDB Plus, en français.

    Respecte STRICTEMENT ce schéma JSON (rien d’autre) :

    {
      "title": "headline courte de la semaine",
      "summary": "2-4 phrases en français : macro + marchés, ton pro mais pédagogique",
      "macro": [
        { "title": "Inflation / banques centrales", "detail": "2-3 lignes en français" },
        { "title": "Croissance / activité / emploi", "detail": "2-3 lignes en français" }
      ],
      "markets": [
        { "title": "Actions", "detail": "2-3 lignes en français (US, Europe, tech/value...)" },
        { "title": "Taux / FX / Matières premières", "detail": "2-3 lignes en français" }
      ],
      "sectors": [
        { "title": "Thème ou secteur 1 (ex: IA, défense, énergie...)", "detail": "2-3 lignes" },
        { "title": "Thème ou secteur 2", "detail": "2-3 lignes" }
      ],
       "headlines": [
        {
          "company": "Nom d'entreprise 1",
          "headline": "Résumé ultra court (résultats, M&A, guidance...)",
          "impact": "1 phrase sur l'impact boursier",
          "region": "US ou Europe"
        },
        {
          "company": "Nom d'entreprise 2",
          "headline": "Résumé",
          "impact": "Impact marché",
          "region": "US ou Europe"
        }
      ],
      "equityChart": [
        { "name": "S&P 500",       "changePct": -0.5 },
        { "name": "Euro Stoxx 50", "changePct":  0.3 },
        { "name": "NASDAQ 100",    "changePct":  1.2 }
      ],
      "ratesFxChart": [
        { "name": "US 10Y (bps)",   "change": -8 },
        { "name": "Bund 10Y (bps)", "change": -5 },
        { "name": "EURUSD (%)",     "change":  0.4 }
      ],
      "volChart": [
        { "name": "VIX",        "level": 15.2 },
        { "name": "MOVE",       "level": 96.0 },
        { "name": "EUROSTOXX",  "level": 18.5 }
      ],
      "focus": "3-5 lignes de takeaways actionnables en français pour les membres EDB Plus (positionnement, risques à surveiller, idées de lecture de marché).",
      "ai_commentary": "Une phrase d'analyse synthétique au ton professionnel."
    }

    Contraintes :
    - Tout le texte explicatif est en français.
    - Tu respectes exactement les noms de champs (camelCase).
    - Aucune virgule en trop à la fin d'un tableau ou objet.
          `,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("[INSIGHT PARSE ERROR]", raw);
      return res.status(500).json({ error: "PARSE_FAILED", raw });
    }

    const {
      title = "Weekly Insight",
      summary = "",
      macro = [],
      markets = [],
      sectors = [],
      headlines = [],
      equityChart = [],
      ratesFxChart = [],
      volChart = [],
      focus = "",
    } = parsed;

    const structuredPayload = {
      macro,
      markets,
      sectors,
      headlines,
      equityChart,
      ratesFxChart,
      volChart,
      focus,
    };

    // Lundi de la semaine
    const weekStart = new Date(today);
    const day = weekStart.getDay(); // 0 dimanche
    const diff = (day === 0 ? -6 : 1) - day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const slug = makeSlug(title, todayStr);

    const insight = await prisma.weeklyInsight.create({
      data: {
        title: String(title).slice(0, 200),
        slug,
        summary: String(summary),
        content: JSON.stringify(structuredPayload),
        weekStart,
        authorId: session?.user?.id || null,
      },
    });

    return res.status(201).json({ ok: true, insight });
  } catch (e) {
    console.error("[INSIGHT GENERATE ERROR]", e);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      detail: e?.message || String(e),
    });
  }
}