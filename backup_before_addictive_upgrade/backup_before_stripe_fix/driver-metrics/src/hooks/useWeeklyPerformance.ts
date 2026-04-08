import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/api";

export interface PerformanceDay {
  date: string;
  label: string;
  dayFull: string;
  earnings: number;
  costs: number;
  profit: number;
  trips: number;
  hours: number | null;
  km: number | null;
  isToday: boolean;
  isYesterday: boolean;
}

export interface WeeklyPerformance {
  days: PerformanceDay[];
  bestDay: PerformanceDay | null;
  worstDay: PerformanceDay | null;
  avgProfit: number | null;
  avgEarnings: number | null;
  totalProfit: number | null;
}

export function useWeeklyPerformance() {
  const BASE = getApiBase();

  return useQuery<WeeklyPerformance>({
    queryKey: ["/api/weekly-performance"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/weekly-performance`, {
        credentials: "include",
      });
      if (!res.ok) return { days: [], bestDay: null, worstDay: null, avgProfit: null, avgEarnings: null, totalProfit: null };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
