// 5) Prix actuels EUR (via cache, avec fallback Yahoo direct)
const priceEurBySymbol = {};
const ccyBySymbol = {};
for (const s of symbols) {
  try {
    // 1) cache
    const q = await getQuoteRaw(s); // { price, currency }
    let px = Number(q?.price ?? 0);
    let ccy = q?.currency || "EUR";

    // 2) fallback si le cache n’a pas de prix exploitable
    if (!(px > 0)) {
      const yq = await yahooFinance.quote(s);
      px =
        Number(yq?.regularMarketPrice) ||
        Number(yq?.postMarketPrice) ||
        Number(yq?.preMarketPrice) ||
        0;
      ccy = yq?.currency || ccy;
    }

    const rate = await getFxToEUR(ccy);
    ccyBySymbol[s] = ccy;
    priceEurBySymbol[s] = (px > 0 ? px : 0) * (Number(rate) || 1);
  } catch (e) {
    logError?.("leaderboard_quote", e);
    ccyBySymbol[s] = "EUR";
    priceEurBySymbol[s] = 0;
  }
}