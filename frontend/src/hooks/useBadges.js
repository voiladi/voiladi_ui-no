import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useMatchesQuery = (enabled = true) =>
  useQuery({
    queryKey: ["matches"],
    queryFn: async () => (await api.get("/matches")).data,
    enabled,
    staleTime: 15000,
    refetchInterval: 30000,
  });

export const useLikesQuery = (enabled = true) =>
  useQuery({
    queryKey: ["likes"],
    queryFn: async () => (await api.get("/likes/received")).data,
    enabled,
    staleTime: 15000,
    refetchInterval: 45000,
  });

export const useBadges = () => {
  const m = useMatchesQuery();
  const l = useLikesQuery();
  return { unread: m.data?.total_unread || 0, likes: l.data?.count || 0 };
};
