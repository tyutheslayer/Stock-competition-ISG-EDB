// pages/_app.js
import { SessionProvider } from "next-auth/react";

// ⚠️ Mets le BON chemin vers ton CSS global :
//  - si ton fichier s'appelle styles/global.css  -> garde cette ligne
//  - si c'est styles/globals.css                 -> remplace par "../styles/globals.css"
import "../styles/global.css";

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}

export default MyApp;