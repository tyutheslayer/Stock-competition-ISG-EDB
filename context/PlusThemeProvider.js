import { createContext, useEffect } from "react";
import { useSession } from "next-auth/react";

export const PlusThemeContext = createContext(false);

export function PlusThemeProvider({ children }) {
  const { data: session } = useSession();
  const isPlus = session?.user?.isPlusActive || session?.user?.plusStatus === "active";

  useEffect(() => {
    document.documentElement.dataset.theme = isPlus ? "plus" : "isg";
  }, [isPlus]);

  return children;
}