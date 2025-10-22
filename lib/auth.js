// lib/auth.js — Source d'autorité unique pour NextAuth
import prisma from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/* ===== Helpers env ===== */
function parseList(envVal, fallback = []) {
  return String(envVal || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .concat(fallback)
    .filter(Boolean);
}

// Domaines autorisés (multi-domaines supportés)
const ALLOWED_DOMAINS = parseList(
  process.env.ALLOWED_EMAIL_DOMAINS,
  [process.env.ALLOWED_EMAIL_DOMAIN || "isg.fr"]
);

// Emails admin (liste)
const ADMIN_EMAILS = new Set(parseList(process.env.ADMIN_EMAILS));

function isAllowedEmail(email = "") {
  const domain = String(email).split("@")[1]?.toLowerCase() || "";
  return ALLOWED_DOMAINS.includes(domain);
}
function isAdminEmail(email = "") {
  return ADMIN_EMAILS.has(String(email).toLowerCase());
}

/* ===== NextAuth config ===== */
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
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password || "";
        if (!email || !password) return null;

        if (!isAllowedEmail(email)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

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
    // Vérifie le domaine + upsert côté Google
    async signIn({ user, account }) {
      const email = String(user?.email || "").toLowerCase();
      if (!isAllowedEmail(email)) return false;

      if (account?.provider === "google") {
        const randomPwd = crypto.randomBytes(24).toString("hex");
        const hash = await bcrypt.hash(randomPwd, 10);

        // Si l'email est dans ADMIN_EMAILS => role ADMIN à la création
        await prisma.user.upsert({
          where: { email },
          update: {
            name: user.name || undefined,
            image: user.image || undefined,
            // On ne modifie pas le role à chaque sign-in pour éviter
            // d'écraser un rôle changé manuellement en base.
          },
          create: {
            email,
            name: user.name || null,
            image: user.image || null,
            password: hash, // requis par le schéma
            role: isAdminEmail(email) ? "ADMIN" : "USER",
          },
        });
      }

      return true;
    },

    async jwt({ token, user }) {
      // première connexion (Credentials/Google)
      if (user) {
        token.email = user.email || token.email;
        token.role = user.role || token.role;
      }

      // Toujours consolider depuis la base si on a l'email
      if (token?.email) {
        const u = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { role: true, email: true },
        });
        if (u) token.role = u.role || token.role || "USER";
      }

      // Filet de sécurité : un email listé admin est ADMIN
      if (token?.email && isAdminEmail(token.email)) {
        token.role = "ADMIN";
      }

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

// Expose helpers si besoin ailleurs
export { isAllowedEmail, isAdminEmail, ALLOWED_DOMAINS };