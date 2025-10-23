// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";

// ✅ force Node runtime
export const config = { runtime: "nodejs" };

// 🔁 Exporte l'objet d’options pour getServerSession
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email & Mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role || "USER",
          isAdmin: user.role === "ADMIN",
          // si tu as un flag d’abonnement Plus, expose-le ici
          isPlusActive: user.plusStatus === "active",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.isAdmin = !!user.isAdmin;
        token.isPlusActive = !!user.isPlusActive;
      } else if (token?.email) {
        // synchronise si besoin (optionnel)
        const u = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, plusStatus: true },
        });
        if (u) {
          token.uid = u.id;
          token.role = u.role;
          token.isAdmin = u.role === "ADMIN";
          token.isPlusActive = u.plusStatus === "active";
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.uid;
      session.user.role = token.role;
      session.user.isAdmin = !!token.isAdmin;
      session.user.isPlusActive = !!token.isPlusActive;
      return session;
    },
  },
};

export default NextAuth(authOptions);