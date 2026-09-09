import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { UserPhoto } from "@/components/UserPhoto";
import { useFitScale, shellStyle } from "@/hooks/useFitScale";

/* Tap-to-open banners for realtime events (new match, new message). */
const RealtimeToasts = () => {
  const { subscribe } = useSocket();
  const { user } = useAuth();
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
        toast.custom(
          (id) => (
            <button
              type="button"
              data-testid="toast-new-match"
              onClick={() => {
                toast.dismiss(id);
                navigate(`/chats/${m.id}`);
              }}
              className="vo-banner"
            >
              <UserPhoto src={m.user?.photos?.[0]} name={m.user?.name} className="h-11 w-11 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-ink">It's a match!</div>
                <div className="mt-0.5 truncate text-[13px] text-mute">You and {m.user?.name} liked each other.</div>
              </div>
            </button>
          ),
          { duration: 5000 }
        );
      } else if (ev.type === "message") {
        qc.invalidateQueries({ queryKey: ["matches"] });
        const inRoom = location.pathname === `/chats/${ev.match_id}`;
        if (!inRoom && ev.message?.sender_id !== user.id && ev.message?.kind !== "reaction") {
          toast.custom(
            (id) => (
              <button
                type="button"
                data-testid="toast-new-message"
                onClick={() => {
                  toast.dismiss(id);
                  navigate(`/chats/${ev.match_id}`);
                }}
                className="vo-banner"
              >
                <UserPhoto src={ev.sender_photo} name={ev.sender_name || "?"} className="h-11 w-11 rounded-full text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-ink">{ev.sender_name || "New message"}</div>
                  <div className="mt-0.5 truncate text-[13px] text-mute">{ev.message?.text}</div>
                </div>
              </button>
            ),
            { duration: 4000 }
          );
        }
      } else if (ev.type === "unmatch") {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
      }
    });
  }, [subscribe, user, qc, navigate, location.pathname]);
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

export const AppShell = ({ nav = false }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const tab = isTab(pathname);
  const fit = useFitScale();
  return (
    <div className="vo-backdrop">
      <div className="vo-shell" style={shellStyle(fit)} data-fit-scale={fit.scale} data-testid="app-shell">
        <main key={pathname} className={`vo-scroll relative ${tab ? "vo-page-fade" : "vo-page-push"}`} id="vo-main">
          <ScreenErrorBoundary key={pathname}>
            <Outlet />
          </ScreenErrorBoundary>
        </main>
        {nav && <BottomNav />}
        {user && <RealtimeToasts />}
      </div>
    </div>
  );
};
