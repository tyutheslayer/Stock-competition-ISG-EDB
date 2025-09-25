// lib/sumup.js
import prisma from "./prisma";

const TOKEN_KEY = "SUMUP_OAUTH";

function parseStore(row) {
  if (!row) return null;
  try { return JSON.parse(row.identifier || "{}"); } catch { return null; }
}

async function saveTokens(payload, expiresMs) {
  const expires = new Date(Date.now() + expiresMs);
  await prisma.verificationToken.upsert({
    where: { token: TOKEN_KEY },
    update: { identifier: JSON.stringify(payload), expires },
    create: { token: TOKEN_KEY, identifier: JSON.stringify(payload), expires },
  });
}

export async function getSumUpAccessToken() {
  const row = await prisma.verificationToken.findUnique({ where: { token: TOKEN_KEY } });
  const data = parseStore(row);
  if (!data?.access_token) return null;

  const ageMs = Date.now() - (Number(data.obtained_at) || 0);
  const ttlMs = (Number(data.expires_in) || 3600) * 1000;
  const nearExpiry = ageMs > ttlMs - 120000; // refresh si < 2min restantes

  if (!nearExpiry) return data.access_token;

  // Refresh
  const { SUMUP_CLIENT_ID, SUMUP_CLIENT_SECRET } = process.env;
  if (!data.refresh_token || !SUMUP_CLIENT_ID || !SUMUP_CLIENT_SECRET) return data.access_token;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: data.refresh_token,
    client_id: SUMUP_CLIENT_ID,
    client_secret: SUMUP_CLIENT_SECRET,
  });

  const r = await fetch("https://api.sumup.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) {
    // Retourne l’ancien token (peut encore marcher quelques secondes)
    return data.access_token;
  }

  const j = await r.json();
  const payload = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || data.refresh_token,
    token_type: j.token_type || data.token_type,
    scope: j.scope || data.scope,
    obtained_at: Date.now(),
    expires_in: j.expires_in || 3600,
  };
  await saveTokens(payload, Math.max(300000, (Number(j.expires_in) || 3600) * 1000));
  return payload.access_token;
}