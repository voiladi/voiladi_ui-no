import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/context/SocketContext";

/* Notifications feed (+ unseen count for the bell dot). Refreshes on realtime events. */
export const useNotifications = (enabled = true) => {
  const qc = useQueryClient();
  const { subscribe } = useSocket();
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe((ev) => {
      if (["new_match", "message", "like", "unmatch"].includes(ev.type)) qc.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [subscribe, qc, enabled]);
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
    enabled,
    staleTime: 15000,
    refetchInterval: 45000,
  });
};

export const markNotificationsSeen = async (qc) => {
  try {
    await api.post("/notifications/seen");
    // keep the current list (with its New / Earlier split) but drop the bell dot
    qc.setQueryData(["notifications"], (old) => (old ? { ...old, unseen_count: 0 } : old));
  } catch (e) {
    // ignore
  }
};
