// pages/api/cron/insight-generate.js
import prisma from "../../../lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Petit helper pour avoir le lundi de la semaine courante
function getCurrentWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0 = dimanche, 1 = lundi...
  const diff = (day === 0 ? -6 : 1) - day; // ramène à lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "METHOD_NOT_ALLOWED", detail: "POST only" });
  }

  // Sécurisation via CRON_SECRET (header Authorization: Bearer xxx)
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  try {
    const weekStart = getCurrentWeekStart();

    // Si un insight existe déjà pour cette semaine, on ne recrée pas
    const existing = await prisma.weeklyInsight.findFirst({
      where: { weekStart },
    });
    if (existing) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Insight déjà généré pour cette semaine",
        id: existing.id,
      });
    }

    // Prompt très orienté "résumé macro / marchés" -> JSON strict
    const systemPrompt = `
Tu es un analyste macro-financier senior pour un club de trading étudiant (École de la Bourse).
Ta mission : produire chaque semaine une synthèse professionnelle pour des étudiants motivés,
niveau débutant/intermédiaire, en gardant un ton clair, pédagogique et structuré.

Tu DOIS répondre STRICTEMENT en JSON, rien d'autre. Pas de texte avant ou après.

Format JSON EXACT attendu :
{
  "title": "Titre court et percutant en français",
  "slug": "kebab-case-unique-pour-cette-semaine",
  "summary": "Résumé en 2-3 phrases, clair et concret",
  "content": "# Titre\\n\\nContenu en Markdown structuré (sections, listes, etc.)"
}
`;

    const userPrompt = `
Génère un "Weekly Insight" macro/marchés pour la semaine en cours, en tenant compte de :
- macro globale (inflation, banques centrales, croissance, emploi, sentiment de marché, etc.),
- classes d'actifs clés (actions, taux, FX, matières premières, éventuellement crypto),
- 3 à 5 points d'attention pour un étudiant qui suit l'actualité financière,
- angle pédagogique : expliquer les concepts importants sans jargon inutile.

Ne parle PAS d'allocations concrètes, juste de compréhension du contexte.
Ne cite pas de sources, reste généraliste.

Rappelle-toi : ta réponse doit être UNIQUEMENT le JSON demandé par le système, rien d'autre.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("[CRON INSIGHT] JSON parse error:", e, raw);
      return res.status(500).json({
        error: "BAD_AI_JSON",
        detail: e.message,
      });
    }

    const title = String(parsed.title || "Weekly Insight").trim();
    const slug =
      String(parsed.slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") ||
      `weekly-insight-${weekStart.toISOString().slice(0, 10)}`;
    const summary = String(parsed.summary || "").trim();
    const content = String(parsed.content || "").trim();

    const created = await prisma.weeklyInsight.create({
      data: {
        title,
        slug,
        summary,
        content,
        weekStart,
        // visibleAt et createdAt ont des defaults Prisma
      },
    });

    return res.status(201).json({
      ok: true,
      id: created.id,
      slug: created.slug,
      title: created.title,
    });
  } catch (e) {
    console.error("[CRON INSIGHT] error:", e);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      detail: e?.message || String(e),
    });
  }
}