import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { tween, D, EASE_OUT } from "@/lib/motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { UserPhoto } from "@/components/UserPhoto";

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

/* Tabs swap with a quick fade; pushed screens (chat room, edit profile, filters...) slide in from the right. */
const TAB_PATHS = ["/discover", "/explore", "/likes", "/chats", "/profile"];
const isTab = (path) => TAB_PATHS.includes(path);

export const AppShell = ({ nav = false }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const tab = isTab(pathname);
  return (
    <div className="vo-backdrop">
      <div className="vo-shell" data-testid="app-shell">
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            className="vo-scroll relative"
            id="vo-main"
            initial={tab ? { opacity: 0 } : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={tab ? { opacity: 0 } : { opacity: 0, x: 16 }}
            transition={tween(tab ? D.fast : D.base, 0, EASE_OUT)}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
        {nav && <BottomNav />}
        {user && <RealtimeToasts />}
      </div>
    </div>
  );
};
