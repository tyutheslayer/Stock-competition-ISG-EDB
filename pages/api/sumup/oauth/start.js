// pages/api/sumup/oauth/start.js

const BASE = process.env.SUMUP_API_BASE || "https://api.sumup.com";
const REDIRECT = process.env.SUMUP_REDIRECT_URI || "https://edb-project.org/api/sumup/oauth/callback";
const SCOPES = (process.env.SUMUP_SCOPES || "profile transactions.history").trim();

function randomState(len = 24) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export default async function handler(req, res) {
  try {
    const { SUMUP_CLIENT_ID } = process.env;
    if (!SUMUP_CLIENT_ID) {
      return res.status(500).json({ error: "MISSING_CLIENT_ID" });
    }

    // CSRF protection via state cookie
    const state = randomState();
    res.setHeader(
      "Set-Cookie",
      `sumup_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );

    const url = new URL(`${BASE}/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", SUMUP_CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    // If SumUp supports it, this can help re-prompt: url.searchParams.set("prompt", "consent");

    // Helpful for debugging from server logs
    console.log("[sumup][start] redirect ->", url.toString(), "scopes=", SCOPES);

    res.redirect(url.toString());
  } catch (e) {
    console.error("[sumup][start][fatal]", e);
    res.status(500).json({ error: "OAUTH_START_FAILED", detail: String(e?.message || e) });
  }
}