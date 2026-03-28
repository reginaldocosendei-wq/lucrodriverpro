import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "./api";

const BASE = getApiBase();

export interface ExtraEarning {
  id: number;
  userId: number;
  date: string;
  type: string;
  amount: number;
  note: string;
  createdAt: string;
}

export const EXTRA_EARNING_TYPES = [
  { value: "tip_cash",    label: "Gorjeta em dinheiro" },
  { value: "tip_pix",     label: "Gorjeta em Pix" },
  { value: "cash_ride",   label: "Corrida em dinheiro" },
  { value: "bonus",       label: "Bônus" },
  { value: "other",       label: "Outro" },
] as const;

export function typeLabel(type: string): string {
  return EXTRA_EARNING_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function extraEarningsQueryKey(date?: string) {
  return date ? ["/api/extra-earnings", date] : ["/api/extra-earnings"];
}

export function useExtraEarnings(date?: string) {
  const url = date
    ? `${BASE}/api/extra-earnings?date=${date}`
    : `${BASE}/api/extra-earnings`;
  return useQuery<ExtraEarning[]>({
    queryKey: extraEarningsQueryKey(date),
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao buscar ganhos extras");
      return r.json();
    },
    staleTime: 1000 * 60,
    retry: false,
  });
}

export function useAddExtraEarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { date: string; type: string; amount: number; note?: string }) => {
      const r = await fetch(`${BASE}/api/extra-earnings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar");
      }
      return r.json() as Promise<ExtraEarning>;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: extraEarningsQueryKey(vars.date) });
      qc.invalidateQueries({ queryKey: extraEarningsQueryKey() });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    },
  });
}

export function useUpdateExtraEarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { id: number; type: string; amount: number; note?: string; date: string }) => {
      const r = await fetch(`${BASE}/api/extra-earnings/${body.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: body.type, amount: body.amount, note: body.note }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao atualizar");
      }
      return r.json() as Promise<ExtraEarning>;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: extraEarningsQueryKey(vars.date) });
      qc.invalidateQueries({ queryKey: extraEarningsQueryKey() });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    },
  });
}

export function useDeleteExtraEarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; date: string }) => {
      const r = await fetch(`${BASE}/api/extra-earnings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Erro ao excluir");
      return r.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: extraEarningsQueryKey(vars.date) });
      qc.invalidateQueries({ queryKey: extraEarningsQueryKey() });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    },
  });
}
