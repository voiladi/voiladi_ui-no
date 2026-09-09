import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const FALLBACK = {
  interests: ["Travel", "Music", "Food", "Fitness", "Movies", "Gaming", "Art", "Photography", "Nature", "Festivals", "Cars", "Books", "Anime", "Pets"],
  goals: ["Friends", "Something casual", "Long-term", "Not sure yet"],
  prompts: [], icebreakers: [], cities: [], genders: ["woman", "man", "nonbinary"],
  show_me: ["women", "men", "everyone"], report_reasons: ["Something else"], anywhere_km: 250, max_photos: 6,
};

export const useMeta = () => {
  const q = useQuery({
    queryKey: ["meta"],
    queryFn: async () => (await api.get("/meta")).data,
    staleTime: Infinity,
  });
  return { meta: q.data || FALLBACK, loading: q.isLoading, error: q.error };
};
