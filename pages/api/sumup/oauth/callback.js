// pages/api/sumup/oauth/callback.js
export default async function handler(req, res) {
  try {
    const { code, error, error_description } = req.query;
    if (error) {
      return res.status(400).json({ error, error_description });
    }
    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    const {
      SUMUP_CLIENT_ID,
      SUMUP_CLIENT_SECRET,
      SUMUP_REDIRECT_URI = "https://edb-project.org/api/sumup/oauth/callback",
    } = process.env;

    if (!SUMUP_CLIENT_ID || !SUMUP_CLIENT_SECRET) {
      return res.status(500).json({ error: "Missing client credentials" });
    }

    // Échange du code contre le token
    const r = await fetch("https://api.sumup.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SUMUP_REDIRECT_URI,
        client_id: SUMUP_CLIENT_ID,
        client_secret: SUMUP_CLIENT_SECRET,
      }).toString(),
    });

    const j = await r.json();
    if (!r.ok) {
      return res.status(400).json({ error: "token_exchange_failed", detail: j });
    }

    // 🔎 MODE DEBUG: on AFFICHE le JSON pour que tu copies les valeurs
    // Tu verras: access_token, refresh_token, expires_in, scope, token_type
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).end(JSON.stringify(j, null, 2));

    // 💡 Quand tu n'as plus besoin d’afficher, tu peux remplacer
    // le bloc ci-dessus par une redirection :
    //
    // res.redirect("/plus?connected=sumup=1");
  } catch (e) {
    console.error("[sumup][oauth/callback] fatal", e);
    res.status(500).json({ error: "OAuth callback failed" });
  }
}