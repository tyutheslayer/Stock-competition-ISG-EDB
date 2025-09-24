// lib/sumup.js
import prisma from "./prisma";

const SUMUP_BASE = "https://api.sumup.com";

function nowSec() { return Math.floor(Date.now() / 1000); }

export async function getStoredCreds() {
  const row = await prisma.sumupCreds.findUnique({ where: { id: 1 } });
  return row || {};
}

export async function saveCreds({ access_token, refresh_token, expires_in }) {
  const expiresAt = new Date(Date.now() + (Number(expires_in || 0) * 1000));
  await prisma.sumupCreds.upsert({
    where: { id: 1 },
    update: {
      accessToken: access_token || null,
      refreshToken: refresh_token || null,
      expiresAt,
    },
    create: {
      id: 1,
      accessToken: access_token || null,
      refreshToken: refresh_token || null,
      expiresAt,
    },
  });
}

export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.SUMUP_REDIRECT_URI,
    client_id: process.env.SUMUP_CLIENT_ID,
    client_secret: process.env.SUMUP_CLIENT_SECRET,
  });

  const r = await fetch(`${SUMUP_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error("oauth_exchange_failed");
  const j = await r.json();
  await saveCreds(j);
  return j;
}

export async function refreshAccessToken() {
  const creds = await getStoredCreds();
  if (!creds?.refreshToken) throw new Error("no_refresh_token");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
    client_id: process.env.SUMUP_CLIENT_ID,
    client_secret: process.env.SUMUP_CLIENT_SECRET,
  });

  const r = await fetch(`${SUMUP_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error("refresh_failed");
  const j = await r.json();
  await saveCreds(j);
  return j;
}

export async function getAccessToken() {
  const creds = await getStoredCreds();
  const exp = creds?.expiresAt ? Math.floor(new Date(creds.expiresAt).getTime() / 1000) : 0;
  if (creds?.accessToken && exp > nowSec() + 60) return creds.accessToken;
  const j = await refreshAccessToken();
  return j.access_token;
}

async function apiGET(path) {
  const token = await getAccessToken();
  const r = await fetch(`${SUMUP_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`sumup_get_${r.status}`);
  return r.json();
}

async function apiPOST(path, body) {
  const token = await getAccessToken();
  const r = await fetch(`${SUMUP_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`sumup_post_${r.status}_${t}`);
  }
  return r.json();
}

/** Crée un checkout SumUp et renvoie { id, checkout_url } */
export async function createCheckout({ amountEUR, description, redirectURL, checkoutRef }) {
  const payload = {
    amount: Number(amountEUR.toFixed(2)),
    currency: "EUR",
    pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
    description,
    checkout_reference: checkoutRef,     // pour retrouver facilement
    redirect_url: redirectURL,           // après paiement
  };
  const j = await apiPOST(`/v0.1/checkouts`, payload);
  return j; // contient id, checkout_url, etc.
}

/** Récupère un checkout et son statut */
export async function getCheckout(id) {
  return apiGET(`/v0.1/checkouts/${encodeURIComponent(id)}`);
}