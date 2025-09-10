// pages/api/auth/[...nextauth].js
import NextAuthHandler, { authOptions } from "../../../lib/auth";

export default function handler(req, res) {
  return NextAuthHandler(req, res);
}

// on ré-exporte pour getServerSession côté API
export { authOptions };