import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "./api";
import { authFetch } from "@/lib/api";

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

// ── Type registry ─────────────────────────────────────────────────────────────
// Must stay in sync with ALLOWED_TYPES in api-server/src/routes/extraEarnings.ts
export const EXTRA_EARNING_TYPES = [
  { value: "cash_ride",   label: "Corrida em dinheiro" },
  { value: "tip_pix",     label: "Gorjeta em Pix" },
  { value: "tip_cash",    label: "Gorjeta em dinheiro" },
  { value: "bonus",       label: "Bônus" },
  { value: "adjustment",  label: "Ajuste" },
  { value: "other",       label: "Outro ganho" },
] as const;

export type ExtraEarningTypeValue = (typeof EXTRA_EARNING_TYPES)[number]["value"];

const ALLOWED_TYPE_VALUES = new Set(EXTRA_EARNING_TYPES.map((t) => t.value));
const MAX_AMOUNT = 50_000;

/** Human-readable label for any type string; falls back to the raw value for forward-compat. */
export function typeLabel(type: string): string {
  return EXTRA_EARNING_TYPES.find((t) => t.value === type)?.label ?? type;
}

// ── Validation ────────────────────────────────────────────────────────────────
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

function validateEarningFields(fields: {
  date: string;
  type: string;
  amount: number;
  note?: string;
}): void {
  if (!isValidDate(fields.date)) throw new Error("Data inválida");
  if (!ALLOWED_TYPE_VALUES.has(fields.type as ExtraEarningTypeValue))
    throw new Error("Tipo de ganho inválido");
  if (!isFinite(fields.amount) || fields.amount <= 0)
    throw new Error("Valor deve ser maior que R$ 0");
  if (fields.amount > MAX_AMOUNT)
    throw new Error(`Valor não pode ultrapassar R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}`);
}

// ── Query keys ────────────────────────────────────────────────────────────────
export function extraEarningsQueryKey(date?: string) {
  return date ? ["/api/extra-earnings", date] : ["/api/extra-earnings"];
}

/** Invalidates all extra-earnings queries (both dated and undated) + the dashboard. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>, date?: string) {
  // Dated cache (per-day panels)
  if (date) qc.invalidateQueries({ queryKey: extraEarningsQueryKey(date) });
  // Full list (manual-only cards, history page)
  qc.invalidateQueries({ queryKey: extraEarningsQueryKey() });
  // Dashboard totals, goal progress, profit
  qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
export function useExtraEarnings(date?: string) {
  const url = date
    ? `${BASE}/api/extra-earnings?date=${date}`
    : `${BASE}/api/extra-earnings`;
  return useQuery<ExtraEarning[]>({
    queryKey: extraEarningsQueryKey(date),
    queryFn: async () => {
      const r = await authFetch(url, { credentials: "include" });
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
      // Client-side guard — prevents obviously bad data from hitting the network
      validateEarningFields(body);

      const r = await authFetch(`${BASE}/api/extra-earnings`, {
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
      invalidateAll(qc, vars.date);
    },
  });
}

export function useUpdateExtraEarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { id: number; type: string; amount: number; note?: string; date: string }) => {
      // Client-side guard
      validateEarningFields({ date: body.date, type: body.type, amount: body.amount, note: body.note });

      const r = await authFetch(`${BASE}/api/extra-earnings/${body.id}`, {
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
      invalidateAll(qc, vars.date);
    },
  });
}

export function useDeleteExtraEarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; date: string }) => {
      if (!Number.isInteger(id) || id <= 0) throw new Error("ID inválido");

      const r = await authFetch(`${BASE}/api/extra-earnings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao excluir");
      }
      return r.json();
    },
    onSuccess: (_data, vars) => {
      invalidateAll(qc, vars.date);
    },
  });
}
