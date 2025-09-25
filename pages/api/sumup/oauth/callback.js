// pages/api/sumup/oauth/callback.js
import prisma from "../../../../lib/prisma";

async function exchangeCode({ code, redirectUri }) {
  const { SUMUP_CLIENT_ID, SUMUP_CLIENT_SECRET } = process.env;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: SUMUP_CLIENT_ID,
    client_secret: SUMUP_CLIENT_SECRET,
    redirect_uri: redirectUri,
  });

  const r = await fetch("https://api.sumup.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Token exchange failed: HTTP ${r.status} ${txt}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Méthode non supportée" });
      return;
    }

    const { SUMUP_REDIRECT_URI } = process.env;
    if (!SUMUP_REDIRECT_URI) {
      res.status(500).json({ error: "ENV_INCOMPLETE", detail: "SUMUP_REDIRECT_URI manquant" });
      return;
    }

    const { code, state } = req.query || {};
    if (!code || !state) {
      res.status(400).json({ error: "MISSING_PARAMS" });
      return;
    }

    // Vérifie le state (anti-CSRF)
    const cookieState = (req.headers.cookie || "")
      .split(";")
      .map(s => s.trim())
      .find(s => s.startsWith("sumup_oauth_state="))
      ?.split("=")[1];

    if (!cookieState || cookieState !== state) {
      res.status(400).json({ error: "BAD_STATE" });
      return;
    }

    // Échange code -> tokens
    const tokens = await exchangeCode({ code, redirectUri: SUMUP_REDIRECT_URI });

    // Persistons dans VerificationToken (déjà présent dans ton schéma)
    // token = clé fixe; identifier = JSON sérialisé; expires = prochain refresh conseillé
    const payload = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      scope: tokens.scope,
      // expires_in en secondes (généralement 3600)
      obtained_at: Date.now(),
      expires_in: tokens.expires_in,
    };

    const expires = new Date(Date.now() + Math.max(300000, (Number(tokens.expires_in) || 3600) * 1000)); // garde-fou min 5min

    await prisma.verificationToken.upsert({
      where: { token: "SUMUP_OAUTH" },
      update: { identifier: JSON.stringify(payload), expires },
      create: { token: "SUMUP_OAUTH", identifier: JSON.stringify(payload), expires },
    });

    // Redirige vers une page “succès” (ou renvoie JSON)
    res.writeHead(302, { Location: "/plus?connected=sumup" });
    res.end();
  } catch (e) {
    console.error("[sumup][callback] fatal:", e);
    res.status(500).json({ error: "INTERNAL", detail: e.message });
  }
}