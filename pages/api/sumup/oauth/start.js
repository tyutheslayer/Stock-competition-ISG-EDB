// pages/api/sumup/oauth/start.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

const BASE = process.env.SUMUP_API_BASE || "https://api.sumup.com";
const REDIRECT = process.env.SUMUP_REDIRECT_URI || "https://edb-project.org/api/sumup/oauth/callback";
const SCOPES = (process.env.SUMUP_SCOPES || "profile transactions.history").trim();

function randomState(len = 24) {
  const abc = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: len }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
}

export default async function handler(req, res) {
  try {
    // 👉 Oblige l’authentification
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.redirect(302, "/login?callback=/plus");
    }

    const { SUMUP_CLIENT_ID } = process.env;
    if (!SUMUP_CLIENT_ID) return res.status(500).json({ error: "MISSING_CLIENT_ID" });

    const state = randomState();
    res.setHeader("Set-Cookie", `sumup_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

    const url = new URL(`${BASE}/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", SUMUP_CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);

    return res.redirect(url.toString());
  } catch (e) {
    console.error("[sumup][start] fatal", e);
    return res.status(500).json({ error: "OAUTH_START_FAILED" });
  }
}