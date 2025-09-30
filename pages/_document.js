
import { Html, Head, Main, NextScript } from "next/document";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";

export default function App({ Component, pageProps }) {
  return (
    <PlusThemeProvider>
      <Component {...pageProps} />
    </PlusThemeProvider>
  );
}
export default function Document() {
  return (
    <Html data-theme="isg">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
