// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";

// ✅ IMPORTANT: forcer le runtime Node (évite Edge qui casse NextAuth)
export const config = { runtime: "nodejs" };

export default NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email & Mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");

        if (!email || !password) return null;

        // 🔑 Login autorisé pour TOUT domaine existant en base (on ne filtre PAS ici)
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        // retourne l’objet user minimal
        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role || null,
          isAdmin: user.role === "ADMIN"
        };
      }
    })
  ],
  pages: {
    signIn: "/login",
    error: "/login" // redirige sur la page login en cas d'erreur
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = session.user || {};
        session.user.id = token.uid;
        session.user.role = token.role;
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    }
  }
});