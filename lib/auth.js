import prisma from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "isg.fr").toLowerCase();

export const authOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    // (optionnel) page d'erreur dédiée
    // error: "/auth/error",
  },
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

        // ✅ Filtre domaine AVANT toute vérif de mot de passe
        const domain = String(credentials.email).split("@")[1]?.toLowerCase() || "";
        if (domain !== ALLOWED_DOMAIN) {
          // NextAuth renverra CredentialsSignin (on gère le message côté UI)
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
    /**
     * ✅ signIn: applique la règle @isg.fr pour TOUS les providers
     * - Pour Google: on bloque AVANT l'upsert.
     * - Pour Credentials: l’authorize ci-dessus bloque déjà, mais on garde la double ceinture.
     */
    async signIn({ user, account }) {
      const email = user?.email || "";
      const domain = email.split("@")[1]?.toLowerCase() || "";
      if (domain !== ALLOWED_DOMAIN) {
        return false; // NextAuth => ?error=AccessDenied
      }

      if (account?.provider === "google") {
        // On est sûr du domaine, on peut créer/mettre à jour l’utilisateur
        const randomPwd = crypto.randomBytes(24).toString("hex");
        const hash = await bcrypt.hash(randomPwd, 10);

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
            password: hash, // mot de passe factice pour respecter le schéma
            // role: "USER" par défaut via Prisma
          },
        });
      }
      return true;
    },

    /**
     * ✅ jwt: stocke le rôle et l’email; si rôle manquant (OAuth), va le chercher en BD
     */
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role || token.role || "USER";
        token.email = user.email || token.email;
      }
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
      // Expose un booléen isAdmin dérivé du rôle (pas en BD)
      token.isAdmin = (token.role === "ADMIN");
      return token;
    },

    /**
     * ✅ session: expose role + isAdmin côté client
     */
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