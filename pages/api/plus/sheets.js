// pages/api/plus/sheets.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { list, del } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: "UNAUTH" });
    if (session.user.role !== "ADMIN" && session.user.plusStatus !== "active") {
      return res.status(403).json({ error: "PLUS_REQUIRED" });
    }

    if (req.method === "GET") {
      const prefix = "plus-sheets/";
      const out = await list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN });
      // normalise
      const items = (out?.blobs || []).map(b => ({
        key: b.pathname,
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt || null,
        name: b.pathname.replace(prefix, ""),
      }));
      return res.status(200).json(items);
    }

    if (req.method === "DELETE") {
      if (session.user.role !== "ADMIN") return res.status(403).json({ error: "ADMIN_ONLY" });
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "KEY_REQUIRED" });
      await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    if (e?.code === "MODULE_NOT_FOUND") {
      return res.status(500).json({ error: "BLOB_MODULE_MISSING" });
    }
    if (String(e?.message || e).includes("No such file or directory")) {
      // Ancienne erreur de mkdir public → on n’utilise plus le FS local
      return res.status(500).json({ error: "BLOB_RUNTIME_ERROR", detail: "Blob store not reachable" });
    }
    console.error("[plus/sheets] fail:", e);
    return res.status(500).json({ error: "LIST_FAILED", detail: String(e?.message || e) });
  }
}