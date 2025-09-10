import prisma from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "isg.fr").toLowerCase();

export const authOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    // (optionnel) page d'erreur dédiée:
    // error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    // 1) Lien magique par email (passwordless)
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT || 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "ISG Bourse <no-reply@isg.fr>",

      // Empêche l’envoi aux emails hors domaine + email custom
      async sendVerificationRequest({ identifier, url, provider }) {
        const email = String(identifier || "").trim();
        const domain = email.split("@")[1]?.toLowerCase() || "";
        if (domain !== ALLOWED_DOMAIN) {
          // On ne JAMAIS envoie de mail pour un domaine interdit
          // NextAuth affichera quand même un message générique côté UI
          return;
        }

        const transport = nodemailer.createTransport(provider.server);
        const result = await transport.sendMail({
          to: email,
          from: provider.from,
          subject: "Votre lien de connexion (ISG Bourse)",
          html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
              <h2 style="margin:0 0 12px 0;color:#153859">Connexion par lien magique</h2>
              <p>Bonjour,</p>
              <p>Pour vous connecter à la plateforme ISG Bourse, cliquez sur le bouton ci-dessous :</p>
              <p style="margin:24px 0">
                <a href="${url}" style="display:inline-block;background:#153859;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px">Se connecter</a>
              </p>
              <p style="font-size:12px;color:#666">Ce lien expirera automatiquement. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            </div>
          `,
          text: `Connectez-vous: ${url}`,
        });

        const failed = result.rejected?.length || result.pending?.length;
        if (failed) {
          throw new Error("Email de vérification non envoyé");
        }
      },

      // Normalise l’email (évite doublons à cause des majuscules)
      normalizeIdentifier(identifier) {
        return identifier.trim().toLowerCase();
      },
    }),

    // 2) Google OAuth (filtré par domaine plus bas)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    // 3) Credentials (email + mot de passe)
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // ✅ Filtre domaine AVANT toute vérif
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
    /**
     * ✅ signIn: applique la règle @isg.fr pour TOUS les providers
     * - Pour Email: filtre aussi au clic du lien (en plus de l’envoi)
     * - Pour Google: on bloque ici et on fait l’upsert si c’est ok
     * - Pour Credentials: l’authorize ci-dessus a déjà filtré
     */
    async signIn({ user, account }) {
      const email = user?.email || "";
      const domain = email.split("@")[1]?.toLowerCase() || "";
      if (domain !== ALLOWED_DOMAIN) {
        return false; // NextAuth => ?error=AccessDenied
      }

      if (account?.provider === "google") {
        // OK pour le domaine, on peut créer/mettre à jour l’utilisateur
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

      // Pour Email provider: NextAuth gère l’utilisateur automatiquement à la vérification du lien
      return true;
    },

    /**
     * ✅ jwt: stocke le rôle/ email; si rôle manquant (OAuth/Email), va le chercher en BD
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
      token.isAdmin = (token.role === "ADMIN"); // dérivé du rôle
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