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
/* tell the shell a chat is open so its conversation notification (and inline-reply history) is dismissed */
export const nativeChatOpened = (matchId) => call("chatOpened", matchId);
export const nativeOpenSettings = () => call("openSettings");
/* Shell 1.5+: status bar + Android navigation bar follow the app theme ("dark" | "light"). No-op on older shells / web. */
export const nativeSetTheme = (dark) => call("setTheme", dark ? "dark" : "light");
/* Shell 1.7+: per-screen status-bar icon style override ("dark" = light icons for a black screen, null = follow theme). */
export const nativeSetBars = (mode) => call("setBars", mode || "");
/* Shell 1.6+: the phone's own dark-mode state (null when unknown / not in the app). */
export const nativeSystemDark = () => {
  const b = bridge();
  if (!b || typeof b.isSystemDark !== "function") return null;
  try {
    return !!b.isSystemDark();
  } catch (e) {
    return null;
  }
};

/* Shell 1.4+ exposes hasCamera(): older shells never answer the page's camera request, so the web app must not wait on them. */
export const nativeSupportsCamera = () => {
  const b = bridge();
  return !!b && typeof b.hasCamera === "function";
};

/*
 * Shell 1.7.3+: exact screenshot of the app window (PixelCopy) for the orb's visual search. Resolves to a JPEG data URL,
 * or null when not in the shell / the shell is older / it takes too long (the web falls back to html2canvas).
 */
export const nativeCapture = () => {
  const b = bridge();
  if (!b || typeof b.capture !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      window.removeEventListener("voiladi:capture", onShot);
      resolve(v);
    };
    const onShot = (e) => {
      if (e.detail?.id === id) finish(e.detail.dataUrl || null);
    };
    window.addEventListener("voiladi:capture", onShot);
    setTimeout(() => finish(null), 2500);
    try {
      b.capture(id);
    } catch (e) {
      finish(null);
    }
  });
};
