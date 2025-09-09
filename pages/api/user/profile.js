import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const email = session.user.email;

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({ where: { email }, select: { email: true, name: true, image: true } });
    return res.json(user ?? {});
  }

  if (req.method === "POST") {
    const { name } = req.body || {};
    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Nom invalide (≥ 2 caractères)" });
    }
    const user = await prisma.user.update({
      where: { email },
      data: { name: name.trim() },
      select: { email: true, name: true, image: true }
    });
    return res.json(user);
  }

  return res.status(405).end();
}
