import { useCallback, useEffect, useState } from "react";
import { nativeSetTheme, nativeSystemDark } from "@/lib/native";

/*
 * Appearance: "system" (follows the phone), "light" or "dark". Stored under voiladi_theme.
 * Older installs stored just "light" / "dark" - those values still work unchanged.
 */
const KEY = "voiladi_theme";
export const THEME_MODES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const mq = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

export const readMode = () => {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
};

export const resolveDark = (mode) => {
  if (mode !== "system") return mode === "dark";
  const native = nativeSystemDark(); // in the Android app the WebView's media query follows the app, so ask the shell
  return native !== null ? native : !!mq()?.matches;
};

/* subscribe to phone-level theme changes (media query on the web, shell event in the app) */
const onSystemChange = (fn) => {
  const m = mq();
  const handler = () => fn();
  if (m?.addEventListener) m.addEventListener("change", handler);
  else if (m?.addListener) m.addListener(handler);
  window.addEventListener("voiladi:systemtheme", handler);
  return () => {
    if (m?.removeEventListener) m.removeEventListener("change", handler);
    else if (m?.removeListener) m.removeListener(handler);
    window.removeEventListener("voiladi:systemtheme", handler);
  };
};

const apply = (dark) => {
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#000000" : "#FFFFFF");
  nativeSetTheme(dark); // Android shell: paint the status / navigation bars to match
};

let listening = false;
const listenToSystem = () => {
  if (listening || typeof window === "undefined") return;
  listening = true;
  onSystemChange(() => {
    if (readMode() === "system") apply(resolveDark("system"));
  });
};

export const initTheme = () => {
  apply(resolveDark(readMode()));
  listenToSystem();
};

/** Settings > Appearance. */
export const useTheme = () => {
  const [mode, setModeState] = useState(readMode);
  const [dark, setDarkState] = useState(() => resolveDark(readMode()));

  useEffect(() => {
    const sync = () => {
      const d = resolveDark(mode);
      setDarkState(d);
      apply(d);
    };
    sync();
    if (mode !== "system") return undefined;
    return onSystemChange(sync);
  }, [mode]);

  const setMode = useCallback((next) => {
    const v = next === "light" || next === "dark" ? next : "system";
    localStorage.setItem(KEY, v);
    setModeState(v);
  }, []);

  /* kept for callers that only know about the old on/off switch */
  const setDark = useCallback((v) => setMode((typeof v === "boolean" ? v : !dark) ? "dark" : "light"), [dark, setMode]);

  return { mode, setMode, dark, setDark };
};
