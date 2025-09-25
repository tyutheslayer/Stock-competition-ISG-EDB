// pages/api/sumup/oauth/start.js
import crypto from "node:crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Méthode non supportée" });
      return;
    }

    const {
      SUMUP_CLIENT_ID,
      SUMUP_REDIRECT_URI, // ex: https://edb-project.org/api/sumup/oauth/callback
    } = process.env;

    if (!SUMUP_CLIENT_ID || !SUMUP_REDIRECT_URI) {
      res.status(500).json({ error: "ENV_INCOMPLETE", detail: "SUMUP_CLIENT_ID / SUMUP_REDIRECT_URI manquants" });
      return;
    }

    // CSRF state
    const state = crypto.randomBytes(16).toString("hex");
    const cookie = [
      `sumup_oauth_state=${state}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=600",
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ].filter(Boolean).join("; ");

    res.setHeader("Set-Cookie", cookie);

    // Scopes minimums pour liens de paiement + lecture paiements
    const scope = encodeURIComponent("payments user.app-settings");
    const redirectUri = encodeURIComponent(SUMUP_REDIRECT_URI);

    const authorizeUrl =
      `https://api.sumup.com/authorize?response_type=code` +
      `&client_id=${encodeURIComponent(SUMUP_CLIENT_ID)}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=${scope}` +
      `&state=${state}`;

    res.writeHead(302, { Location: authorizeUrl });
    res.end();
  } catch (e) {
    console.error("[sumup][start] fatal:", e);
    res.status(500).json({ error: "INTERNAL" });
  }
}