import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, name: true }
    });
    const map = {};
    for (const u of users) {
      map[u.email] = u.name || null;
    }
    // cache CDN léger
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: "names endpoint error" });
  }
}
