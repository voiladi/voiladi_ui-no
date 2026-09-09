/**
 * Self-updating SPA: long-lived tabs keep running the JavaScript they were opened with, so after a deploy a user
 * who never reloads keeps seeing the old UI. We compare the running bundle against /asset-manifest.json whenever the
 * tab comes back to the foreground (and once a minute while visible) and reload when a newer build is live.
 */
const currentBundle = () => {
  const src = Array.from(document.scripts)
    .map((s) => s.src)
    .find((u) => /\/static\/js\/main\.[a-z0-9]+\.js/.test(u));
  try {
    return src ? new URL(src).pathname : null;
  } catch (e) {
    return null;
  }
};

const typing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

export const startUpdateCheck = () => {
  const current = currentBundle();
  if (!current) return undefined; // dev server (bundle.js) or unknown layout: nothing to compare against
  let busy = false;
  let pending = false;

  const reloadNow = () => {
    if (typing()) {
      pending = true; // don't yank a half-written message; retry shortly
      return;
    }
    window.location.reload();
  };

  const check = async () => {
    if (busy || document.visibilityState === "hidden") return;
    busy = true;
    try {
      const res = await fetch(`/asset-manifest.json?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const manifest = await res.json();
      const latest = manifest?.files?.["main.js"];
      if (latest && latest !== current) reloadNow();
    } catch (e) {
      // offline or blocked: try again later
    } finally {
      busy = false;
    }
  };

  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    if (pending) reloadNow();
    else check();
  };

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  const timer = setInterval(() => (pending ? reloadNow() : check()), 60_000);
  const first = setTimeout(check, 4_000);
  return () => {
    clearInterval(timer);
    clearTimeout(first);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  };
};
