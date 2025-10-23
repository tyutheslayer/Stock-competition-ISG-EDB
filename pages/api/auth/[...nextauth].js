// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";

// ✅ FORCER le runtime Node (évite Edge qui casse des choses)
export const config = { runtime: "nodejs" };

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email & Mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        // 🔎 utilisateur
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, password: true, role: true, plusStatus: true },
        });
        if (!user) return null;

        // 🧂 vérif hash (si user.password est null -> refus)
        if (!user.password) return null;
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          role: user.role || "USER",
          isPlusActive: user.plusStatus === "active",
          isAdmin: (user.role === "ADMIN"),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.isAdmin = !!user.isAdmin;
        token.isPlusActive = !!user.isPlusActive;
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
  // important pour NextAuth v4 en Route Handler classique
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);