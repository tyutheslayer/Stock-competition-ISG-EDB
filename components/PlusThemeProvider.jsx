import { useEffect, useState } from "react";

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function PlusThemeProvider({ children }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const cookie = getCookie("edb_plus_preview"); // "1" si preview
    const html = document.documentElement;
    if (cookie === "1") {
      html.setAttribute("data-theme", "edbplus");
      setActive(true);
    } else {
      // ne force pas le thème sinon — laisse ton thème par défaut
      setActive(false);
    }
  }, []);

  return children;
}