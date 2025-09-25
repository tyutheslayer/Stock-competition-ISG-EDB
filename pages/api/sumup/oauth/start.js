// pages/api/sumup/oauth/start.js
export default async function handler(req, res) {
  try {
    const {
      SUMUP_CLIENT_ID,
      SUMUP_REDIRECT_URI = "https://edb-project.org/api/sumup/oauth/callback",
    } = process.env;

    if (!SUMUP_CLIENT_ID) {
      return res.status(500).json({ error: "Missing SUMUP_CLIENT_ID" });
    }

    const scopes = [
      "profile",
      "transactions.history",
      // ajoute d'autres scopes si ton app les a (ex: "checkout")
    ].join(" ");

    const authUrl = new URL("https://api.sumup.com/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", SUMUP_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", SUMUP_REDIRECT_URI);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", "sumup_oauth_state"); // simple démo

    res.redirect(authUrl.toString());
  } catch (e) {
    console.error("[sumup][oauth/start] fatal", e);
    res.status(500).json({ error: "OAuth start failed" });
  }
}