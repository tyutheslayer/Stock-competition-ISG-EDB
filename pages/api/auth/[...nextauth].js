// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "../../../lib/prisma";

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "isg.fr,isg-luxury.fr,esme.fr")
  .split(",")
  .map(d => d.trim().toLowerCase())
  .filter(Boolean);

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email ?? "";
        const password = credentials?.password ?? "";
        const email = String(emailRaw).trim().toLowerCase();
        const domain = email.split("@")[1] || "";

        // ✅ mêmes domaines qu'à l'inscription
        if (!ALLOWED_DOMAINS.includes(domain)) {
          throw new Error(
            `Seules les adresses ${ALLOWED_DOMAINS.map(d => "@" + d).join(", ")} sont autorisées.`
          );
        }

        // 🔎 recherche insensible à la casse
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!user || !user.password) {
          throw new Error("Identifiants invalides.");
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          throw new Error("Identifiants invalides.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || null,
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role || null;
      return token;
    },
    async session({ session, token }) {
      if (session?.user) session.user.role = token.role || null;
      return session;
    },
    // ⚠️ Si d'autres providers sont ajoutés un jour, on garde le garde-fou domaine ici aussi
    async signIn({ user }) {
      if (!user?.email) return false;
      const domain = String(user.email).split("@")[1]?.toLowerCase() || "";
      return ALLOWED_DOMAINS.includes(domain);
    },
  },

  // Assure-toi d'avoir NEXTAUTH_SECRET en prod
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);