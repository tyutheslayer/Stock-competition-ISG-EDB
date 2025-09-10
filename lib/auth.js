import prisma from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // scopes par défaut incluent profile+email+openid
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name || user.email, email: user.email, role: user.role };
      },
    }),
  ],
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // Crée / met à jour l'utilisateur à la connexion Google
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        const randomPwd = crypto.randomBytes(24).toString("hex");
        const hash = await bcrypt.hash(randomPwd, 10);

        // upsert: crée si absent, met à jour name/image si présent
        await prisma.user.upsert({
          where: { email },
          update: {
            name: user.name || undefined,
            image: user.image || undefined,
          },
          create: {
            email,
            name: user.name || null,
            image: user.image || null,
            password: hash, // mot de passe pseudo pour satisfaire le schéma
            // role: USER par défaut via Prisma
          },
        });
      }
      return true;
    },

    async jwt({ token, user }) {
      // si c'est une connexion credentials, on a user.role tout de suite
      if (user) {
        token.role = user.role || token.role || "USER";
        token.email = user.email || token.email;
      }
      // pour OAuth: récupérer le rôle en BD si manquant
      if ((!token.role || !token.email) && token?.email) {
        const u = await prisma.user.findUnique({ where: { email: token.email } });
        if (u) {
          token.role = u.role || "USER";
          token.email = u.email;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role || "USER";
      }
      return session;
    },
  },
};

export default function NextAuthHandler(req, res) {
  return NextAuth(req, res, authOptions);
}



// --- Ensure isAdmin is exposed in JWT + session (non-breaking) ---
{
  const prev = authOptions.callbacks || {};

  authOptions.callbacks = {
    ...prev,

    async jwt({ token, user, ...rest }) {
      // Préserve l'ancien callback s'il existe
      if (typeof prev.jwt === "function") {
        token = (await prev.jwt({ token, user, ...rest })) || token;
      }

      // 1) Au login, NextAuth fournit "user" → on copie isAdmin
      if (user && typeof user.isAdmin !== "undefined") {
        token.isAdmin = !!user.isAdmin;
        return token;
      }

      // 2) Si le token ne sait pas encore s'il est admin, on va vérifier en base
      if (typeof token.isAdmin === "undefined") {
        try {
          let dbUser = null;
          if (token?.email) {
            dbUser = await prisma.user.findUnique({
              where: { email: token.email },
              select: { isAdmin: true },
            });
          } else if (token?.sub) {
            dbUser = await prisma.user.findUnique({
              where: { id: token.sub },
              select: { isAdmin: true },
            });
          }
          if (dbUser) token.isAdmin = !!dbUser.isAdmin;
        } catch (e) {
          // on évite de casser l'auth si la DB n'est pas dispo
          console.error("[auth:isAdmin lookup]", e);
        }
      }

      return token;
    },

    async session({ session, token, ...rest }) {
      // Préserve l'ancien callback s'il existe
      if (typeof prev.session === "function") {
        session = (await prev.session({ session, token, ...rest })) || session;
      }
      // Expose isAdmin côté client
      if (session?.user) {
        session.user.isAdmin = !!token?.isAdmin;
      }
      return session;
    },
  };
}
