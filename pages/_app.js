// pages/_app.js
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";

// CSS global de base
import "../styles/global.css";
// ➜ thème PLUS (marbre/or) déjà fourni par toi
import "../styles/plus-theme.css";

function PlusThemeGate({ children }) {
  const { data: session } = useSession();
  const isPlus =
    session?.user?.isPlusActive === true ||
    session?.user?.plusStatus === "active";

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", isPlus ? "plus" : "isg");
    return () => el.setAttribute("data-theme", "isg");
  }, [isPlus]);

  return children;
}

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <PlusThemeGate>
        <Component {...pageProps} />
      </PlusThemeGate>
    </SessionProvider>
  );
}