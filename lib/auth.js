import prisma from "./prisma";
import { PrismaAdapter } from "@next-auth/prisma-adapter"; // ✅ nécessaire pour EmailProvider
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import NextAuth from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "isg.fr").toLowerCase();

export const authOptions = {
  adapter: PrismaAdapter(prisma),           // ✅ indispensable pour tokens email
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    // 1) Lien magique (email)
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

      // ✅ Méthode C : ne JAMAIS throw → pas de "Server error" pour l’utilisateur
      async sendVerificationRequest({ identifier, url, provider }) {
        try {
          const email = String(identifier || "").trim().toLowerCase();
          const domain = email.split("@")[1] || "";
          if (domain !== ALLOWED_DOMAIN) {
            console.warn("[email] blocked non-ISG domain:", email);
            return; // on n’envoie pas, mais on ne jette pas d’erreur
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
            text: `Connexion: ${url}`,
          });

          const failed = (result.rejected?.length || 0) + (result.pending?.length || 0);
          if (failed) {
            console.error("[email] rejected/pending:", result.rejected, result.pending);
            // pas de throw
          }
        } catch (e) {
          console.error("[email] sendVerificationRequest error:", e);
          // pas de throw → on évite un 500 NextAuth
        }
      },

      normalizeIdentifier(identifier) {
        return identifier.trim().toLowerCase();
      },
    }),

    // 2) Google (filtré par domaine dans callbacks.signIn)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    // 3) Credentials
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const domain = String(credentials.email).split("@")[1]?.toLowerCase() || "";
        if (domain !== ALLOWED_DOMAIN) return null;

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
    async signIn({ user, account }) {
      const email = user?.email || "";
      const domain = email.split("@")[1]?.toLowerCase() || "";
      if (domain !== ALLOWED_DOMAIN) return false; // AccessDenied

      if (account?.provider === "google") {
        const randomPwd = crypto.randomBytes(24).toString("hex");
        const hash = await bcrypt.hash(randomPwd, 10);
        await prisma.user.upsert({
          where: { email },
          update: { name: user.name || undefined, image: user.image || undefined },
          create: { email, name: user.name || null, image: user.image || null, password: hash },
        });
      }
      return true;
    },

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