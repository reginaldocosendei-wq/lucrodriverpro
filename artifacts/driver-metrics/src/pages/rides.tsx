import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Calendar, Navigation, Clock, Star,
  Trash2, TrendingUp, AlertCircle, Plus
} from "lucide-react";
import { Link } from "wouter";
import { formatBRL, formatDate } from "@/lib/utils";
import { getApiBase } from "@/lib/api";
import { useGetMe } from "@workspace/api-client-react";

const BASE = getApiBase();

interface DailySummary {
  id: number;
  date: string;
  earnings: number;
  trips: number;
  kmDriven: number | null;
  hoursWorked: number | null;
  rating: number | null;
  platform: string | null;
  notes: string | null;
}

function platformColor(p: string | null) {
  if (!p) return "#6b7280";
  const lower = p.toLowerCase();
  if (lower.includes("uber")) return "#00b4d8";
  if (lower.includes("99")) return "#fbbf24";
  if (lower.includes("indriver")) return "#22c55e";
  return "#a78bfa";
}

function MetricPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "#6b7280", display: "flex", alignItems: "center" }}>{icon}</span>
      <div>
        <span style={{ color: "#f9fafb", fontSize: 13, fontWeight: 600 }}>{value}</span>
        <span style={{ color: "#4b5563", fontSize: 11, marginLeft: 3 }}>{label}</span>
      </div>
    </div>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1] as any, duration: 0.4 } },
};

export default function RidesPage() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const [summaries, setSummaries] = useState<DailySummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE}/api/daily-summaries`, { credentials: "include" });
        if (!res.ok) throw new Error("Erro ao carregar resumos");
        const data = await res.json();
        if (!cancelled) setSummaries(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este resumo do dia?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE}/api/daily-summaries/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao remover");
      setSummaries((prev) => prev?.filter((s) => s.id !== id) ?? null);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalEarnings = summaries?.reduce((s, r) => s + r.earnings, 0) ?? 0;
  const totalTrips = summaries?.reduce((s, r) => s + r.trips, 0) ?? 0;

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky",
        top: 0,
        background: "#0a0a0a",
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/">
            <button style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <ChevronLeft size={22} />
            </button>
          </Link>
          <div>
            <span style={{ color: "#f9fafb", fontWeight: 600, fontSize: 17 }}>Resumos diários</span>
            {summaries && summaries.length > 0 && (
              <p style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>{summaries.length} dias registrados</p>
            )}
          </div>
        </div>
        <Link href="/import">
          <button style={{
            background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)",
            borderRadius: 10, padding: "7px 14px",
            color: "#00ff88", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Plus size={14} /> Importar
          </button>
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>

        {loading && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "3px solid rgba(0,255,136,0.15)",
              borderTopColor: "#00ff88",
              margin: "0 auto 16px",
              animation: "spin 1s linear infinite",
            }} />
            <p style={{ color: "#6b7280", fontSize: 14 }}>Carregando resumos...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            color: "#f87171", fontSize: 14, display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {!loading && summaries && summaries.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Calendar size={32} color="#374151" />
            </div>
            <p style={{ color: "#f9fafb", fontWeight: 600, fontSize: 17, marginBottom: 8 }}>Nenhum resumo ainda</p>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>
              Importe seu primeiro resultado por screenshot para ver o histórico aqui.
            </p>
            <Link href="/import">
              <button style={{
                padding: "14px 28px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                color: "#0a0a0a", fontWeight: 700, fontSize: 15, cursor: "pointer",
              }}>
                Importar resultado
              </button>
            </Link>
          </div>
        )}

        {!loading && summaries && summaries.length > 0 && (
          <motion.div variants={container} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Totals header */}
            <motion.div variants={itemAnim}>
              <div style={{
                background: "#1a1a1a", borderRadius: 20, padding: "16px 20px",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
                marginBottom: 8,
              }}>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</p>
                  <p style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>{formatBRL(totalEarnings)}</p>
                </div>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Corridas</p>
                  <p style={{ color: "#f9fafb", fontWeight: 700, fontSize: 18 }}>{totalTrips}</p>
                </div>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dias</p>
                  <p style={{ color: "#f9fafb", fontWeight: 700, fontSize: 18 }}>{summaries.length}</p>
                </div>
              </div>
            </motion.div>

            {/* Summary cards */}
            {summaries.map((summary) => {
              const perTrip = summary.trips > 0 ? summary.earnings / summary.trips : null;
              const perKm = summary.kmDriven && summary.kmDriven > 0 ? summary.earnings / summary.kmDriven : null;
              const perHour = summary.hoursWorked && summary.hoursWorked > 0 ? summary.earnings / summary.hoursWorked : null;

              return (
                <motion.div key={summary.id} variants={itemAnim}>
                  <div style={{
                    background: "#1a1a1a",
                    borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.05)",
                    overflow: "hidden",
                  }}>
                    {/* Top row */}
                    <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                            {summary.platform && (
                              <span style={{
                                background: platformColor(summary.platform),
                                borderRadius: 5, padding: "2px 8px",
                                color: "#fff", fontSize: 11, fontWeight: 600,
                              }}>{summary.platform}</span>
                            )}
                            <span style={{ color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                              <Calendar size={11} />
                              {formatDate(summary.date)}
                            </span>
                          </div>
                          <p style={{ color: "#00ff88", fontWeight: 800, fontSize: 26 }}>
                            {formatBRL(summary.earnings)}
                          </p>
                          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                            {summary.trips} corrida{summary.trips !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(summary.id)}
                          disabled={deletingId === summary.id}
                          style={{
                            background: "rgba(239,68,68,0.08)", border: "none",
                            borderRadius: 10, padding: "8px",
                            color: "#ef4444", cursor: "pointer",
                            opacity: deletingId === summary.id ? 0.4 : 1,
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Metrics row */}
                    {(perTrip != null || perKm != null || perHour != null || summary.kmDriven != null || summary.hoursWorked != null || summary.rating != null) && (
                      <div style={{
                        padding: "12px 20px",
                        display: "flex", flexWrap: "wrap", gap: 14,
                        background: "rgba(255,255,255,0.01)",
                      }}>
                        {perTrip != null && (
                          <MetricPill icon={<TrendingUp size={12} />} value={formatBRL(perTrip)} label="/corrida" />
                        )}
                        {perKm != null && (
                          <MetricPill icon={<Navigation size={12} />} value={formatBRL(perKm)} label="/km" />
                        )}
                        {perHour != null && (
                          <MetricPill icon={<Clock size={12} />} value={formatBRL(perHour)} label="/h" />
                        )}
                        {summary.kmDriven != null && perKm == null && (
                          <MetricPill icon={<Navigation size={12} />} value={`${summary.kmDriven.toFixed(1)}`} label="km" />
                        )}
                        {summary.hoursWorked != null && perHour == null && (
                          <MetricPill icon={<Clock size={12} />} value={`${summary.hoursWorked.toFixed(1)}`} label="h" />
                        )}
                        {summary.rating != null && (
                          <MetricPill icon={<Star size={12} color="#eab308" />} value={summary.rating.toFixed(1)} label="★" />
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
