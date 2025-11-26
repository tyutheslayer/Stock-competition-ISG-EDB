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

        // 🔑 Statut Plus côté DB + liste + rôle
        const dbIsPlus =
          user.isPlusActive === true ||
          user.role === "PLUS" ||
          isEmailPlus(email);

        const isPlus = isAdmin || dbIsPlus;

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role || null,
          isAdmin,
          // compat ancien code
          isPlusActive: isPlus,
          plusStatus: isPlus ? "active" : "none",
          // nouveau flag unifié
          isPlus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // ✅ Lors du login / refresh initial avec `user`
      if (user) {
        token.uid = user.id;
        token.role = user.role || token.role || null;
        token.isAdmin = !!user.isAdmin;

        // Statut Plus calculé depuis l’utilisateur
        const isPlus =
          !!user.isPlus ||
          !!user.isPlusActive ||
          user.role === "PLUS" ||
          user.isAdmin === true ||
          isEmailPlus(user.email);

        token.isPlus = isPlus;
        token.isPlusActive = isPlus;
        token.plusStatus = isPlus ? "active" : "none";
      }

      // ✅ Si token déjà existant mais incomplet (ex: re-hydratation session)
      if ((!token.uid || !token.role || typeof token.isPlus === "undefined") && token?.email) {
        const db = await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            role: true,
            isPlusActive: true,
            email: true,
          },
        });

        if (db) {
          const isAdmin = db.role === "ADMIN";
          const dbIsPlus =
            db.isPlusActive === true ||
            db.role === "PLUS" ||
            isEmailPlus(db.email || token.email);

          const isPlus = isAdmin || dbIsPlus;

          token.uid = db.id;
          token.role = db.role || null;
          token.isAdmin = isAdmin;
          token.isPlus = isPlus;
          token.isPlusActive = isPlus;
          token.plusStatus = isPlus ? "active" : "none";
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.uid || token.sub || null;
      session.user.role = token.role || null;
      session.user.isAdmin = !!token.isAdmin;

      // 🔑 Flag unifié PLUS côté front
      const isPlus = !!token.isPlus || !!token.isPlusActive;

      session.user.isPlus = isPlus;
      session.user.isPlusActive = isPlus; // compat avec l’ancien code
      session.user.plusStatus = token.plusStatus || (isPlus ? "active" : "none");

      return session;
    },
  },
};

export default NextAuth(authOptions);