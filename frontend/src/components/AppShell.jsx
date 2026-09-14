import React, { Suspense, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { nativeSetBars } from "@/lib/native";
import { Spinner } from "@/components/Loading";
import { useQueryClient } from "@tanstack/react-query";
import { banner } from "@/lib/feedback";
import { FeedbackLayer } from "@/components/Feedback";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { OfflineBanner } from "@/components/Offline";
import { AiSearchLayer } from "@/components/ai/AiSearchLayer";

/* Tap-to-open banners for realtime events (new match, new message). */
const RealtimeToasts = () => {
  const { subscribe } = useSocket();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return undefined;
    return subscribe((ev) => {
      if (ev.type === "new_match") {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["likes"] });
        qc.invalidateQueries({ queryKey: ["likes-sent"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        const m = ev.match;
        banner({
          title: "It's a match!",
          sub: `You and ${m.user?.name} liked each other. Say hi.`,
          photo: m.user?.photos?.[0],
          name: m.user?.name,
          onClick: () => navigate(`/chats/${m.id}`),
          duration: 5000,
          testId: "toast-new-match",
        });
      } else if (ev.type === "message") {
        qc.invalidateQueries({ queryKey: ["matches"] });
        const inRoom = location.pathname === `/chats/${ev.match_id}`;
        if (!inRoom && ev.message?.sender_id !== user.id && ev.message?.kind !== "reaction") {
          banner({
            title: ev.sender_name || "New message",
            sub: ev.message?.text,
            photo: ev.sender_photo,
            name: ev.sender_name || "?",
            onClick: () => navigate(`/chats/${ev.match_id}`),
            duration: 4000,
            testId: "toast-new-message",
          });
        }
      } else if (ev.type === "verification") {
        refresh?.();
        banner({
          title: ev.status === "approved" ? "You're verified" : "Selfie not approved",
          sub: ev.status === "approved" ? "The black tick now shows on your profile." : ev.note || "Take a clearer selfie and try again.",
          onClick: () => navigate(ev.status === "approved" ? "/profile" : "/verify"),
          duration: 6000,
          testId: "toast-verification",
        });
      } else if (ev.type === "dm_request") {
        qc.invalidateQueries({ queryKey: ["matches"] });
        const m = ev.match;
        banner({
          title: `${m?.user?.name || "Someone"} sent you a message request`,
          sub: "Open it to accept or delete.",
          photo: m?.user?.photos?.[0],
          name: m?.user?.name || "?",
          onClick: () => navigate(`/chats/${ev.match_id}`),
          duration: 5000,
          testId: "toast-dm-request",
        });
      } else if (ev.type === "dm_accepted" || ev.type === "message_deleted") {
        qc.invalidateQueries({ queryKey: ["matches"] });
      } else if (ev.type === "unmatch") {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
      }
    });
  }, [subscribe, user, qc, navigate, location.pathname, refresh]);
  return null;
};

/* Catches a render crash inside a screen so the user sees a retry card instead of a blank white area. */
class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("Screen crashed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-full flex-col items-center justify-center px-8 text-center" data-testid="screen-error">
          <p className="text-[20px] font-bold text-ink">Something went wrong</p>
          <p className="mt-2 text-[15px] text-mute">This screen could not be shown. Please try again.</p>
          <button type="button" className="vo-btn-primary mt-6 px-8" onClick={() => window.location.reload()} data-testid="screen-error-reload">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/*
 * Screen container. Tabs fade in, pushed screens (chat room, edit profile, filters...) slide in from the right.
 * The entrance is a plain CSS animation on an element whose resting style is fully visible: even if the browser
 * throttles or skips the animation (mobile Safari, background tabs) the screen is always shown. No JS-driven
 * exit/wait phase exists any more - that is what left the page blank until a reload.
 */
const TAB_PATHS = ["/discover", "/explore", "/likes", "/chats", "/profile"];
const isTab = (path) => TAB_PATHS.includes(path);

/* Fallback while a lazily loaded screen's code downloads: same soft canvas, single activity spinner (iOS). */
const RouteLoader = () => (
  <div className="vo-neu-page flex min-h-full flex-1 items-center justify-center" data-testid="route-loader" aria-busy="true">
    <Spinner size={26} stroke={2.4} className="text-mute" />
  </div>
);

export const AppShell = ({ nav = false }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const tab = isTab(pathname);
  // full-bleed black screens (Discover feed, single post): paint the status-bar strip black and ask the shell for light icons
  const blackCanvas = pathname === "/discover" || pathname.startsWith("/p/");
  useEffect(() => {
    nativeSetBars(blackCanvas ? "dark" : null);
    return () => nativeSetBars(null);
  }, [blackCanvas]);
  /*
   * Fully responsive shell: fills the device width (max 430px, centred on wide screens) and the full dynamic viewport
   * height; each screen lays itself out with flex/grid and scrolls inside <main>. No transform scaling.
   */
  return (
    <div className="vo-backdrop">
      <div className="vo-shell" data-canvas={blackCanvas ? "black" : undefined} data-testid="app-shell">
        <main key={pathname} className={`vo-scroll relative ${tab ? "vo-page-fade" : "vo-page-push"}`} id="vo-main">
          <ScreenErrorBoundary key={pathname}>
            {/* screens are code-split; while a screen's code is still arriving, a centred spinner sits on its canvas */}
            <Suspense fallback={<RouteLoader />}>
              <Outlet />
            </Suspense>
          </ScreenErrorBoundary>
        </main>
        {nav && <BottomNav />}
        <OfflineBanner />
        <FeedbackLayer nav={nav} />
        {user && <RealtimeToasts />}
        {user && nav && <AiSearchLayer />}
      </div>
    </div>
  );
};
