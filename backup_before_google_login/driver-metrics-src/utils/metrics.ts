export function safeDiv(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export function earningsPerTrip(earnings: number, trips: number): number | null {
  return safeDiv(earnings, trips);
}

export function earningsPerKm(earnings: number, km: number | null | undefined): number | null {
  return safeDiv(earnings, km);
}

export function earningsPerHour(earnings: number, hours: number | null | undefined): number | null {
  return safeDiv(earnings, hours);
}

export function ratingQuality(rating: number | null | undefined): {
  label: string;
  color: string;
} {
  if (rating == null) return { label: "Sem dados", color: "#6b7280" };
  if (rating >= 4.8) return { label: "Excelente", color: "#00ff88" };
  if (rating >= 4.5) return { label: "Ótimo", color: "#4ade80" };
  if (rating >= 4.0) return { label: "Bom", color: "#eab308" };
  return { label: "Atenção", color: "#ef4444" };
}

export function kmQuality(earningsPerKmValue: number | null | undefined): {
  label: string;
  color: string;
} {
  if (earningsPerKmValue == null) return { label: "—", color: "#6b7280" };
  if (earningsPerKmValue >= 3) return { label: "Excelente", color: "#00ff88" };
  if (earningsPerKmValue >= 2) return { label: "Bom", color: "#4ade80" };
  if (earningsPerKmValue >= 1.5) return { label: "Regular", color: "#eab308" };
  return { label: "Baixo", color: "#ef4444" };
}

export function realProfit(earnings: number, costs: number): number {
  return earnings - costs;
}

export function profitMarginPct(earnings: number, costs: number): number {
  if (earnings <= 0) return 0;
  return ((earnings - costs) / earnings) * 100;
}
