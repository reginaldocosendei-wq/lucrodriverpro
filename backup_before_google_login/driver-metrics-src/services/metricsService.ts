export function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

export function formatMetric(
  value: number | null | undefined,
  opts: { prefix?: string; suffix?: string; decimals?: number } = {}
): string {
  if (value == null) return "Sem dados";
  const { prefix = "", suffix = "", decimals = 2 } = opts;
  return `${prefix}${value.toFixed(decimals)}${suffix}`;
}

export function formatBRLSafe(value: number | null | undefined): string {
  if (value == null) return "Sem dados";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatRating(rating: number | null | undefined): string {
  if (rating == null) return "Sem dados";
  return rating.toFixed(1);
}

export function qualityLabel(earningsPerKm: number | null): {
  label: string;
  color: string;
} {
  if (earningsPerKm == null) return { label: "—", color: "#6b7280" };
  if (earningsPerKm >= 3) return { label: "Excelente", color: "#00ff88" };
  if (earningsPerKm >= 2) return { label: "Bom", color: "#4ade80" };
  if (earningsPerKm >= 1.5) return { label: "Regular", color: "#eab308" };
  return { label: "Baixo", color: "#ef4444" };
}
