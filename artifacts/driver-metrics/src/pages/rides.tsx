import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Calendar, Navigation, Clock, Star,
  Trash2, TrendingUp, AlertCircle, Plus, CheckCircle,
  FlaskConical, TriangleAlert,
} from "lucide-react";
import { Link } from "wouter";
import { formatBRL, formatDate } from "@/lib/utils";
import { getApiBase } from "@/lib/api";

const BASE = getApiBase();

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailySummary {
  id: number | null;
  source: "summary" | "rides";
  date: string;
  earnings: number;
  trips: number;
  kmDriven: number | null;
  hoursWorked: number | null;
  rating: number | null;
  platform: string | null;
  notes: string | null;
}

type Filter = "all" | "week" | "today";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function platformColor(p: string | null) {
  if (!p) return "#6b7280";
  const l = p.toLowerCase();
  if (l.includes("uber")) return "#00b4d8";
  if (l.includes("99")) return "#fbbf24";
  if (l.includes("indriver")) return "#22c55e";
  return "#a78bfa";
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function isoWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "#6b7280", display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{ color: "#f9fafb", fontSize: 13, fontWeight: 600 }}>{value}</span>
      <span style={{ color: "#4b5563", fontSize: 11 }}>{label}</span>
    </div>
  );
}

// ── Confirmation modal ────────────────────────────────────────────────────────
function ConfirmModal({
  onConfirm, onCancel, isDeleting,
}: { onConfirm: () => void; onCancel: () => void; isDeleting: boolean }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(6px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          padding: "0 0 24px",
        }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 420,
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 24,
            padding: "28px 24px 24px",
            margin: "0 16px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          }}
        >
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
          }}>
            <Trash2 size={22} color="#ef4444" />
          </div>

          <p style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb", textAlign: "center", marginBottom: 10 }}>
            Excluir registro?
          </p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 1.6, marginBottom: 28 }}>
            Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita.
          </p>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, height: 48, borderRadius: 14,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)", fontWeight: 700,
                fontSize: 15, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              style={{
                flex: 1, height: 48, borderRadius: 14,
                background: isDeleting ? "rgba(239,68,68,0.4)" : "#ef4444",
                border: "none",
                color: "#fff", fontWeight: 800,
                fontSize: 15, cursor: isDeleting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {isDeleting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                />
              ) : (
                <>
                  <Trash2 size={15} strokeWidth={2.5} />
                  Excluir
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 200, maxWidth: 360, width: "calc(100% - 40px)",
        background: type === "success" ? "rgba(0,255,136,0.12)" : "rgba(239,68,68,0.12)",
        border: `1px solid ${type === "success" ? "rgba(0,255,136,0.3)" : "rgba(239,68,68,0.3)"}`,
        borderRadius: 16, padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 12,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        pointerEvents: "none",
      }}
    >
      {type === "success"
        ? <CheckCircle size={18} color="#00ff88" />
        : <AlertCircle size={18} color="#ef4444" />}
      <p style={{ fontSize: 14, fontWeight: 700, color: type === "success" ? "#00ff88" : "#f87171" }}>
        {message}
      </p>
    </motion.div>
  );
}

// ─── Dev Admin Panel (only rendered when import.meta.env.DEV === true) ────────
function DevAdminPanel({
  onPurged,
  showToast,
}: {
  onPurged: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const queryClient = useQueryClient();
  type Summary = { rides: number; summaries: number };
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [confirming, setConfirming]   = useState(false);
  const [purging, setPurging]         = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoadingCount(true);
    try {
      const res  = await fetch(`${BASE}/api/dev/test-data-summary`, { credentials: "include" });
      const data = await res.json();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoadingCount(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res  = await fetch(`${BASE}/api/dev/purge-test-data`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      showToast(
        `Removidos: ${data.deleted.rides} corridas e ${data.deleted.summaries} resumos.`,
        "success",
      );
      setConfirming(false);
      onPurged();
      fetchSummary();
    } catch {
      showToast("Erro ao remover os dados de teste.", "error");
    } finally {
      setPurging(false);
    }
  };

  const total = (summary?.rides ?? 0) + (summary?.summaries ?? 0);

  return (
    <div style={{ marginTop: 32 }}>
      {/* DEV badge separator */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(239,68,68,0.15)" }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 6, padding: "3px 8px",
        }}>
          <FlaskConical size={11} color="#ef4444" />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#ef4444", textTransform: "uppercase" }}>
            Modo DEV
          </span>
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(239,68,68,0.15)" }} />
      </div>

      {/* Panel card */}
      <div style={{
        background: "rgba(239,68,68,0.04)",
        border: "1px solid rgba(239,68,68,0.14)",
        borderRadius: 18, padding: "18px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TriangleAlert size={16} color="#ef4444" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)", marginBottom: 3 }}>
              Apagar todos os registros de teste
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
              Remove <strong style={{ color: "rgba(255,255,255,0.5)" }}>todas as corridas e resumos diários</strong> da conta atual.
              Irreversível — use apenas para limpar dados de teste.
            </p>
          </div>
        </div>

        {/* Count summary */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16,
        }}>
          {[
            { label: "Corridas", value: loadingCount ? "…" : String(summary?.rides ?? 0) },
            { label: "Resumos",  value: loadingCount ? "…" : String(summary?.summaries ?? 0) },
            { label: "Total",    value: loadingCount ? "…" : String(total) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "10px 10px", textAlign: "center",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#f9fafb", marginBottom: 2 }}>{value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <AnimatePresence mode="wait">
          {!confirming ? (
            <motion.button
              key="trigger"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirming(true)}
              disabled={loadingCount || total === 0}
              style={{
                width: "100%", height: 44, borderRadius: 13,
                background: total === 0 ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${total === 0 ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.25)"}`,
                color: total === 0 ? "rgba(255,255,255,0.2)" : "#ef4444",
                fontWeight: 700, fontSize: 13, cursor: total === 0 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <Trash2 size={14} strokeWidth={2.5} />
              {total === 0 ? "Nenhum registro encontrado" : `Apagar ${total} registros de teste`}
            </motion.button>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, textAlign: "center", marginBottom: 4 }}>
                ⚠️ Tem certeza? Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirming(false)}
                  style={{
                    flex: 1, height: 42, borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePurge}
                  disabled={purging}
                  style={{
                    flex: 1, height: 42, borderRadius: 12,
                    background: purging ? "rgba(239,68,68,0.3)" : "#ef4444",
                    border: "none",
                    color: "#fff", fontWeight: 800, fontSize: 13,
                    cursor: purging ? "not-allowed" : "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {purging ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                      style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                    />
                  ) : (
                    <><Trash2 size={13} /> Apagar tudo</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1] as any, duration: 0.38 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function RidesPage() {
  const queryClient = useQueryClient();
  const [summaries, setSummaries]       = useState<DailySummary[] | null>(null);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [filter, setFilter]             = useState<Filter>("all");
  const [confirmTarget, setConfirmTarget] = useState<{ id: number | null; date: string; source: "summary" | "rides" } | null>(null);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [toast, setToast]                 = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ── Load records ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${BASE}/api/daily-summaries`, { credentials: "include" });
        if (!res.ok) throw new Error("Erro ao carregar registros");
        const data = await res.json();
        if (!cancelled) setSummaries(data);
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Toast auto-hide ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!summaries) return [];
    if (filter === "today") {
      const today = isoToday();
      return summaries.filter((s) => s.date === today);
    }
    if (filter === "week") {
      const weekAgo = isoWeekAgo();
      return summaries.filter((s) => s.date >= weekAgo);
    }
    return summaries;
  }, [summaries, filter]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalEarnings = filtered.reduce((s, r) => s + r.earnings, 0);
  const totalTrips    = filtered.reduce((s, r) => s + r.trips, 0);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!confirmTarget) return;
    setIsDeleting(true);
    try {
      let res: Response;
      if (confirmTarget.source === "rides") {
        res = await fetch(`${BASE}/api/rides/day/${confirmTarget.date}`, {
          method: "DELETE",
          credentials: "include",
        });
      } else {
        res = await fetch(`${BASE}/api/daily-summaries/${confirmTarget.id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
      if (!res.ok) throw new Error();
      setSummaries((prev) =>
        prev?.filter((s) => {
          if (confirmTarget.source === "rides") return s.date !== confirmTarget.date || s.source !== "rides";
          return s.id !== confirmTarget.id;
        }) ?? null
      );
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setToast({ message: "Registro excluído com sucesso.", type: "success" });
    } catch {
      setToast({ message: "Não foi possível excluir este registro.", type: "error" });
    } finally {
      setIsDeleting(false);
      setConfirmTarget(null);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      {confirmTarget != null && (
        <ConfirmModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => !isDeleting && setConfirmTarget(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0,
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(16px)",
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/">
            <button style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
              <ChevronLeft size={22} />
            </button>
          </Link>
          <div>
            <p style={{ color: "#f9fafb", fontWeight: 700, fontSize: 17 }}>Histórico</p>
            {summaries && summaries.length > 0 && (
              <p style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
                {summaries.length} registro{summaries.length !== 1 ? "s" : ""} salvos
              </p>
            )}
          </div>
        </div>
        <Link href="/import">
          <button style={{
            background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)",
            borderRadius: 10, padding: "7px 14px",
            color: "#00ff88", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
          }}>
            <Plus size={14} /> Novo
          </button>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: "center", paddingTop: 64 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                border: "3px solid rgba(0,255,136,0.12)",
                borderTopColor: "#00ff88",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ color: "#6b7280", fontSize: 14 }}>Carregando registros...</p>
          </div>
        )}

        {/* ── Load error ──────────────────────────────────────────────────── */}
        {loadError && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 14, padding: "14px 16px", marginBottom: 20,
            color: "#f87171", fontSize: 14, display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={16} /> {loadError}
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {!loading && summaries != null && (
          <>
            {/* ── Filter tabs ─────────────────────────────────────────────── */}
            {summaries.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["all", "week", "today"] as Filter[]).map((f) => {
                  const label = f === "all" ? "Todos" : f === "week" ? "Esta semana" : "Hoje";
                  const active = filter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: "7px 16px", borderRadius: 20,
                        background: active ? "#00ff88" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "#00ff88" : "rgba(255,255,255,0.08)"}`,
                        color: active ? "#000" : "rgba(255,255,255,0.45)",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit", transition: "all 0.18s ease",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Empty (global) ───────────────────────────────────────────── */}
            {summaries.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: "center", paddingTop: 64 }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <Calendar size={32} color="#374151" />
                </div>
                <p style={{ color: "#f9fafb", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                  Você ainda não tem registros salvos.
                </p>
                <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
                  Importe seu primeiro resultado por screenshot para ver o histórico aqui.
                </p>
                <Link href="/import">
                  <button style={{
                    padding: "14px 28px", borderRadius: 14, border: "none",
                    background: "#00ff88",
                    color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer",
                    fontFamily: "inherit",
                  }}>
                    Importar resultado
                  </button>
                </Link>
              </motion.div>
            )}

            {/* ── Empty (filter) ───────────────────────────────────────────── */}
            {summaries.length > 0 && filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ textAlign: "center", paddingTop: 48 }}
              >
                <p style={{ color: "#6b7280", fontSize: 15 }}>
                  Nenhum registro {filter === "today" ? "de hoje" : "desta semana"}.
                </p>
                <button
                  onClick={() => setFilter("all")}
                  style={{
                    marginTop: 14, background: "none", border: "none",
                    color: "#00ff88", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Ver todos os registros
                </button>
              </motion.div>
            )}

            {/* ── Records ──────────────────────────────────────────────────── */}
            {filtered.length > 0 && (
              <motion.div variants={container} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Totals summary bar */}
                <motion.div variants={itemAnim}>
                  <div style={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 18, padding: "14px 18px",
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
                    marginBottom: 4,
                  }}>
                    <div>
                      <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                        {filter === "today" ? "Hoje" : filter === "week" ? "Semana" : "Total"}
                      </p>
                      <p style={{ color: "#00ff88", fontWeight: 800, fontSize: 17, fontVariantNumeric: "tabular-nums" }}>
                        {formatBRL(totalEarnings)}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Corridas</p>
                      <p style={{ color: "#f9fafb", fontWeight: 800, fontSize: 17 }}>{totalTrips}</p>
                    </div>
                    <div>
                      <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Dias</p>
                      <p style={{ color: "#f9fafb", fontWeight: 800, fontSize: 17 }}>{filtered.length}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Section heading */}
                <motion.div variants={itemAnim}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: 4, marginTop: 8 }}>
                    Registros salvos
                  </p>
                </motion.div>

                {/* Individual cards */}
                <AnimatePresence initial={false}>
                  {filtered.map((summary) => {
                    const perTrip = summary.trips > 0 ? summary.earnings / summary.trips : null;
                    const perKm   = summary.kmDriven   && summary.kmDriven   > 0 ? summary.earnings / summary.kmDriven   : null;
                    const perHour = summary.hoursWorked && summary.hoursWorked > 0 ? summary.earnings / summary.hoursWorked : null;

                    return (
                      <motion.div
                        key={summary.id}
                        variants={itemAnim}
                        layout
                        exit={{ opacity: 0, x: -30, transition: { duration: 0.25 } }}
                      >
                        <div style={{
                          background: "#111",
                          borderRadius: 20,
                          border: "1px solid rgba(255,255,255,0.06)",
                          overflow: "hidden",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                        }}>
                          {/* Top row: date + earnings + delete */}
                          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ flex: 1 }}>
                                {/* Platform badge + date */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                  {summary.platform && (
                                    <span style={{
                                      background: platformColor(summary.platform),
                                      borderRadius: 5, padding: "2px 8px",
                                      color: "#fff", fontSize: 11, fontWeight: 700,
                                    }}>
                                      {summary.platform}
                                    </span>
                                  )}
                                  <span style={{ color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                                    <Calendar size={11} />
                                    {formatDate(summary.date)}
                                  </span>
                                </div>

                                {/* Earnings */}
                                <p style={{ color: "#00ff88", fontWeight: 900, fontSize: 26, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                                  {formatBRL(summary.earnings)}
                                </p>
                                <p style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                                  {summary.trips} corrida{summary.trips !== 1 ? "s" : ""}
                                </p>
                              </div>

                              {/* Delete button */}
                              <button
                                onClick={() => setConfirmTarget({ id: summary.id, date: summary.date, source: summary.source })}
                                style={{
                                  background: "rgba(239,68,68,0.07)",
                                  border: "1px solid rgba(239,68,68,0.15)",
                                  borderRadius: 12, padding: "10px 10px",
                                  color: "#ef4444", cursor: "pointer",
                                  display: "flex", alignItems: "center", gap: 5,
                                  flexShrink: 0, fontFamily: "inherit",
                                  fontSize: 12, fontWeight: 700,
                                  transition: "background 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.14)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.07)")}
                              >
                                <Trash2 size={14} strokeWidth={2.5} />
                                <span style={{ display: "none" }}>Excluir</span>
                              </button>
                            </div>
                          </div>

                          {/* Metrics row */}
                          {(perTrip != null || perKm != null || perHour != null || summary.kmDriven != null || summary.hoursWorked != null || summary.rating != null) && (
                            <div style={{
                              padding: "10px 18px",
                              display: "flex", flexWrap: "wrap", gap: 14,
                              background: "rgba(255,255,255,0.01)",
                            }}>
                              {perTrip  != null && <MetricPill icon={<TrendingUp size={12} />} value={formatBRL(perTrip)} label="/corrida" />}
                              {perKm    != null && <MetricPill icon={<Navigation  size={12} />} value={formatBRL(perKm)}   label="/km"     />}
                              {perHour  != null && <MetricPill icon={<Clock       size={12} />} value={formatBRL(perHour)} label="/h"      />}
                              {summary.kmDriven    != null && perKm   == null && <MetricPill icon={<Navigation size={12} />} value={`${summary.kmDriven.toFixed(1)}`}    label="km" />}
                              {summary.hoursWorked != null && perHour == null && <MetricPill icon={<Clock      size={12} />} value={`${summary.hoursWorked.toFixed(1)}`} label="h"  />}
                              {summary.rating      != null && <MetricPill icon={<Star size={12} color="#eab308" />} value={summary.rating.toFixed(1)} label="★" />}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

              </motion.div>
            )}
          </>
        )}

        {/* ── Dev-only purge panel ──────────────────────────────────────────── */}
        {import.meta.env.DEV && !loading && (
          <DevAdminPanel
            showToast={(msg, type) => setToast({ message: msg, type })}
            onPurged={() => {
              setSummaries([]);
              queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
            }}
          />
        )}
      </div>
    </div>
  );
}
