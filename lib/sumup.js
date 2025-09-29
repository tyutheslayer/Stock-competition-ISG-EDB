// lib/sumup.js
const API = process.env.SUMUP_API_BASE || "https://api.sumup.com";

// --------- Token helpers (simple/env). En prod, stocke en DB.
function getInMemoryTokens() {
  return {
    access: process.env.SUMUP_ACCESS_TOKEN || null,
    refresh: process.env.SUMUP_REFRESH_TOKEN || null,
  };
}
function setInMemoryAccessToken(newAccess) {
  // En Vercel, on ne peut pas réécrire les env à chaud; on laisse tel quel.
  // Si tu veux persister: crée un modèle Prisma (OAuthToken) et sauvegarde.
  return newAccess;
}

// --------- OAuth exchange
export async function tokenFromCode({ code, redirectUri }) {
  const id = process.env.SUMUP_CLIENT_ID;
  const secret = process.env.SUMUP_CLIENT_SECRET;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  let r = await fetch(`${API}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!r.ok) {
    r = await fetch(`${API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: id,
        client_secret: secret,
      }).toString(),
    });
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`SumUp token failed (${r.status}): ${t}`);
  }
  return r.json();
}

async function refreshAccessToken() {
  const id = process.env.SUMUP_CLIENT_ID;
  const secret = process.env.SUMUP_CLIENT_SECRET;
  const { refresh } = getInMemoryTokens();
  if (!refresh) throw new Error("NO_REFRESH_TOKEN");

  const resp = await fetch(`${API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: id,
      client_secret: secret,
    }).toString(),
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error("REFRESH_FAILED");
    err.detail = j;
    throw err;
  }
  setInMemoryAccessToken(j.access_token);
  return j;
}

async function withBearerFetch(url, init = {}) {
  let { access } = getInMemoryTokens();
  if (!access) throw new Error("NO_ACCESS_TOKEN");

  let r = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${access}` },
  });

  // Si token expiré → on tente un refresh une fois
  if (r.status === 401) {
    const j = await refreshAccessToken().catch(() => null);
    if (j?.access_token) {
      access = j.access_token;
      r = await fetch(url, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${access}` },
      });
    }
  }
  return r;
}

// --------- Create checkout (nécessite scope checkout/payments)
export async function createCheckout({ amount, currency = "EUR", description, returnUrl, reference }) {
  const payTo = process.env.SUMUP_PAY_TO_EMAIL;
  if (!payTo) {
    const e = new Error("MISSING_SUMUP_PAY_TO_EMAIL");
    e.hint = "Définis SUMUP_PAY_TO_EMAIL (e-mail marchand recevant le paiement).";
    throw e;
  }

  const r = await withBearerFetch(`${API}/v0.1/checkouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Number(amount),
      currency,
      pay_to_email: payTo,
      description: description || "EDB Plus",
      checkout_reference: reference,
      redirect_url: returnUrl,
    }),
  });

  const j = await r.json().catch(() => ({}));

  if (r.status === 403) {
    const e = new Error("INSUFFICIENT_SCOPE");
    e.detail = j;
    e.hint = "Demande à SumUp d’activer les scopes checkout/payments pour ton application.";
    throw e;
  }
  if (!r.ok) {
    const e = new Error(`CREATE_CHECKOUT_FAILED_${r.status}`);
    e.detail = j;
    throw e;
  }
  return j; // ↩︎ devrait contenir { id, checkout_url, ... }
}

// --------- Get checkout (statut)
export async function getCheckout(checkoutId) {
  const r = await withBearerFetch(`${API}/v0.1/checkouts/${encodeURIComponent(checkoutId)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`GET_CHECKOUT_FAILED_${r.status}`);
    e.detail = j;
    throw e;
  }
  return j;
}