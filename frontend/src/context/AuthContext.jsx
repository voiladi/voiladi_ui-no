import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "@/lib/api";
import { nativeSetToken } from "@/lib/native";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTok] = useState(getToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  // "offline" when the session check failed because the network is unreachable (token kept, no redirect)
  const [netError, setNetError] = useState(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
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
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((t, u) => {
    setToken(t);
    setTok(t);
    setUser(u);
    setNetError(null);
    setLoading(false);
    nativeSetToken(t);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setTok(null);
    setUser(null);
    nativeSetToken(null);
  }, []);

  const value = useMemo(() => ({ token, user, loading, netError, login, logout, refresh, setUser }), [token, user, loading, netError, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
