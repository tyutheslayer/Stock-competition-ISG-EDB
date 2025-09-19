// pages/api/_debug-events.js
import prisma from "../../lib/prisma";
import url from "url";

export default async function handler(req, res) {
  try {
    const dbUrl = process.env.DATABASE_URL || "";
    const parsed = dbUrl ? url.parse(dbUrl) : {};
    const host = parsed.host || "";
    const dbname = (parsed.pathname || "").replace(/^\//, "");
    const user = (parsed.auth || "").split(":")[0] || "";

    // Compter et montrer quelques lignes
    const count = await prisma.event.count();
    const sample = await prisma.event.findMany({
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, title: true, startsAt: true, endsAt: true, type: true, visibility: true }
    });

    res.status(200).json({
      env: {
        node: process.version,
        database_url_host: host,
        database_name: dbname,
        database_user: user,
      },
      counts: {
        events: count,
      },
      sample
    });
  } catch (e) {
    console.error("[_debug-events] fatal:", e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}