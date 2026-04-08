import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBRL(value: number | undefined | null): string {
  if (value === undefined || value === null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatBRLSafe(value: number | null | undefined): string {
  if (value == null) return "Sem dados";
  return formatBRL(value);
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  try {
    return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateString;
  }
}

export function formatMonthDay(dateString: string | undefined): string {
  if (!dateString) return "";
  try {
    return format(parseISO(dateString), "dd MMM", { locale: ptBR });
  } catch {
    return dateString;
  }
}

export function formatRating(rating: number | null | undefined): string {
  if (rating == null) return "Sem dados";
  return rating.toFixed(1);
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return "Sem dados";
  return `${km.toFixed(1)} km`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return "Sem dados";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export const formatCurrency = formatBRL;
