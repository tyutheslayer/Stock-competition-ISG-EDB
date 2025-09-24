// pages/api/sumup/oauth/callback.js
import { exchangeCodeForTokens } from "../../../../lib/sumup";

export default async function handler(req, res) {
  try {
    const { code, error } = req.query;
    if (error) return res.status(400).send("OAuth error: " + error);
    if (!code) return res.status(400).send("Missing code");

    await exchangeCodeForTokens(code);
    // Retour vers une page d’admin simple
    res.redirect("/plus?oauth=ok");
  } catch (e) {
    console.error("[sumup][oauth][callback] ", e);
    res.status(500).send("OAuth failed");
  }
}