// pages/api/plus/insights/generate.js
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

    // 🔐 Pour l’instant : seule un admin peut générer un insight
    if (!isAdmin) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // 🧠 Appel OpenAI : on demande un JSON structuré
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a professional financial strategist writing a concise weekly macro & markets briefing. Always respond ONLY with valid JSON.",
        },
        {
          role: "user",
          content: `
Generate a weekly macro & markets insight for advanced finance students.
The date today is ${todayStr}.

Return STRICT JSON with this structure:
{
  "title": "short headline for the week",
  "summary": "2-3 sentence recap of the week (macro + markets) in French",
  "macro": [
    { "title": "inflation / banks / policy point", "detail": "2-3 lines in French" },
    { "title": "growth / employment / activity point", "detail": "2-3 lines in French" }
  ],
  "markets": [
    { "title": "Equities", "detail": "2-3 lines in French" },
    { "title": "Rates / FX / Commodities", "detail": "2-3 lines in French" }
  ],
  "sectors": [
    { "title": "Sector or theme 1", "detail": "2-3 lines in French" },
    { "title": "Sector or theme 2", "detail": "2-3 lines in French" }
  ],
  "focus": "2-4 lines of actionable takeaways for EDB Plus members, in French"
}
No extra text, no comments, only JSON.
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
      focus = "",
    } = parsed;

    // 🗓 weekOf = lundi de la semaine courante (pour faire propre)
    const weekOf = new Date(today);
    const day = weekOf.getDay(); // 0=dimanche
    const diff = (day === 0 ? -6 : 1) - day; // aller au lundi
    weekOf.setDate(weekOf.getDate() + diff);
    weekOf.setHours(0, 0, 0, 0);

    const insight = await prisma.weeklyInsight.create({
      data: {
        weekOf,
        title: String(title).slice(0, 200),
        summary: String(summary),
        focus: focus ? String(focus) : null,
        macroJson: macro,
        marketsJson: markets,
        sectorsJson: sectors,
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