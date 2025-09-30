// pages/_app.js
import { SessionProvider } from "next-auth/react";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <PlusThemeProvider>
        <Component {...pageProps} />
      </PlusThemeProvider>
    </SessionProvider>
  );
}