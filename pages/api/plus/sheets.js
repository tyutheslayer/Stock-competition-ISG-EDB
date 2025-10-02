// pages/api/plus/sheets.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { list, del } from "@vercel/blob";

function deriveMetaFromKey(key, prefix = "plus-sheets/") {
  const nameWithTs = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  // 1727859123456_filename.pdf
  const m = nameWithTs.match(/^(\d{10,})_(.+)$/);
  const ts = m ? Number(m[1]) : NaN;
  const filename = m ? m[2] : nameWithTs;
  const title = filename.replace(/\.pdf$/i, "").replace(/_/g, " ");
  const createdAt = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  return { title, filename, createdAt };
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "content-type");
      return res.status(200).end();
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: "UNAUTH" });

    // Accès membres Plus (ou Admin)
    const isAdmin = session.user.role === "ADMIN" || session.user.isAdmin === true;
    const isPlus = session.user.plusStatus === "active"; // si non présent dans le token, la page fera déjà le garde-fou
    if (!isAdmin && !isPlus) return res.status(403).json({ error: "PLUS_REQUIRED" });

    const prefix = "plus-sheets/";

    if (req.method === "GET") {
      const out = await list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN });
      const items = (out?.blobs || []).map((b) => {
        const meta = deriveMetaFromKey(b.pathname, prefix);
        return {
          id: b.pathname,                 // ← utilisé comme key côté UI
          title: meta.title,
          createdAt: meta.createdAt || b.uploadedAt || null,
          url: b.url,
          size: b.size,
        };
      });
      // tri par date desc
      items.sort((a, b) => (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      return res.status(200).json(items);
    }

    if (req.method === "DELETE") {
      if (!isAdmin) return res.status(403).json({ error: "ADMIN_ONLY" });
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "KEY_REQUIRED" });
      await del(String(key), { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    if (e?.code === "MODULE_NOT_FOUND") {
      return res.status(500).json({ error: "BLOB_MODULE_MISSING" });
    }
    console.error("[plus/sheets] fail:", e);
    return res.status(500).json({ error: "LIST_FAILED", detail: String(e?.message || e) });
  }
}