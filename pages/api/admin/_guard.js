import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export async function requireAdmin(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || session?.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return session;
}
