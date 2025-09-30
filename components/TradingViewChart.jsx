// components/TradingViewChart.jsx
import { useEffect, useRef, useState, useId } from "react";

/** Charge le script tv.js une seule fois (mise en cache globale) */
function loadTradingViewScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.TradingView) return Promise.resolve(true);
  if (window.__tvLoading) return window.__tvLoading;

  window.__tvLoading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return window.__tvLoading;
}

/** Mappage simple de symboles communs -> format TradingView */
function toTradingViewSymbol(rawSymbol) {
  if (!rawSymbol) return "AAPL";

  const sym = String(rawSymbol).toUpperCase().trim();

  // Ex: AIR.PA -> EURONEXT:AIR
  if (sym.endsWith(".PA")) {
    const base = sym.replace(".PA", "");
    return `EURONEXT:${base}`;
  }

  // Ex: .BR (Bruxelles) -> EURONEXT:BASE
  if (sym.endsWith(".BR")) {
    const base = sym.replace(".BR", "");
    return `EURONEXT:${base}`;
  }

  // Ex: .DE -> XETR:BASE
  if (sym.endsWith(".DE")) {
    const base = sym.replace(".DE", "");
    return `XETR:${base}`;
  }

  // fallback US / inconnu : TradingView sait souvent résoudre directement
  return sym;
}

/**
 * TradingView Advanced Chart (bougies)
 * - autosize, thème dark, locale FR
 */
export default function TradingViewChart({
  symbol,
  interval = "D",
  height = 480,
  theme = "dark",
}) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const containerId = useId().replace(/:/g, "_"); // id stable & valide

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await loadTradingViewScript();
      if (alive) setReady(ok);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.TradingView) return;

    // Nettoie le conteneur (évite d’empiler les widgets au changement de symbole)
    containerRef.current.innerHTML = "";

    const tvSymbol = toTradingViewSymbol(symbol);

    // Instancie le widget
    // Doc: https://www.tradingview.com/widget/advanced-chart/
    // NB: autosize + container_id DOIT pointer sur un element présent dans le DOM
    // au moment de l’appel.
    // On utilise un div interne avec id stable pour être sûr.
    const options = {
      container_id: `${containerId}__tv`,
      symbol: tvSymbol,
      interval,
      autosize: true,
      timezone: "Europe/Paris",
      theme,
      style: "1", // 1 = bougies
      locale: "fr",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      studies: [], // tu pourras ajouter des indicateurs plus tard (ex: "MACD@tv-basicstudies")
    };

    // Crée le div interne attendu par TradingView
    const inner = document.createElement("div");
    inner.id = options.container_id;
    inner.style.width = "100%";
    inner.style.height = "100%";
    containerRef.current.appendChild(inner);

    // eslint-disable-next-line no-new
    new window.TradingView.widget(options);

    // Pas de cleanup spécifique fourni par TV; on vide le container au unmount
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [ready, symbol, interval, theme, containerId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(148,163,184,.25)",
      }}
    />
  );
}