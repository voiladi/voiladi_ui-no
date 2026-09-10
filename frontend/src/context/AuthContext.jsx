import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, getToken, setToken } from "@/lib/api";
import { nativeSetToken } from "@/lib/native";

const AuthContext = createContext(null);
const USER_KEY = "voiladi_user";

/*
 * Session handling, the way native apps do it:
 *  - The last known profile is cached on the device. With a token + cached profile the app opens INSTANTLY and the
 *    session is re-checked in the background; a flaky mobile connection never throws the user to an offline page.
 *  - Only when there's nothing cached and the network is unreachable do we show the full offline screen.
 *  - While the network is unreachable we quietly retry (every 5s, and immediately when the browser comes back online).
 *  - A real 401 clears everything and sends the user to Welcome.
 */
const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};
const writeCachedUser = (u) => {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch (e) {
    /* storage full / private mode: ignore */
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setTok] = useState(getToken());
  const [user, setUserState] = useState(() => (getToken() ? readCachedUser() : null));
  // loading only blocks the UI when there is a token but nothing cached to show yet
  const [loading, setLoading] = useState(() => !!getToken() && !readCachedUser());
  // "offline" when the session check failed because the network is unreachable (token kept, no redirect)
  const [netError, setNetError] = useState(null);
  const retryTimer = useRef(null);

  const setUser = useCallback((u) => {
    setUserState(u);
    writeCachedUser(u);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    if (!readCachedUser()) setLoading(true);
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      setNetError(null);
      nativeSetToken(getToken());
      return data;
    } catch (e) {
      if (e?.response?.status === 401) {
        setToken(null);
        setTok(null);
        setUser(null);
        setNetError(null);
        nativeSetToken(null);
      } else if (!e?.response) {
        setNetError("offline");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // quiet retries while unreachable
  useEffect(() => {
    if (netError !== "offline") return undefined;
    const tick = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      refresh();
    };
    retryTimer.current = setInterval(tick, 5000);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(retryTimer.current);
      window.removeEventListener("online", tick);
    };
  }, [netError, refresh]);

  const login = useCallback(
    (t, u) => {
      setToken(t);
      setTok(t);
      setUser(u);
      setNetError(null);
      setLoading(false);
      nativeSetToken(t);
    },
    [setUser],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTok(null);
    setUser(null);
    setNetError(null);
    nativeSetToken(null);
  }, [setUser]);

  const value = useMemo(() => ({ token, user, loading, netError, login, logout, refresh, setUser }), [token, user, loading, netError, login, logout, refresh, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
