import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth";
import prisma from "./../lib/prisma.js";
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
const _oldJwt = authOptions?.callbacks?.jwt;
const _oldSession = authOptions?.callbacks?.session;

authOptions.callbacks = {
  ...(authOptions.callbacks || {}),
  async jwt(args) {
    // préserve l'ancien comportement si présent
    let token = args.token;
    if (typeof _oldJwt === "function") {
      token = await _oldJwt(args);
    }
    // au login, 'args.user' est défini → copie isAdmin dans le token
    if (args.user && typeof args.user.isAdmin !== "undefined") {
      token.isAdmin = !!args.user.isAdmin;
    }
    return token;
  },
  async session(args) {
    // préserve l'ancien comportement si présent
    let session = args.session;
    if (typeof _oldSession === "function") {
      session = await _oldSession(args);
    }
    // expose isAdmin côté client
    if (session?.user) {
      session.user.isAdmin = !!args.token?.isAdmin;
    }
    return session;
  },
};

// --- Ensure isAdmin is exposed in JWT + session (non-breaking) ---
const _oldJwt = authOptions?.callbacks?.jwt;
const _oldSession = authOptions?.callbacks?.session;

authOptions.callbacks = {
  ...(authOptions.callbacks || {}),
  async jwt(args) {
    // préserve l'ancien comportement si présent
    let token = args.token;
    if (typeof _oldJwt === "function") {
      token = await _oldJwt(args);
    }
    // au login, 'args.user' est défini → copie isAdmin dans le token
    if (args.user && typeof args.user.isAdmin !== "undefined") {
      token.isAdmin = !!args.user.isAdmin;
    }
    return token;
  },
  async session(args) {
    // préserve l'ancien comportement si présent
    let session = args.session;
    if (typeof _oldSession === "function") {
      session = await _oldSession(args);
    }
    // expose isAdmin côté client
    if (session?.user) {
      session.user.isAdmin = !!args.token?.isAdmin;
    }
    return session;
  },
};

// --- Ensure isAdmin is exposed in JWT + session (non-breaking) ---
const _oldJwt = authOptions?.callbacks?.jwt;
const _oldSession = authOptions?.callbacks?.session;

authOptions.callbacks = {
  ...(authOptions.callbacks || {}),
  async jwt(args) {
    // préserve l'ancien comportement si présent
    let token = args.token;
    if (typeof _oldJwt === "function") {
      token = await _oldJwt(args);
    }
    // au login, 'args.user' est défini → copie isAdmin dans le token
    if (args.user && typeof args.user.isAdmin !== "undefined") {
      token.isAdmin = !!args.user.isAdmin;
    }
    return token;
  },
  async session(args) {
    // préserve l'ancien comportement si présent
    let session = args.session;
    if (typeof _oldSession === "function") {
      session = await _oldSession(args);
    }
    // expose isAdmin côté client
    if (session?.user) {
      session.user.isAdmin = !!args.token?.isAdmin;
    }
    return session;
  },
};
