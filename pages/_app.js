// pages/_app.jsx
import Head from "next/head";
import PageShell from "../components/PageShell";
import "../styles/global.css"; // si tu as un fichier global

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* PageShell gère le thème + fond 3D + NavBar */}
      <PageShell>
        <Component {...pageProps} />
      </PageShell>
    </>
  );
}