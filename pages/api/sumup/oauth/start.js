// pages/api/sumup/oauth/start.js
// Démarre l’OAuth2 vers SumUp (redirection vers /authorize)

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Méthode non supportée" });
    }

    const base = process.env.SUMUP_BASE_URL || "https://api.sumup.com";
    const clientId = process.env.SUMUP_CLIENT_ID;
    const redirectUri = process.env.SUMUP_REDIRECT_URI;
    const scope = process.env.SUMUP_SCOPES || "transactions.history profile email";

    if (!clientId || !redirectUri) {
      return res.status(500).json({ error: "SUMUP_OAUTH_NOT_CONFIGURED" });
    }

    // Anti-CSRF simple (optionnel mais recommandé)
    const state = Math.random().toString(36).slice(2);
    res.setHeader(
      "Set-Cookie",
      `sumup_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );

    const url = new URL(`${base}/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);

    return res.redirect(302, url.toString());
  } catch (e) {
    console.error("[sumup][start] fatal:", e);
    return res.status(500).json({ error: "OAUTH_START_FAILED" });
  }
}