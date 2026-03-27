import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/api";

export type InsightStatus = "good" | "average" | "bad";

export interface Insight {
  type: string;
  status: InsightStatus;
  title: string;
  message: string;
  suggestion: string;
}

export function useInsights() {
  const BASE = getApiBase();

  return useQuery<Insight[]>({
    queryKey: ["/api/insights"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/insights`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
