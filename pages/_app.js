// pages/_app.js
import "../styles/global.css"; // tu peux retirer cette ligne si tu n’as pas de globals.css

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;