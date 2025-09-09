import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

const MAX_ORDERS = 10;
const WINDOW_MS = 60_000;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  const email = session.user.email;

  // Rate limit en mémoire (par instance)
  global._rate = global._rate || new Map();
  const now = Date.now();
  const history = global._rate.get(email) || [];
  const recent = history.filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_ORDERS) {
    return res.status(429).json({ error: "Trop d'ordres. Réessaie dans une minute." });
  }
  recent.push(now);
  global._rate.set(email, recent);

  try {
    const { symbol, side, quantity } = req.body || {};
    if (!symbol || !["BUY","SELL"].includes(side) || !quantity) {
      return res.status(400).json({ error: "Requête invalide" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    // TODO: ici tu mets ta logique de prix, cash dispo, etc.
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        symbol,
        side,
        quantity: parseFloat(quantity),
        price: 0
      }
    });

    res.json(order);
  } catch (e) {
    console.error("Erreur order:", e);
    res.status(500).json({ error: "Erreur interne" });
  }
}
