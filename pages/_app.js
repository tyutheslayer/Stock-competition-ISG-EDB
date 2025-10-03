// pages/_app.js
import { SessionProvider } from "next-auth/react";
import PageShell from "../components/PageShell";

// ⚠️ Mets le bon chemin vers ton CSS global.
//   - si tu as styles/globals.css  -> remplace la ligne ci-dessous
import "../styles/global.css";

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      {/* PageShell = fond 3D, glassmorphism, NavBar, thèmes, etc. */}
      <PageShell>
        <Component {...pageProps} />
      </PageShell>
    </SessionProvider>
  );
}