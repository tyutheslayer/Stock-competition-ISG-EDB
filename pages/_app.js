import { SessionProvider } from "next-auth/react";
import "../styles/globals.css";
import NeonBackground3D from "../components/NeonBackground3D";

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <div data-theme="edbtheme">
        <NeonBackground3D>
          <Component {...pageProps} />
        </NeonBackground3D>
      </div>
    </SessionProvider>
  );
}