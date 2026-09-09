import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { UserPhoto } from "@/components/UserPhoto";

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
              className="flex w-[340px] items-center gap-3 rounded-[18px] border border-line bg-white p-3 text-left shadow-[var(--vo-shadow)]"
            >
              <UserPhoto src={m.user?.photos?.[0]} name={m.user?.name} className="h-11 w-11 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[15px] font-semibold text-ink">It's a Voila!</div>
                <div className="truncate text-[13px] text-mute">You and {m.user?.name} liked each other. Say hi.</div>
              </div>
            </button>
          ),
          { duration: 6000 }
        );
      } else if (ev.type === "message") {
        qc.invalidateQueries({ queryKey: ["matches"] });
        const inRoom = location.pathname === `/chats/${ev.match_id}`;
        if (!inRoom && ev.message?.sender_id !== user.id) {
          toast.custom(
            (id) => (
              <button
                type="button"
                data-testid="toast-new-message"
                onClick={() => {
                  toast.dismiss(id);
                  navigate(`/chats/${ev.match_id}`);
                }}
                className="flex w-[340px] items-center gap-3 rounded-[18px] border border-line bg-white p-3 text-left shadow-[var(--vo-shadow)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-dark font-display font-bold">
                  {(ev.sender_name || "N")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-ink">New message</div>
                  <div className="truncate text-[13px] text-mute">{ev.message?.text}</div>
                </div>
              </button>
            ),
            { duration: 4000 }
          );
        }
      } else if (ev.type === "unmatch") {
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
    });
  }, [subscribe, user, qc, navigate, location.pathname]);
  return null;
};

export const AppShell = ({ nav = false }) => {
  const { user } = useAuth();
  return (
    <div className="vo-backdrop">
      <div className="vo-shell" data-testid="app-shell">
        <main className="vo-scroll relative" id="vo-main">
          <Outlet />
        </main>
        {nav && <BottomNav />}
        {user && <RealtimeToasts />}
      </div>
    </div>
  );
};
