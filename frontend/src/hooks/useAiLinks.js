import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/* The signed-in user's connected AI accounts (ChatGPT / Claude / Gemini). Keys never reach the client - only a last-4 hint. */
export const useAiLinks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ai-links"],
    queryFn: async () => (await api.get("/ai/links")).data,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const links = q.data?.links || [];
  const active = links.find((l) => l.provider === q.data?.active) || links[0] || null;
  return { ...q, links, active, providers: q.data?.providers || [], refresh: () => qc.invalidateQueries({ queryKey: ["ai-links"] }) };
};
