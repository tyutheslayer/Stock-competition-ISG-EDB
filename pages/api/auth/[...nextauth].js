// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";

export const config = { runtime: "nodejs" };

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

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role || null,
          isAdmin: user.role === "ADMIN",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // lors du login, on enrichit
      if (user) {
        token.uid = user.id;
        token.role = user.role || token.role || null;
        token.isAdmin = !!user.isAdmin;
      }
      // si pas encore enrichi, récup via email
      if ((!token.uid || !token.role) && token?.email) {
        const db = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true },
        });
        if (db) {
          token.uid = db.id;
          token.role = db.role || null;
          token.isAdmin = db.role === "ADMIN";
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      // id peut être dans token.uid ou token.sub selon cas
      session.user.id = token.uid || token.sub || null;
      session.user.role = token.role || null;
      session.user.isAdmin = !!token.isAdmin;
      return session;
    },
  },
};

export default NextAuth(authOptions);