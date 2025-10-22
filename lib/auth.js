// lib/auth.js — version multi-domaines + ADMIN_EMAILS
import prisma from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// --- Config multi-domaines ---
// ALLOWED_EMAIL_DOMAINS="isg.fr,esme.fr,isg-luxury.fr"
const DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || process.env.ALLOWED_EMAIL_DOMAIN || "isg.fr")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// --- Liste des admins par emails ---
// ADMIN_EMAILS="toi@isg.fr,autre@esme.fr"
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowed(email = "") {
  const domain = String(email).split("@")[1]?.toLowerCase() || "";
  return DOMAINS.includes(domain);
}
function isAdminEmail(email = "") {
  return ADMIN_EMAILS.includes(String(email).toLowerCase());
}

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
        if (!isAllowed(credentials.email)) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role || (isAdminEmail(user.email) ? "ADMIN" : "USER"),
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const email = user?.email || "";
      if (!isAllowed(email)) return false;

      // Upsert quand Google se connecte
      if (account?.provider === "google") {
        const randomPwd = crypto.randomBytes(24).toString("hex");
        const hash = await bcrypt.hash(randomPwd, 10);

        await prisma.user.upsert({
          where: { email },
          update: {
            name: user.name || undefined,
            image: user.image || undefined,
            role: isAdminEmail(email) ? "ADMIN" : undefined, // auto-admin si dans la liste
          },
          create: {
            email,
            name: user.name || null,
            image: user.image || null,
            password: hash,                // mot de passe factice
            role: isAdminEmail(email) ? "ADMIN" : "USER",
          },
        });
      }
      return true;
    },

    async jwt({ token, user }) {
      // Premier passage après login
      if (user) {
        token.email = user.email || token.email;
        token.role = user.role || token.role || (isAdminEmail(user.email) ? "ADMIN" : "USER");
      }
      // Refresh: récupère le rôle depuis la DB (utile pour OAuth)
      if (token?.email && !token?.role) {
        const u = await prisma.user.findUnique({
          where: { email: token.email },
          select: { role: true, email: true },
        });
        if (u) {
          token.role = u.role || (isAdminEmail(u.email) ? "ADMIN" : "USER");
          token.email = u.email;
        }
      }

      // Forçage au cas où on modifie ADMIN_EMAILS sans toucher la DB
      if (token?.email && isAdminEmail(token.email)) token.role = "ADMIN";
      token.isAdmin = token.role === "ADMIN";
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