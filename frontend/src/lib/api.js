import axios from "axios";

export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;
export const WS_URL = `${BACKEND_URL.replace(/^http/, "ws")}/api/ws`;
export const TOKEN_KEY = "voiladi_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export const api = axios.create({ baseURL: API, timeout: 30000 });

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const photoUrl = (u) => {
  if (!u) return "";
  return u.startsWith("http") ? u : `${BACKEND_URL}${u}`;
};

export const errMsg = (e, fallback = "Something went wrong. Try again.") => {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message === "Network Error" ? "You're offline. Check your connection." : fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join(", ");
  return fallback;
};
