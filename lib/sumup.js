// lib/sumup.js

const API = process.env.SUMUP_API_BASE || "https://api.sumup.com";

// Pour l’instant on lit le token en mémoire (renvoyé par /oauth/callback).
// En prod, tu stockeras access_token/refresh_token en DB (par ex. table OAuthTokens).
function getAccessToken() {
  // Option 1 (temporaire): tu peux coller un access_token à chaud dans une env si besoin
  // return process.env.SUMUP_ACCESS_TOKEN || null;
  // Option 2: on compte sur un token tout juste obtenu côté callback, qu'on t'affiche.
  // => Pour le moment on demande au dev de copier-coller dans SUMUP_ACCESS_TOKEN si utile.
  return process.env.SUMUP_ACCESS_TOKEN || null;
}

// --- OAuth: échange de code contre token (déjà fait dans /oauth/callback, gardé ici pour réutilisation)
export async function tokenFromCode({ code, redirectUri }) {
  const id = process.env.SUMUP_CLIENT_ID;
  const secret = process.env.SUMUP_CLIENT_SECRET;

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  // 1) Basic Auth
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
    // 2) Fallback body creds
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

// --- CREATE CHECKOUT (nécessite scope checkout/payments)
export async function createCheckout({ amount, currency = "EUR", description, returnUrl, reference }) {
  const token = getAccessToken();
  if (!token) {
    const err = new Error("NO_ACCESS_TOKEN");
    err.hint = "Récupère un access_token via /api/sumup/oauth/start -> callback, ou stocke-le en DB.";
    throw err;
  }

  const payTo = process.env.SUMUP_PAY_TO_EMAIL;
  if (!payTo) {
    const err = new Error("MISSING_SUMUP_PAY_TO_EMAIL");
    err.hint = "Renseigne SUMUP_PAY_TO_EMAIL (e-mail marchand recevant le paiement).";
    throw err;
  }

  // NB: les schémas changent selon les versions d’API chez SumUp.
  // Le plus courant (legacy) est /v0.1/checkouts:
  const r = await fetch(`${API}/v0.1/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(amount),
      currency,
      pay_to_email: payTo,
      description: description || "Commande",
      checkout_reference: reference,     // pour te repérer ensuite dans l’historique
      redirect_url: returnUrl,           // où SumUp retourne l’utilisateur
    }),
  });

  const j = await r.json().catch(() => ({}));

  if (r.status === 403) {
    const err = new Error("INSUFFICIENT_SCOPE");
    err.detail = j;
    err.hint =
      "Ton app n’a pas le scope d’écriture (checkout / payments). Demande l’accès à SumUp.";
    throw err;
  }
  if (!r.ok) {
    const err = new Error(`CREATE_CHECKOUT_FAILED_${r.status}`);
    err.detail = j;
    throw err;
  }

  // j devrait contenir un id + checkout_url
  return j;
}

// --- GET CHECKOUT (statut)
export async function getCheckout(checkoutId) {
  const token = getAccessToken();
  if (!token) throw new Error("NO_ACCESS_TOKEN");

  const r = await fetch(`${API}/v0.1/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(`GET_CHECKOUT_FAILED_${r.status}`);
    err.detail = j;
    throw err;
  }
  return j;
}

// --- READ TRANSACTIONS (utilisable tout de suite avec transactions.history)
export async function findLatestMatchingTransaction({ reference, minAmount = 20, currency = "EUR" }) {
  const token = getAccessToken();
  if (!token) throw new Error("NO_ACCESS_TOKEN");

  // Exemple d’endpoint courant (peut varier):
  // /v0.1/me/transactions ? order=descending & limit=50
  const url = new URL(`${API}/v0.1/me/transactions`);
  url.searchParams.set("order", "descending");
  url.searchParams.set("limit", "50");

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(`TX_LIST_FAILED_${r.status}`);
    err.detail = j;
    throw err;
  }

  // Filtre grossier: montant, devise, présence de la référence dans description / external_reference, etc.
  const list = Array.isArray(j?.items || j) ? (j.items || j) : [];
  return list.find((t) => {
    const amountOk = Number(t?.amount) >= minAmount && (t?.currency || "").toUpperCase() === currency;
    const blob = `${t?.description || ""} ${t?.external_reference || ""} ${t?.id || ""}`.toLowerCase();
    return amountOk && blob.includes(String(reference).toLowerCase());
  }) || null;
}