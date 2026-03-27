import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Calendar, Navigation, Clock, Star,
  Trash2, TrendingUp, AlertCircle, Plus, CheckCircle,
  FlaskConical, TriangleAlert, Pencil, X, SlidersHorizontal,
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

type Filter = "all" | "week" | "today" | "month" | "custom";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function platformColor(p: string | null): string {
  if (!p) return "#6b7280";
  const l = p.toLowerCase();
  if (l.includes("uber"))     return "#00b4d8";
  if (l.includes("99"))       return "#fbbf24";
  if (l.includes("indriver")) return "#22c55e";
  return "#a78bfa";
}

function isoToday()    { return new Date().toISOString().slice(0, 10); }
function isoNDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 300, maxWidth: 360, width: "calc(100% - 40px)",
        background: type === "success" ? "rgba(0,255,136,0.12)" : "rgba(239,68,68,0.12)",
        border: `1px solid ${type === "success" ? "rgba(0,255,136,0.3)" : "rgba(239,68,68,0.3)"}`,
        borderRadius: 16, padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 12,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }}
    >
      {type === "success"
        ? <CheckCircle size={18} color="#00ff88" />
        : <AlertCircle size={18} color="#ef4444" />}
      <p style={{ fontSize: 13, fontWeight: 700, color: type === "success" ? "#00ff88" : "#f87171" }}>
        {message}
      </p>
    </motion.div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function ConfirmModal({ onConfirm, onCancel, isDeleting }: {
  onConfirm: () => void; onCancel: () => void; isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 32px",
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, margin: "0 16px",
          background: "#161616", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28, padding: "28px 24px 24px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 16, margin: "0 auto 18px",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb", textAlign: "center", marginBottom: 8 }}>
          Excluir registro?
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 1.6, marginBottom: 28 }}>
          Tem certeza que deseja excluir este registro?<br />Essa ação não pode ser desfeita.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 50, borderRadius: 15,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancelar</button>
          <button onClick={onConfirm} disabled={isDeleting} style={{
            flex: 1, height: 50, borderRadius: 15, border: "none",
            background: isDeleting ? "rgba(239,68,68,0.4)" : "#ef4444",
            color: "#fff", fontWeight: 800, fontSize: 15,
            cursor: isDeleting ? "not-allowed" : "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {isDeleting
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
              : <><Trash2 size={15} strokeWidth={2.5} /> Excluir</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({ record, onSave, onClose, isSaving }: {
  record: DailySummary;
  onSave: (data: EditPayload) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [earnings,    setEarnings]    = useState(String(record.earnings));
  const [trips,       setTrips]       = useState(String(record.trips));
  const [km,          setKm]          = useState(record.kmDriven   != null ? String(record.kmDriven)   : "");
  const [hours,       setHours]       = useState(record.hoursWorked != null ? String(record.hoursWorked) : "");
  const [rating,      setRating]      = useState(record.rating     != null ? String(record.rating)     : "");
  const [platform,    setPlatform]    = useState(record.platform ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      earnings: parseFloat(earnings) || 0,
      trips:    parseInt(trips)      || 0,
      kmDriven:    km    ? parseFloat(km)    : null,
      hoursWorked: hours ? parseFloat(hours) : null,
      rating:      rating ? parseFloat(rating) : null,
      platform:  platform || null,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 48, borderRadius: 13,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f9fafb", fontSize: 15, fontWeight: 600, padding: "0 14px",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
    color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 6, display: "block",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 0",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "#141414", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -24px 80px rgba(0,0,0,0.8)",
          maxHeight: "92dvh", overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px 20px" }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#f9fafb" }}>Editar registro</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
              {formatDate(record.date)}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10, border: "none",
            background: "rgba(255,255,255,0.06)", cursor: "pointer",
            color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "0 24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Earnings + Trips row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Ganhos (R$)</label>
              <input
                type="number" step="0.01" min="0" required
                value={earnings} onChange={(e) => setEarnings(e.target.value)}
                style={{ ...inputStyle, borderColor: "rgba(0,255,136,0.2)" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Corridas</label>
              <input
                type="number" min="1" step="1" required
                value={trips} onChange={(e) => setTrips(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* KM + Hours row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>KM rodados</label>
              <input
                type="number" step="0.1" min="0" placeholder="Opcional"
                value={km} onChange={(e) => setKm(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Horas trabalhadas</label>
              <input
                type="number" step="0.1" min="0" placeholder="Opcional"
                value={hours} onChange={(e) => setHours(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Rating + Platform row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Avaliação (1–5)</label>
              <input
                type="number" step="0.1" min="1" max="5" placeholder="Opcional"
                value={rating} onChange={(e) => setRating(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Plataforma</label>
              <input
                type="text" placeholder="Uber, 99..."
                value={platform} onChange={(e) => setPlatform(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Derived preview */}
          {earnings && trips && parseFloat(earnings) > 0 && parseInt(trips) > 0 && (
            <div style={{
              background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)",
              borderRadius: 14, padding: "12px 16px",
              display: "flex", gap: 20,
            }}>
              <div>
                <p style={{ fontSize: 10, color: "rgba(0,255,136,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>R$/corrida</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#00ff88" }}>
                  {formatBRL(parseFloat(earnings) / parseInt(trips))}
                </p>
              </div>
              {km && parseFloat(km) > 0 && (
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>R$/km</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>
                    {formatBRL(parseFloat(earnings) / parseFloat(km))}
                  </p>
                </div>
              )}
              {hours && parseFloat(hours) > 0 && (
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>R$/hora</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>
                    {formatBRL(parseFloat(earnings) / parseFloat(hours))}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <button type="submit" disabled={isSaving} style={{
            width: "100%", height: 54, borderRadius: 16, border: "none",
            background: isSaving ? "rgba(0,255,136,0.5)" : "#00ff88",
            color: "#000", fontWeight: 900, fontSize: 16,
            cursor: isSaving ? "not-allowed" : "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 8px 32px rgba(0,255,136,0.25)",
            marginTop: 4,
          }}>
            {isSaving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid rgba(0,0,0,0.2)", borderTopColor: "#000" }} />
            ) : (
              <><CheckCircle size={18} strokeWidth={2.5} /> Salvar alterações</>
            )}
          </button>

        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Dev Admin Panel ──────────────────────────────────────────────────────────
function DevAdminPanel({ onPurged, showToast }: {
  onPurged: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const queryClient = useQueryClient();
  type Counts = { rides: number; summaries: number };
  const [counts, setCounts]         = useState<Counts | null>(null);
  const [loadingCount, setLoading]  = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging]       = useState(false);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/dev/test-data-summary`, { credentials: "include" });
      setCounts(await res.json());
    } catch { setCounts(null); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res  = await fetch(`${BASE}/api/dev/purge-test-data`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      showToast(`Removidos: ${data.deleted.rides} corridas e ${data.deleted.summaries} resumos.`, "success");
      setConfirming(false);
      onPurged();
      fetchCounts();
    } catch { showToast("Erro ao remover os dados de teste.", "error"); }
    finally  { setPurging(false); }
  };

  const total = (counts?.rides ?? 0) + (counts?.summaries ?? 0);

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(239,68,68,0.15)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "3px 8px" }}>
          <FlaskConical size={11} color="#ef4444" />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#ef4444", textTransform: "uppercase" }}>Modo DEV</span>
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(239,68,68,0.15)" }} />
      </div>
      <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.14)", borderRadius: 18, padding: "18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TriangleAlert size={16} color="#ef4444" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)", marginBottom: 3 }}>Apagar todos os registros de teste</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>Remove todas as corridas e resumos da conta atual. Irreversível.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Corridas", value: loadingCount ? "…" : String(counts?.rides ?? 0) },
            { label: "Resumos",  value: loadingCount ? "…" : String(counts?.summaries ?? 0) },
            { label: "Total",    value: loadingCount ? "…" : String(total) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#f9fafb", marginBottom: 2 }}>{value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</p>
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {!confirming ? (
            <motion.button key="trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirming(true)} disabled={loadingCount || total === 0}
              style={{ width: "100%", height: 44, borderRadius: 13, background: total === 0 ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.08)", border: `1px solid ${total === 0 ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.25)"}`, color: total === 0 ? "rgba(255,255,255,0.2)" : "#ef4444", fontWeight: 700, fontSize: 13, cursor: total === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Trash2 size={14} strokeWidth={2.5} />
              {total === 0 ? "Nenhum registro encontrado" : `Apagar ${total} registros de teste`}
            </motion.button>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, textAlign: "center", marginBottom: 4 }}>⚠️ Tem certeza? Esta ação não pode ser desfeita.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirming(false)} style={{ flex: 1, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                <button onClick={handlePurge} disabled={purging} style={{ flex: 1, height: 42, borderRadius: 12, background: purging ? "rgba(239,68,68,0.3)" : "#ef4444", border: "none", color: "#fff", fontWeight: 800, fontSize: 13, cursor: purging ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {purging ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> : <><Trash2 size={13} /> Apagar tudo</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface EditPayload {
  earnings:    number;
  trips:       number;
  kmDriven:    number | null;
  hoursWorked: number | null;
  rating:      number | null;
  platform:    string | null;
}

// ─── Animation variants ───────────────────────────────────────────────────────
const listVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.045 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1] as any, duration: 0.38 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function RidesPage() {
  const queryClient = useQueryClient();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [summaries, setSummaries] = useState<DailySummary[] | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filter,      setFilter]      = useState<Filter>("all");
  const [customFrom,  setCustomFrom]  = useState("");
  const [customTo,    setCustomTo]    = useState(isoToday());
  const [showFilters, setShowFilters] = useState(false);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [editTarget,     setEditTarget]     = useState<DailySummary | null>(null);
  const [isSaving,       setIsSaving]       = useState(false);
  const [confirmTarget,  setConfirmTarget]  = useState<{ id: number | null; date: string; source: "summary" | "rides" } | null>(null);
  const [isDeleting,     setIsDeleting]     = useState(false);
  const [toast,          setToast]          = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ── Load records ────────────────────────────────────────────────────────────
  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${BASE}/api/daily-summaries`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar registros");
      setSummaries(await res.json());
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);

  // ── Toast auto-dismiss ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Client-side filter ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!summaries) return [];
    const today = isoToday();
    switch (filter) {
      case "today":  return summaries.filter((s) => s.date === today);
      case "week":   return summaries.filter((s) => s.date >= isoNDaysAgo(6));
      case "month":  return summaries.filter((s) => s.date >= isoMonthStart());
      case "custom":
        return summaries.filter((s) =>
          (!customFrom || s.date >= customFrom) &&
          (!customTo   || s.date <= customTo)
        );
      default: return summaries;
    }
  }, [summaries, filter, customFrom, customTo]);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalEarnings = filtered.reduce((s, r) => s + r.earnings, 0);
  const totalTrips    = filtered.reduce((s, r) => s + r.trips, 0);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!confirmTarget) return;
    setIsDeleting(true);
    try {
      const res = confirmTarget.source === "rides"
        ? await fetch(`${BASE}/api/rides/day/${confirmTarget.date}`, { method: "DELETE", credentials: "include" })
        : await fetch(`${BASE}/api/daily-summaries/${confirmTarget.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setSummaries((prev) => prev?.filter((s) =>
        confirmTarget.source === "rides"
          ? !(s.date === confirmTarget.date && s.source === "rides")
          : s.id !== confirmTarget.id
      ) ?? null);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setToast({ message: "Registro excluído com sucesso.", type: "success" });
    } catch {
      setToast({ message: "Não foi possível excluir este registro.", type: "error" });
    } finally {
      setIsDeleting(false);
      setConfirmTarget(null);
    }
  };

  // ── Edit save ───────────────────────────────────────────────────────────────
  const handleEditSave = async (data: EditPayload) => {
    if (!editTarget) return;
    setIsSaving(true);
    try {
      let res: Response;
      // Both source types use POST (upsert by date) so edits are safe regardless of source
      if (editTarget.source === "summary" && editTarget.id != null) {
        res = await fetch(`${BASE}/api/daily-summaries/${editTarget.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch(`${BASE}/api/daily-summaries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ date: editTarget.date, ...data }),
        });
      }
      if (!res.ok) throw new Error();
      const saved = await res.json();
      // Merge the saved record into state
      setSummaries((prev) => {
        if (!prev) return prev;
        const updated = { ...saved, source: "summary" as const };
        const idx = prev.findIndex((s) =>
          editTarget.source === "summary" ? s.id === editTarget.id : s.date === editTarget.date && s.source === "rides"
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setToast({ message: "Registro atualizado com sucesso.", type: "success" });
      setEditTarget(null);
    } catch {
      setToast({ message: "Não foi possível salvar o registro.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const FILTERS: { id: Filter; label: string }[] = [
    { id: "today", label: "Hoje" },
    { id: "week",  label: "Semana" },
    { id: "month", label: "Mês" },
    { id: "all",   label: "Todos" },
    { id: "custom",label: "Período" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#080808", display: "flex", flexDirection: "column" }}>

      {/* ── Global overlays ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>

      <AnimatePresence>
        {confirmTarget && (
          <ConfirmModal
            onConfirm={handleDeleteConfirm}
            onCancel={() => !isDeleting && setConfirmTarget(null)}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTarget && (
          <EditModal
            record={editTarget}
            onSave={handleEditSave}
            onClose={() => !isSaving && setEditTarget(null)}
            isSaving={isSaving}
          />
        )}
      </AnimatePresence>

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px 0",
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(8,8,8,0.94)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/">
              <button style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                <ChevronLeft size={22} />
              </button>
            </Link>
            <div>
              <p style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>Histórico</p>
              {summaries && summaries.length > 0 && (
                <p style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
                  {summaries.length} registro{summaries.length !== 1 ? "s" : ""} salvos
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setShowFilters((v) => !v)}
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none",
                background: showFilters ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.05)",
                color: showFilters ? "#00ff88" : "#6b7280", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <SlidersHorizontal size={15} />
            </button>
            <Link href="/import">
              <button style={{
                background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: 10, padding: "7px 14px", height: 36,
                color: "#00ff88", fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
              }}>
                <Plus size={14} /> Novo
              </button>
            </Link>
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {(showFilters || summaries != null) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ display: "flex", gap: 6, paddingBottom: 14, overflowX: "auto", scrollbarWidth: "none" }}>
                {FILTERS.map(({ id, label }) => {
                  const active = filter === id;
                  return (
                    <button key={id} onClick={() => setFilter(id)} style={{
                      padding: "7px 16px", borderRadius: 20, flexShrink: 0,
                      background: active ? "#00ff88" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? "#00ff88" : "rgba(255,255,255,0.08)"}`,
                      color: active ? "#000" : "rgba(255,255,255,0.45)",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", transition: "all 0.15s ease",
                    }}>{label}</button>
                  );
                })}
              </div>

              {/* Custom date range inputs */}
              <AnimatePresence>
                {filter === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 14 }}>
                      {[
                        { label: "De", value: customFrom, onChange: setCustomFrom },
                        { label: "Até", value: customTo,   onChange: setCustomTo },
                      ].map(({ label, value, onChange }) => (
                        <div key={label}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{label}</p>
                          <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={{
                            width: "100%", height: 38, borderRadius: 10, padding: "0 10px",
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "#f9fafb", fontSize: 12, fontFamily: "inherit",
                            outline: "none", boxSizing: "border-box",
                          }} />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", paddingTop: 72 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(0,255,136,0.1)", borderTopColor: "#00ff88", margin: "0 auto 16px" }} />
            <p style={{ color: "#6b7280", fontSize: 14 }}>Carregando histórico...</p>
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, color: "#f87171", fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={16} /> {loadError}
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {!loading && summaries != null && (
          <>
            {/* Empty state — no records at all */}
            {summaries.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", paddingTop: 72 }}>
                <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>
                  <Calendar size={36} color="#374151" />
                </div>
                <p style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
                  Você ainda não tem registros salvos.
                </p>
                <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
                  Importe um screenshot de ganhos para começar a acompanhar seu histórico.
                </p>
                <Link href="/import">
                  <button style={{ padding: "14px 28px", borderRadius: 14, border: "none", background: "#00ff88", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
                    Adicionar registro
                  </button>
                </Link>
              </motion.div>
            )}

            {/* Empty state — filter returns nothing */}
            {summaries.length > 0 && filtered.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", paddingTop: 56 }}>
                <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 14 }}>
                  Nenhum registro encontrado para este período.
                </p>
                <button onClick={() => setFilter("all")} style={{ background: "none", border: "none", color: "#00ff88", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Ver todos os registros
                </button>
              </motion.div>
            )}

            {/* ── Records list ────────────────────────────────────────────── */}
            {filtered.length > 0 && (
              <motion.div variants={listVariants} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Summary bar */}
                <motion.div variants={cardVariants}>
                  <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
                    {[
                      { label: filter === "today" ? "Hoje" : filter === "week" ? "Semana" : filter === "month" ? "Mês" : "Total", value: formatBRL(totalEarnings), color: "#00ff88" },
                      { label: "Corridas", value: String(totalTrips), color: "#f9fafb" },
                      { label: "Dias",     value: String(filtered.length), color: "#f9fafb" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</p>
                        <p style={{ color, fontWeight: 900, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Section label */}
                <motion.div variants={cardVariants}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", margin: "6px 0 4px" }}>
                    Registros salvos
                  </p>
                </motion.div>

                {/* Cards */}
                <AnimatePresence initial={false}>
                  {filtered.map((s) => {
                    const perTrip = s.trips > 0 ? s.earnings / s.trips : null;
                    const perKm   = s.kmDriven   && s.kmDriven   > 0 ? s.earnings / s.kmDriven   : null;
                    const perHour = s.hoursWorked && s.hoursWorked > 0 ? s.earnings / s.hoursWorked : null;

                    return (
                      <motion.div
                        key={`${s.source}-${s.date}-${s.id}`}
                        variants={cardVariants}
                        layout
                        exit={{ opacity: 0, x: -24, transition: { duration: 0.22 } }}
                      >
                        <div style={{
                          background: "#111",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 22,
                          overflow: "hidden",
                          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                        }}>
                          {/* ── Card top: date · earnings · actions ─────────── */}
                          <div style={{ padding: "16px 18px 14px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>

                              {/* Left: date + platform + earnings */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
                                  <span style={{ color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                                    <Calendar size={11} /> {formatDate(s.date)}
                                  </span>
                                  {s.platform && (
                                    <span style={{ background: platformColor(s.platform), borderRadius: 5, padding: "2px 7px", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                                      {s.platform}
                                    </span>
                                  )}
                                </div>

                                {/* Big earnings number */}
                                <p style={{ fontSize: 28, fontWeight: 900, color: "#00ff88", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
                                  {formatBRL(s.earnings)}
                                </p>
                                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 500 }}>
                                  {s.trips} corrida{s.trips !== 1 ? "s" : ""}
                                  {perTrip != null && <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}> · {formatBRL(perTrip)}/corrida</span>}
                                </p>
                              </div>

                              {/* Right: action buttons */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                                <button
                                  onClick={() => setEditTarget(s)}
                                  style={{
                                    width: 36, height: 36, borderRadius: 11, border: "none",
                                    background: "rgba(99,102,241,0.1)",
                                    color: "#818cf8", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}
                                  title="Editar"
                                >
                                  <Pencil size={14} strokeWidth={2.5} />
                                </button>
                                <button
                                  onClick={() => setConfirmTarget({ id: s.id, date: s.date, source: s.source })}
                                  style={{
                                    width: 36, height: 36, borderRadius: 11, border: "none",
                                    background: "rgba(239,68,68,0.08)",
                                    color: "#ef4444", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}
                                  title="Excluir"
                                >
                                  <Trash2 size={14} strokeWidth={2.5} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* ── Card bottom: secondary metrics ───────────────── */}
                          {(perKm != null || perHour != null || s.kmDriven != null || s.hoursWorked != null || s.rating != null) && (
                            <div style={{
                              borderTop: "1px solid rgba(255,255,255,0.04)",
                              padding: "10px 18px",
                              display: "flex", flexWrap: "wrap", gap: 14,
                              background: "rgba(255,255,255,0.01)",
                            }}>
                              {perKm   != null && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Navigation size={12} color="#6b7280" />
                                  <span style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600 }}>{formatBRL(perKm)}</span>
                                  <span style={{ color: "#4b5563", fontSize: 11 }}>/km</span>
                                </div>
                              )}
                              {perHour != null && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Clock size={12} color="#6b7280" />
                                  <span style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600 }}>{formatBRL(perHour)}</span>
                                  <span style={{ color: "#4b5563", fontSize: 11 }}>/h</span>
                                </div>
                              )}
                              {s.kmDriven    != null && perKm   == null && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Navigation size={12} color="#6b7280" />
                                  <span style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600 }}>{s.kmDriven.toFixed(1)}</span>
                                  <span style={{ color: "#4b5563", fontSize: 11 }}>km</span>
                                </div>
                              )}
                              {s.hoursWorked != null && perHour == null && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Clock size={12} color="#6b7280" />
                                  <span style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600 }}>{s.hoursWorked.toFixed(1)}</span>
                                  <span style={{ color: "#4b5563", fontSize: 11 }}>h</span>
                                </div>
                              )}
                              {s.rating != null && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Star size={12} color="#eab308" />
                                  <span style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600 }}>{s.rating.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

              </motion.div>
            )}

            {/* Dev purge panel */}
            {import.meta.env.DEV && !loading && (
              <DevAdminPanel
                showToast={(msg, type) => setToast({ message: msg, type })}
                onPurged={() => {
                  setSummaries([]);
                  queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
