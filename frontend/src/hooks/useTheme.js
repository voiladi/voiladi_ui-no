import { useCallback, useEffect, useState } from "react";
import { nativeSetTheme } from "@/lib/native";

const KEY = "voiladi_theme";

const apply = (dark) => {
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#000000" : "#FFFFFF");
  nativeSetTheme(dark); // Android shell: paint the status / navigation bars to match
};

export const initTheme = () => {
  const saved = localStorage.getItem(KEY);
  apply(saved === "dark");
};

/** Settings > Dark Mode. Persisted; light by default (as in the photos). */
export const useTheme = () => {
  const [dark, setDark] = useState(() => localStorage.getItem(KEY) === "dark");
  useEffect(() => apply(dark), [dark]);
  const toggle = useCallback((v) => {
    const next = typeof v === "boolean" ? v : !dark;
    localStorage.setItem(KEY, next ? "dark" : "light");
    setDark(next);
  }, [dark]);
  return { dark, setDark: toggle };
};
