// lib/sumup.js
// Petites helpers + stubs pour éviter les erreurs de build tant que l’accès API SumUp n’est pas activé.

const BASE = process.env.SUMUP_API_BASE || "https://api.sumup.com";

/**
 * Échange un code OAuth contre un access_token.
 * Utilisé par /api/sumup/oauth/callback.js (si présent).
 */
export async function tokenFromCode({ code, redirectUri }) {
  const clientId = process.env.SUMUP_CLIENT_ID;
  const clientSecret = process.env.SUMUP_CLIENT_SECRET;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const r = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`SumUp token failed (${r.status}): ${t}`);
  }
  return r.json();
}

/**
 * Placeholder : création d’un checkout. À implémenter quand l’API est activée.
 * On expose la signature attendue pour éviter les erreurs d’import côté API routes.
 */
export async function createCheckout(_params) {
  throw new Error(
    "SumUp createCheckout: API non configurée/activée. Voir la doc d’intégration."
  );
}

/**
 * Placeholder : récupération d’un checkout.
 */
export async function getCheckout(_params) {
  throw new Error(
    "SumUp getCheckout: API non configurée/activée. Voir la doc d’intégration."
  );
}