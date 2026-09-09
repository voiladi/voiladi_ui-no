import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Real numbers for the profile page and the Voila allowance shown on Discover. */
export const useStats = (enabled = true) =>
  useQuery({
    queryKey: ["stats"],
    queryFn: async () => (await api.get("/me/stats")).data,
    staleTime: 30_000,
    enabled,
  });
