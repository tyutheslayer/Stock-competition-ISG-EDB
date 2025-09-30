
// pages/api/plus/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getPlusStatusByEmail } from "../../../lib/plus";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email || null;
    const data = await getPlusStatusByEmail(email);
    return res.status(200).json(data);
  } catch (e) {
    console.error("[plus/status] fatal:", e);
    return res.status(200).json({ status: "none" }); // soft-fail pour l'UI
  }
}
