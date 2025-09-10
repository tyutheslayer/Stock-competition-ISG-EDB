import NextAuthHandler, { authOptions } from "../../../lib/auth";

export default function handler(req, res) {
  return NextAuthHandler(req, res);
}
export { authOptions as authOptions };
export const authOptions = {
  // ... tes providers/adapters/existing options
  callbacks: {
    async jwt({ token, user }) {
      // au login, 'user' est défini → copie isAdmin depuis la DB
      if (user) {
        token.isAdmin = !!user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      // expose isAdmin au client
      if (session?.user) {
        session.user.isAdmin = !!token.isAdmin;
      }
      return session;
    },
  },
  // ... le reste de ta config (pages, secret, etc.)
};
