// pages/api/sumup/oauth/callback.js
// Reçoit ?code=... de SumUp, échange contre un access_token

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Méthode non supportée" });
    }

    const { code, state, error, error_description } = req.query || {};

    if (error) {
      console.error("[sumup][callback] error:", error, error_description);
      return res.status(400).send("OAuth error: " + error);
    }
    if (!code) {
      return res.status(400).send("Missing code");
    }

    // Vérification du state (si cookie présent)
    try {
      const cookie = req.headers.cookie || "";
      const m = cookie.match(/(?:^|;\s*)sumup_state=([^;]+)/);
      const expectedState = m ? decodeURIComponent(m[1]) : null;
      if (!expectedState || expectedState !== state) {
        return res.status(400).send("Invalid state");
      }
    } catch {
      // si souci cookie, on peut continuer, mais c'est mieux de strictement vérifier
    }

    const base = process.env.SUMUP_BASE_URL || "https://api.sumup.com";
    const tokenUrl = `${base}/token`;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.SUMUP_REDIRECT_URI,
      client_id: process.env.SUMUP_CLIENT_ID,
      client_secret: process.env.SUMUP_CLIENT_SECRET,
    });

    const r = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const tok = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[sumup][token] http", r.status, tok);
      return res.status(400).send("Token exchange failed");
    }

    // tok = { access_token, token_type, refresh_token?, expires_in, scope, ... }
    // TODO: stocker l’access_token côté serveur (DB/Settings) selon votre logique.
    // Ex: await prisma.settings.update({ where: { id: 1 }, data: { sumupAccessToken: tok.access_token } });

    // Redirection vers la page Plus, avec un flag de succès
    return res.redirect(302, "/plus?connected=sumup");
  } catch (e) {
    console.error("[sumup][callback] fatal:", e);
    return res.status(500).send("Callback failed");
  }
}