// pages/api/plus/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getPlusStatusByEmail } from "../../../lib/plus";


export default async function handler(req, res) {
  try {
    // DEV: status "active" si PLUS_DEV_MODE=1 (ou cookie plus=1 pour tests manuels)
    const isDev = String(process.env.PLUS_DEV_MODE || "0") === "1";
    const cookie = (req.headers.cookie || "").includes("edb_plus=1");
    const status = isDev || cookie ? "active" : "none";
    return res.json({ status });
  } catch (e) {
    console.error("[plus/status]", e);
    return res.status(200).json({ status: "none" });
  }
}
