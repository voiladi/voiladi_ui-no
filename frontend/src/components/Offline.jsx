import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Spinner } from "@/components/Loading";

/* true while the browser reports no network */
export const useOnline = () => {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
};

/* Slim dark bar at the top of the shell while offline (the app keeps working with cached data). */
export const OfflineBanner = () => {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center"
      style={{ paddingTop: "calc(10px + env(safe-area-inset-top))" }}
      data-testid="offline-banner"
      role="status"
    >
      <div className="flex items-center gap-2 rounded-full bg-[#262626] px-4 py-2 text-[13px] font-medium text-white shadow-modal">
        <WifiOff className="h-4 w-4" strokeWidth={2.2} />
        You're offline
      </div>
    </div>
  );
};

/* Full screen shown when the app cannot reach Voiladi at all (first load without network). */
export const OfflineScreen = ({ onRetry, retrying = false }) => (
  <div className="vo-backdrop">
    <div className="vo-shell items-center justify-center px-8 text-center" data-testid="offline-screen">
      <LogoMark size={64} />
      <span className="mt-10 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface text-ink">
        <WifiOff className="h-8 w-8" strokeWidth={1.7} />
      </span>
      <h1 className="mt-5 text-[24px] font-bold tracking-[-0.02em] text-ink">You're offline</h1>
      <p className="mt-2 max-w-[280px] text-[15px] leading-[1.45] text-mute">Check your connection and try again. Your account and matches are safe.</p>
      <button type="button" className="vo-btn-primary mt-8 h-12 px-8" onClick={onRetry} aria-busy={retrying} data-testid="offline-retry-button">
        {retrying ? <Spinner size={20} stroke={2} /> : (
          <>
            <RefreshCw className="h-4 w-4" strokeWidth={2.4} /> Try again
          </>
        )}
      </button>
    </div>
  </div>
);
