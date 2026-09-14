/*
 * Bridge to the Android shell (com.voiladi.app). The native side injects `window.VoiladiNative` with:
 *   setToken(token) / clearToken()  -> lets the app poll for new activity and post phone notifications while closed
 *   ready()                          -> hides the native splash once the web app has rendered
 *   openSettings()                   -> opens the OS notification settings for the app
 * Every call is a no-op in a normal browser.
 */
const bridge = () => (typeof window !== "undefined" ? window.VoiladiNative : undefined);

export const isNativeApp = () => !!bridge() || (typeof navigator !== "undefined" && /VoiladiApp\//.test(navigator.userAgent));

const call = (name, ...args) => {
  const b = bridge();
  if (!b || typeof b[name] !== "function") return false;
  try {
    b[name](...args);
    return true;
  } catch (e) {
    return false;
  }
};

export const nativeSetToken = (token) => (token ? call("setToken", token) : call("clearToken"));
export const nativeReady = () => call("ready");
export const nativeOpenSettings = () => call("openSettings");
/* Shell 1.5+: status bar + Android navigation bar follow the app theme ("dark" | "light"). No-op on older shells / web. */
export const nativeSetTheme = (dark) => call("setTheme", dark ? "dark" : "light");

/* Shell 1.4+ exposes hasCamera(): older shells never answer the page's camera request, so the web app must not wait on them. */
export const nativeSupportsCamera = () => {
  const b = bridge();
  return !!b && typeof b.hasCamera === "function";
};
