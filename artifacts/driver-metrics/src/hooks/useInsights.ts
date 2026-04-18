import { useQuery } from "@tanstack/react-query";
import { getApiBase, authFetch } from "@/lib/api";

export type InsightStatus = "good" | "average" | "bad";

export interface Insight {
  type: string;
  status: InsightStatus;
  title: string;
  message: string;
  suggestion: string;
}

export interface Decision {
  score: number;
  status: InsightStatus;
  verdict: string;
  message: string;
  suggestion: string;
  dominantCause: string;
  stopNow: boolean;
  dropPercent: number | null;
}

export interface InsightsResponse {
  decision: Decision | null;
  insights: Insight[];
}

export function useInsights() {
  const BASE = getApiBase();

  return useQuery<InsightsResponse>({
    queryKey: ["/api/insights"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/insights`, {
        credentials: "include",
      });
      if (!res.ok) return { decision: null, insights: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
