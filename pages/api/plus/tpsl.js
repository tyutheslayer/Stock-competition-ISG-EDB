// pages/api/plus/tpsl.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

/**
 * Stub TP/SL — accepte la configuration depuis l’UI et répond ok:true.
 * À remplacer plus tard par une vraie persistance + automation serveur.
 */
export default async function handler(req, res) {
  try {
    const method = (req.method || "POST").toUpperCase();
    if (!["POST", "PUT", "DELETE", "GET"].includes(method)) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    // GET peut lister plus tard les règles enregistrées (on renvoie vide pour l’instant)
    if (method === "GET") {
      return res.status(200).json({ ok: true, rules: [] });
    }

    // Parse corp JSON
    let body = {};
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); } catch {}
    const {
      symbol,     // "AAPL", "TSLA", "AIR.PA" ...
      side,       // "LONG" | "SHORT"
      leverage,   // number
      quantity,   // number
      tp,         // take-profit (€/action), optionnel
      sl          // stop-loss   (€/action), optionnel
    } = body;

    // Validations minimales (pour éviter les mauvaises surprises côté UI)
    if (!symbol || typeof symbol !== "string") return res.status(400).json({ error: "SYMBOL_REQUIRED" });
    if (!["LONG","SHORT"].includes(String(side).toUpperCase())) return res.status(400).json({ error: "SIDE_INVALID" });
    if (!Number.isFinite(Number(leverage)) || Number(leverage) <= 0) return res.status(400).json({ error: "LEVERAGE_INVALID" });
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return res.status(400).json({ error: "QUANTITY_INVALID" });

    const tpNum = tp == null || tp === "" ? null : Number(tp);
    const slNum = sl == null || sl === "" ? null : Number(sl);
    if (tpNum != null && !Number.isFinite(tpNum)) return res.status(400).json({ error: "TP_INVALID" });
    if (slNum != null && !Number.isFinite(slNum)) return res.status(400).json({ error: "SL_INVALID" });

    // Pour l’instant : no-op + log serveur pour vérification
    console.log("[TP/SL] armed", {
      user: session.user.email,
      symbol, side, leverage: Number(leverage), quantity: Number(quantity),
      tp: tpNum, sl: slNum,
      at: new Date().toISOString(),
    });

    // Réponse OK pour débloquer l’UI
    return res.status(200).json({
      ok: true,
      armed: {
        symbol,
        side: String(side).toUpperCase(),
        leverage: Number(leverage),
        quantity: Number(quantity),
        tp: tpNum,
        sl: slNum,
      },
      note: "Stub: aucune persistance encore. On branchera l’automation plus tard."
    });
  } catch (e) {
    console.error("[/api/plus/tpsl] fatal:", e);
    return res.status(500).json({ error: "TPSL_FAILED", detail: String(e?.message || e) });
  }
}