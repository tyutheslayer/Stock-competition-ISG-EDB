// pages/api/plus/dev-unlock.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { grantPlusByEmail } from "../../../lib/plus";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthenticated" });

    await grantPlusByEmail(email);
    return res.status(200).json({ ok: true, status: "active" });
  } catch (e) {
    console.error("[plus/dev-unlock] fatal:", e);
    return res.status(500).json({ error: "UNLOCK_FAILED" });
  }
}