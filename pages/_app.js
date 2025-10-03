import { SessionProvider } from "next-auth/react";
import "../styles/global.css"; // <- attention: global.css (sans 's')

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}