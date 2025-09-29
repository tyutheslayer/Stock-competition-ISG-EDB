// pages/api/plus/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getPlusStatusByEmail } from "../../../lib/plus";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(200).json({ status: "none", since: null });

    const out = await getPlusStatusByEmail(session.user.email);
    return res.json(out);
  } catch (e) {
    console.error("[plus/status] fatal:", e);
    return res.status(200).json({ status: "none", since: null });
  }
}