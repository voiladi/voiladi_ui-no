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

/*
 * Absolute URL for a photo. `w` (240 | 480 | 800) asks the API for a downscaled variant of our own uploads -
 * grids and list rows never download the full 1280px original. External URLs are returned untouched.
 */
export const photoUrl = (u, w) => {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  const abs = `${BACKEND_URL}${u}`;
  return w && u.startsWith("/api/uploads/") ? `${abs}?w=${w}` : abs;
};

export const errMsg = (e, fallback = "Something went wrong. Try again.") => {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message === "Network Error" ? "You're offline. Check your connection." : fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join(", ");
  return fallback;
};
