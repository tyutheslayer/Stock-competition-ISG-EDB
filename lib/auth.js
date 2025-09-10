// lib/auth.js — version stable (Google + Credentials, pas d'EmailProvider)
import prisma from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "isg.fr").toLowerCase();

export const authOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Filtre domaine en amont
        const domain = String(credentials.email).split("@")[1]?.toLowerCase() || "";
        if (domain !== ALLOWED_DOMAIN) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role || "USER",
        };
      },
    }),
  ],
  callbacks: {
    // Bloque tous les providers si domaine ≠ isg.fr
    async signIn({ user, account }) {
      const email = user?.email || "";
      const domain = email.split("@")[1]?.toLowerCase() || "";
      if (domain !== ALLOWED_DOMAIN) {
        return false; // ?error=AccessDenied
      }

      // Upsert côté Google (création si premier login)
      if (account?.provider === "google") {
        const randomPwd = crypto.randomBytes(24).toString("hex");
        const hash = await bcrypt.hash(randomPwd, 10);

        await prisma.user.upsert({
          where: { email },
          update: { name: user.name || undefined, image: user.image || undefined },
          create: {
            email,
            name: user.name || null,
            image: user.image || null,
            password: hash, // mot de passe factice pour respecter le schéma
            // role: USER par défaut
          },
        });
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.role = user.role || token.role || "USER";
        token.email = user.email || token.email;
      }
      // Si OAuth: récupère le rôle depuis la BD
      if ((!token.role || !token.email) && token?.email) {
        const u = await prisma.user.findUnique({
          where: { email: token.email },
          select: { role: true, email: true },
        });
        if (u) {
          token.role = u.role || "USER";
          token.email = u.email;
        }
      }
      token.isAdmin = (token.role === "ADMIN");
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role || "USER";
        session.user.isAdmin = !!token.isAdmin;
      }
      return session;
    },
  },
};

export default function NextAuthHandler(req, res) {
  return NextAuth(req, res, authOptions);
}