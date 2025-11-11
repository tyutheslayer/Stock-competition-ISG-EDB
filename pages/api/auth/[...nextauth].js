// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";

export const config = { runtime: "nodejs" };

// Helper : vérifie si un email appartient à la liste PLUS
function isEmailPlus(email) {
  if (!email) return false;
  const raw = process.env.PLUS_EMAILS || "";
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
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

        const isAdmin = user.role === "ADMIN";
        const isPlus =
          isAdmin ||
          isEmailPlus(email) ||
          user.role === "PLUS" ||
          user.isPlusActive === true;

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role || null,
          isAdmin,
          isPlusActive: isPlus,
          plusStatus: isPlus ? "active" : "none",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Lors du login
      if (user) {
        token.uid = user.id;
        token.role = user.role || token.role || null;
        token.isAdmin = !!user.isAdmin;

        // Statut Plus (hérite des admins)
        token.isPlusActive =
          user.isAdmin ||
          isEmailPlus(user.email) ||
          user.role === "PLUS" ||
          user.isPlusActive === true;
        token.plusStatus = token.isPlusActive ? "active" : "none";
      }

      // Si token déjà existant mais sans infos complètes
      if ((!token.uid || !token.role) && token?.email) {
        const db = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true },
        });
        if (db) {
          token.uid = db.id;
          token.role = db.role || null;
          token.isAdmin = db.role === "ADMIN";
          token.isPlusActive =
            token.isAdmin ||
            isEmailPlus(token.email) ||
            db.role === "PLUS";
          token.plusStatus = token.isPlusActive ? "active" : "none";
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.uid || token.sub || null;
      session.user.role = token.role || null;
      session.user.isAdmin = !!token.isAdmin;

      // ➕ expose les flags Plus
      session.user.isPlusActive = !!token.isPlusActive;
      session.user.plusStatus = token.plusStatus || (token.isPlusActive ? "active" : "none");
      return session;
    },
  },
};

export default NextAuth(authOptions);