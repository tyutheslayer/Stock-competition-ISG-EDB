// pages/api/sumup/oauth/callback.js

const BASE = process.env.SUMUP_API_BASE || "https://api.sumup.com";
const REDIRECT = process.env.SUMUP_REDIRECT_URI || "https://edb-project.org/api/sumup/oauth/callback";

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(/;\s*/).map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const [k, ...rest] = p.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const { code, state, error, error_description } = req.query || {};
    if (error) return res.status(400).json({ error, error_description });

    if (!code) return res.status(400).json({ error: "MISSING_CODE" });

    // Validate state
    const expected = readCookie(req, "sumup_oauth_state");
    if (!expected || expected !== state) {
      return res.status(400).json({ error: "STATE_MISMATCH" });
    }
    // clear the cookie
    res.setHeader("Set-Cookie", "sumup_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");

    const { SUMUP_CLIENT_ID, SUMUP_CLIENT_SECRET } = process.env;
    if (!SUMUP_CLIENT_ID || !SUMUP_CLIENT_SECRET) {
      return res.status(500).json({ error: "MISSING_CLIENT_CREDS" });
    }

    // --- 1) Try token exchange with HTTP Basic (recommended) ---
    const basic = Buffer.from(`${SUMUP_CLIENT_ID}:${SUMUP_CLIENT_SECRET}`).toString("base64");
    let r = await fetch(`${BASE}/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
      }).toString(),
    });

    let text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!r.ok) {
      console.warn("[sumup][callback] Basic exchange failed:", r.status, json);

      // --- 2) Fallback: put client creds in the body (some servers expect this) ---
      r = await fetch(`${BASE}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT,
          client_id: SUMUP_CLIENT_ID,
          client_secret: SUMUP_CLIENT_SECRET,
        }).toString(),
      });

      text = await r.text();
      try { json = JSON.parse(text); } catch { json = { raw: text }; }

      if (!r.ok) {
        console.error("[sumup][callback] Body exchange failed:", r.status, json);
        // Show everything so we know *exactly* why it fails
        return res.status(400).json({
          error: "TOKEN_EXCHANGE_FAILED",
          status: r.status,
          details: json,
          hint:
            "Vérifie le Client ID/Secret, la Redirect URL (doit matcher EXACTEMENT), et les scopes autorisés dans l’app.",
        });
      }
    }

    // Success: return tokens (dev mode)
    // You’ll see: access_token, token_type, expires_in, scope, refresh_token (si donné)
    console.log("[sumup][callback] token OK scopes=", json?.scope);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).end(JSON.stringify(json, null, 2));

    // Quand tout est OK, remplace l’envoi JSON par une redirection vers /plus :
    // res.redirect("/plus?connected=sumup=1");
  } catch (e) {
    console.error("[sumup][callback][fatal]", e);
    res.status(500).json({ error: "OAUTH_CALLBACK_FAILED", detail: String(e?.message || e) });
  }
}