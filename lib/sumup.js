// lib/sumup.js
import prisma from "./prisma";

const SUMUP_AUTH = "https://api.sumup.com/authorize";
const SUMUP_TOKEN = "https://api.sumup.com/token";
const SUMUP_API   = process.env.SUMUP_API_BASE || process.env.SUMUP_BASE_URL || "https://api.sumup.com";

// Clés KV dans VerificationToken
const K_ACCESS  = "SUMUP:ACCESS_TOKEN";
const K_REFRESH = "SUMUP:REFRESH_TOKEN";
const K_EXPIRES = "SUMUP:EXPIRES_AT"; // ISO string

function getConfig() {
  const {
    SUMUP_CLIENT_ID,
    SUMUP_CLIENT_SECRET,
    SUMUP_REDIRECT_URI,
    SUMUP_MERCHANT_CODE,
    SUMUP_SCOPES,
  } = process.env;

  if (!SUMUP_CLIENT_ID || !SUMUP_CLIENT_SECRET || !SUMUP_REDIRECT_URI) {
    throw new Error("SUMUP CLIENT_ID/SECRET/REDIRECT_URI manquants");
  }
  // scopes par défaut suffisants pour notre cas
  const defaultScopes = "payments transactions.history user.app-settings";
  return {
    clientId: SUMUP_CLIENT_ID,
    clientSecret: SUMUP_CLIENT_SECRET,
    redirectUri: SUMUP_REDIRECT_URI,
    merchantCode: SUMUP_MERCHANT_CODE || undefined,
    scopes: (SUMUP_SCOPES || defaultScopes).trim(),
  };
}

/* ===== KV helpers via VerificationToken ===== */
async function kvSet(tokenKey, value, expires) {
  const identifier = typeof value === "string" ? value : JSON.stringify(value);
  await prisma.verificationToken.upsert({
    where: { token: tokenKey },
    update: { identifier, expires: expires ?? new Date(Date.now() + 365 * 24 * 3600 * 1000) },
    create: { token: tokenKey, identifier, expires: expires ?? new Date(Date.now() + 365 * 24 * 3600 * 1000) },
  });
}
async function kvGet(tokenKey) {
  const row = await prisma.verificationToken.findUnique({ where: { token: tokenKey } });
  return row?.identifier ?? null;
}

/* ===== OAuth helpers ===== */
export function getAuthUrl(state = "") {
  const { clientId, redirectUri, scopes } = getConfig();
  const url = new URL(SUMUP_AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

async function saveTokens({ access_token, refresh_token, expires_in }) {
  const expiresAt = new Date(Date.now() + Number(expires_in || 0) * 1000);
  await kvSet(K_ACCESS, access_token, expiresAt);
  if (refresh_token) await kvSet(K_REFRESH, refresh_token);
  await kvSet(K_EXPIRES, expiresAt.toISOString(), expiresAt);
}

export async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const r = await fetch(SUMUP_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error("Token exchange failed: " + txt);
  }
  const j = await r.json();
  await saveTokens(j);
  return j;
}

async function refreshTokens() {
  const { clientId, clientSecret } = getConfig();
  const refresh_token = await kvGet(K_REFRESH);
  if (!refresh_token) throw new Error("Pas de refresh_token SumUp");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refresh_token);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const r = await fetch(SUMUP_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error("Refresh token failed: " + txt);
  }
  const j = await r.json();
  await saveTokens(j);
  return j;
}

export async function getAccessToken() {
  const token = await kvGet(K_ACCESS);
  const expires = await kvGet(K_EXPIRES);
  const exp = expires ? new Date(expires).getTime() : 0;
  if (token && exp > Date.now() + 30 * 1000) return token;
  const j = await refreshTokens();
  return j.access_token;
}

/* ===== Checkout ===== */
export async function createCheckout({ amount, currency = "EUR", description = "EDB Plus — 1 mois", return_url }) {
  const access = await getAccessToken();
  const { merchantCode } = getConfig();

  const payload = {
    amount: Number(amount),
    currency,
    description,
    ...(merchantCode ? { merchant_code: merchantCode } : {}),
    return_url,
  };

  const r = await fetch(`${SUMUP_API}/v0.1/checkouts`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("SumUp create checkout failed: " + JSON.stringify(j));
  return j; // { id, checkout_url, status, ... }
}

export async function getCheckout(id) {
  const access = await getAccessToken();
  const r = await fetch(`${SUMUP_API}/v0.1/checkouts/${encodeURIComponent(id)}`, {
    headers: { "Authorization": `Bearer ${access}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("SumUp get checkout failed: " + JSON.stringify(j));
  return j;
}