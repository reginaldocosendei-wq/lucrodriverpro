import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useIsDesktop } from "@/lib/useBreakpoint";
import {
  ChevronLeft, Calendar, Navigation, Clock, Star,
  Trash2, TrendingUp, AlertCircle, Plus, CheckCircle,
  FlaskConical, TriangleAlert, Pencil, X, SlidersHorizontal, ChevronDown, ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import { formatBRL, formatDate } from "@/lib/utils";
import { getApiBase } from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  useExtraEarnings, useAddExtraEarning, useUpdateExtraEarning, useDeleteExtraEarning,
  EXTRA_EARNING_TYPES, typeLabel,
  type ExtraEarning,
} from "@/lib/useExtraEarnings";

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
  const { t } = useT();
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
          {t("history.deleteTitle")}
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 1.6, marginBottom: 28 }}>
          {t("history.deleteMessage")}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 50, borderRadius: 15,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}>{t("common.cancel")}</button>
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
              : <><Trash2 size={15} strokeWidth={2.5} /> {t("common.delete")}</>}
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
  const { t } = useT();
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
            <p style={{ fontSize: 17, fontWeight: 800, color: "#f9fafb" }}>{t("history.editTitle")}</p>
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
              <label style={labelStyle}>{t("history.earnings")}</label>
              <input
                type="number" step="0.01" min="0" required
                value={earnings} onChange={(e) => setEarnings(e.target.value)}
                style={{ ...inputStyle, borderColor: "rgba(0,255,136,0.2)" }}
              />
            </div>
            <div>
              <label style={labelStyle}>{t("history.tripsCount")}</label>
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
              <label style={labelStyle}>{t("history.km")}</label>
              <input
                type="number" step="0.1" min="0" placeholder={t("common.optional")}
                value={km} onChange={(e) => setKm(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t("history.hours")}</label>
              <input
                type="number" step="0.1" min="0" placeholder={t("common.optional")}
                value={hours} onChange={(e) => setHours(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Rating + Platform row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>{t("history.rating")}</label>
              <input
                type="number" step="0.1" min="1" max="5" placeholder={t("common.optional")}
                value={rating} onChange={(e) => setRating(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t("history.platform")}</label>
              <input
                type="text" placeholder={t("history.platformPlaceholder")}
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
                <p style={{ fontSize: 10, color: "rgba(0,255,136,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>R$/{t("history.perTrip")}</p>
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
              <><CheckCircle size={18} strokeWidth={2.5} /> {t("history.saveChanges")}</>
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

// ─── HistoryExtrasPanel ───────────────────────────────────────────────────────
function HistoryExtrasPanel({ date, appEarnings, defaultOpen = false }: {
  date: string; appEarnings: number; defaultOpen?: boolean;
}) {
  const { data: entries = [], isLoading } = useExtraEarnings(date);
  const addMutation    = useAddExtraEarning();
  const updateMutation = useUpdateExtraEarning();
  const deleteMutation = useDeleteExtraEarning();

  const [open, setOpen]         = useState(defaultOpen);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [formType, setFormType] = useState("cash_ride");
  const [formAmt,  setFormAmt]  = useState("");
  const [formNote, setFormNote] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const total = entries.reduce((s, e) => s + e.amount, 0);

  function openAdd() {
    setEditId(null);
    setFormType("cash_ride"); setFormAmt(""); setFormNote("");
    setShowForm(true);
  }

  function openEdit(e: ExtraEarning) {
    setEditId(e.id);
    setFormType(e.type); setFormAmt(String(e.amount)); setFormNote(e.note ?? "");
    setShowForm(true);
  }

  async function handleSave() {
    const parsed = parseFloat(formAmt);
    if (!formType || isNaN(parsed) || parsed <= 0) return;
    if (editId != null) {
      await updateMutation.mutateAsync({ id: editId, type: formType, amount: parsed, note: formNote, date });
    } else {
      await addMutation.mutateAsync({ date, type: formType, amount: parsed, note: formNote });
    }
    setShowForm(false); setEditId(null);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try { await deleteMutation.mutateAsync({ id, date }); } finally { setDeletingId(null); }
  }

  const isSaving = addMutation.isPending || updateMutation.isPending;
  const valid = formType && parseFloat(formAmt) > 0;

  if (isLoading) return null;

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) setShowForm(false); }}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 18px", fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Ganhos extras
          </span>
          {total > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 20, padding: "1px 7px" }}>
              +{formatBRL(total)}
            </span>
          )}
          {total === 0 && !open && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Nenhum</span>
          )}
        </div>
        <span style={{ color: "rgba(255,255,255,0.25)", lineHeight: 0 }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>

              {/* Entry list */}
              <AnimatePresence>
                {entries.map((e) => (
                  <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#f9fafb" }}>{typeLabel(e.type)}</p>
                      {e.note && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</p>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#4ade80", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>+{formatBRL(e.amount)}</span>
                    <button onClick={() => openEdit(e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, color: "rgba(255,255,255,0.35)", lineHeight: 0 }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id} style={{ background: "none", border: "none", cursor: deletingId === e.id ? "not-allowed" : "pointer", padding: 3, color: deletingId === e.id ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.55)", lineHeight: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* True total row */}
              {entries.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a0a0a", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Total do dia</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "#00ff88", fontVariantNumeric: "tabular-nums" }}>{formatBRL(appEarnings + total)}</span>
                </div>
              )}

              {/* Inline form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {EXTRA_EARNING_TYPES.map((t) => (
                          <button key={t.value} onClick={() => setFormType(t.value)}
                            style={{ padding: "5px 10px", borderRadius: 20, border: formType === t.value ? "1px solid #00ff88" : "1px solid rgba(255,255,255,0.1)", background: formType === t.value ? "rgba(0,255,136,0.1)" : "transparent", color: formType === t.value ? "#00ff88" : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>R$</span>
                        <input type="number" inputMode="decimal" placeholder="0,00" value={formAmt} onChange={(e) => setFormAmt(e.target.value)}
                          style={{ width: "100%", height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 15, fontWeight: 700, fontFamily: "inherit", outline: "none", paddingLeft: 32, paddingRight: 12, boxSizing: "border-box" }} />
                      </div>
                      <input type="text" placeholder="Observação (opcional)" value={formNote} onChange={(e) => setFormNote(e.target.value)}
                        style={{ width: "100%", height: 38, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13, fontFamily: "inherit", outline: "none", padding: "0 12px", boxSizing: "border-box" }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ flex: 1, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                        <button onClick={handleSave} disabled={!valid || isSaving} style={{ flex: 2, height: 38, borderRadius: 10, border: "none", background: valid && !isSaving ? "#00ff88" : "rgba(0,255,136,0.2)", color: valid && !isSaving ? "#000" : "rgba(0,255,136,0.4)", fontSize: 13, fontWeight: 800, cursor: valid && !isSaving ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                          {isSaving ? "Salvando..." : editId != null ? "Atualizar" : "Salvar"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Add button */}
              {!showForm && (
                <button onClick={openAdd} style={{ width: "100%", height: 38, borderRadius: 10, border: "1px dashed rgba(0,255,136,0.2)", background: "rgba(0,255,136,0.02)", color: "#00ff88", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <Plus size={13} /> Adicionar ganho extra
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Manual Earning Modal ─────────────────────────────────────────────────────
const modalLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
  color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
  marginBottom: 8, display: "block",
};

function ManualEarningModal({ initialDate, onClose, showToast }: {
  initialDate: string;
  onClose: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const addMutation = useAddExtraEarning();
  const [date, setDate]   = useState(initialDate);
  const [type, setType]   = useState("cash_ride");
  const [amount, setAmount] = useState("");
  const [note, setNote]   = useState("");

  const valid  = parseFloat(amount) > 0 && !!date;
  const saving = addMutation.isPending;

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (!valid || saving) return;
    try {
      await addMutation.mutateAsync({ date, type, amount: parsed, note });
      showToast("Ganho adicionado com sucesso!", "success");
      onClose();
    } catch {
      showToast("Erro ao salvar ganho.", "error");
    }
  }

  const inputBase: React.CSSProperties = {
    width: "100%", height: 50, borderRadius: 14,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f9fafb", fontSize: 15, fontFamily: "inherit",
    outline: "none", padding: "0 14px", boxSizing: "border-box",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 70, opacity: 0 }}
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
            <p style={{ fontSize: 17, fontWeight: 800, color: "#f9fafb" }}>Adicionar ganho manual</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              Corridas em dinheiro, gorjetas, ajustes
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10, border: "none",
            background: "rgba(255,255,255,0.06)", cursor: "pointer",
            color: "rgba(255,255,255,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "0 24px 32px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Type chips */}
          <div>
            <label style={modalLabelStyle}>Tipo de ganho</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {EXTRA_EARNING_TYPES.map((t) => (
                <button key={t.value} onClick={() => setType(t.value)} style={{
                  padding: "7px 14px", borderRadius: 22, fontSize: 12, fontWeight: 600,
                  border: type === t.value ? "1px solid #00ff88" : "1px solid rgba(255,255,255,0.1)",
                  background: type === t.value ? "rgba(0,255,136,0.1)" : "transparent",
                  color: type === t.value ? "#00ff88" : "rgba(255,255,255,0.5)",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label style={modalLabelStyle}>Valor</label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.4)",
              }}>R$</span>
              <input
                type="number" inputMode="decimal" placeholder="0,00"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                autoFocus
                style={{
                  ...inputBase, paddingLeft: 40, paddingRight: 16,
                  fontSize: 20, fontWeight: 800,
                  border: "1px solid rgba(0,255,136,0.25)",
                  height: 56,
                }}
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label style={modalLabelStyle}>Data</label>
            <input
              type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputBase}
            />
          </div>

          {/* Note */}
          <div>
            <label style={modalLabelStyle}>
              Observação <span style={{ opacity: 0.4, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>— opcional</span>
            </label>
            <input
              type="text" placeholder="Ex: gorjeta do cliente, ajuste de saldo…"
              value={note} onChange={(e) => setNote(e.target.value)}
              style={inputBase}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave} disabled={!valid || saving}
            style={{
              width: "100%", height: 54, borderRadius: 16, border: "none",
              background: valid && !saving ? "#00ff88" : "rgba(0,255,136,0.15)",
              color: valid && !saving ? "#000" : "rgba(0,255,136,0.35)",
              fontWeight: 900, fontSize: 16,
              cursor: valid && !saving ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: valid && !saving ? "0 8px 32px rgba(0,255,136,0.2)" : "none",
              marginTop: 4,
              transition: "all 0.15s ease",
            }}
          >
            {saving
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid rgba(0,0,0,0.2)", borderTopColor: "#000" }} />
              : <><CheckCircle size={18} strokeWidth={2.5} /> Salvar ganho</>}
          </button>

        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Day Group Card ───────────────────────────────────────────────────────────
// Shown when multiple imported records exist for the same date (multi-platform)
function DayGroupCard({
  records,
  onEdit,
  onDelete,
}: {
  records: DailySummary[];
  onEdit: (s: DailySummary) => void;
  onDelete: (s: DailySummary) => void;
}) {
  const { t } = useT();
  const date          = records[0].date;
  const totalEarnings = records.reduce((sum, r) => sum + r.earnings, 0);
  const totalTrips    = records.reduce((sum, r) => sum + r.trips, 0);
  const perTrip       = totalTrips > 0 ? totalEarnings / totalTrips : null;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "#111",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 22,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
    }}>
      {/* Header row */}
      <div style={{ padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                <Calendar size={11} /> {formatDate(date)}
              </span>
              {records.filter(r => r.platform).map((r, i) => (
                <span key={i} style={{
                  background: platformColor(r.platform),
                  borderRadius: 5, padding: "2px 7px",
                  color: "#fff", fontSize: 10, fontWeight: 700,
                }}>
                  {r.platform}
                </span>
              ))}
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 5, padding: "2px 7px", textTransform: "uppercase",
              }}>
                {records.length} fontes
              </span>
            </div>
            <p style={{
              fontSize: 28, fontWeight: 900, color: "#00ff88",
              letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums",
              lineHeight: 1, marginBottom: 4,
            }}>
              {formatBRL(totalEarnings)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 500 }}>
              {totalTrips} {t("history.tripsCount").toLowerCase()}
              {perTrip != null && (
                <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
                  {" "}· {formatBRL(perTrip)}/{t("history.perTrip")}
                </span>
              )}
            </p>
          </div>
          {/* Expand/collapse sub-records */}
          <button
            onClick={() => setExpanded(v => !v)}
            title={expanded ? "Recolher" : "Ver por plataforma"}
            style={{
              width: 36, height: 36, borderRadius: 11, border: "none",
              background: expanded ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.05)",
              color: expanded ? "#00ff88" : "rgba(255,255,255,0.4)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expandable per-platform sub-rows */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.04)",
              padding: "10px 14px 12px",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {records.map((r) => (
                <div
                  key={`${r.source}-${r.id ?? r.date}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {r.platform && (
                      <span style={{
                        display: "inline-block",
                        background: platformColor(r.platform),
                        borderRadius: 4, padding: "1px 6px",
                        color: "#fff", fontSize: 9, fontWeight: 700, marginRight: 6,
                      }}>
                        {r.platform}
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#00ff88", fontVariantNumeric: "tabular-nums" }}>
                      {formatBRL(r.earnings)}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>
                      {r.trips} {t("history.tripsCount").toLowerCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => onEdit(r)}
                    title={t("common.edit")}
                    style={{
                      width: 30, height: 30, borderRadius: 9, border: "none",
                      background: "rgba(99,102,241,0.1)",
                      color: "#818cf8", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Pencil size={12} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => onDelete(r)}
                    title={t("common.delete")}
                    style={{
                      width: 30, height: 30, borderRadius: 9, border: "none",
                      background: "rgba(239,68,68,0.08)",
                      color: "#ef4444", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Trash2 size={12} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extras panel — once per day, not per record */}
      <HistoryExtrasPanel date={date} appEarnings={totalEarnings} />
    </div>
  );
}

// ─── Manual Day Card ──────────────────────────────────────────────────────────
// Shown in history for dates that have manual entries but NO imported ride
function ManualDayCard({ date, total, count }: { date: string; total: number; count: number }) {
  return (
    <div style={{
      background: "#111",
      border: "1px solid rgba(99,102,241,0.18)",
      borderRadius: 22, overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
    }}>
      <div style={{ padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#6b7280", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                <Calendar size={11} /> {formatDate(date)}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                color: "rgba(129,140,248,0.9)",
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.22)",
                borderRadius: 5, padding: "2px 7px", textTransform: "uppercase",
              }}>
                Manual
              </span>
            </div>
            <p style={{
              fontSize: 28, fontWeight: 900, color: "#4ade80",
              letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums",
              lineHeight: 1, marginBottom: 4,
            }}>
              +{formatBRL(total)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 500 }}>
              {count} {count === 1 ? "ganho manual" : "ganhos manuais"}
            </p>
          </div>
        </div>
      </div>

      {/* Expanded extras panel — always open, appEarnings=0 since no ride */}
      <HistoryExtrasPanel date={date} appEarnings={0} defaultOpen />
    </div>
  );
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
  const { t } = useT();
  const isDesktop = useIsDesktop();

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
  const [showManualModal, setShowManualModal] = useState(false);

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

  // ── Group filtered records by date (newest first) ─────────────────────────────
  // Multiple platform imports on the same day → one grouped card per date
  const groupedFiltered = useMemo(() => {
    const map = new Map<string, DailySummary[]>();
    for (const s of filtered) {
      const arr = map.get(s.date);
      if (arr) arr.push(s);
      else map.set(s.date, [s]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, records]) => ({ date, records }));
  }, [filtered]);

  // ── All extra earnings (for manual-only date cards) ──────────────────────────
  const { data: allExtraEarnings = [] } = useExtraEarnings();

  // Dates that have imported summaries
  const summaryDates = useMemo(() =>
    new Set((summaries ?? []).map((s) => s.date)),
  [summaries]);

  // Group extras by date for those WITHOUT an imported summary
  const manualOnlyByDate = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const e of allExtraEarnings) {
      if (!summaryDates.has(e.date)) {
        if (!map[e.date]) map[e.date] = { total: 0, count: 0 };
        map[e.date].total += e.amount;
        map[e.date].count += 1;
      }
    }
    return map;
  }, [allExtraEarnings, summaryDates]);

  // Apply same date filter to manual-only dates
  const filteredManualDates = useMemo(() => {
    const dates = Object.keys(manualOnlyByDate).sort().reverse();
    const today = isoToday();
    switch (filter) {
      case "today":  return dates.filter((d) => d === today);
      case "week":   return dates.filter((d) => d >= isoNDaysAgo(6));
      case "month":  return dates.filter((d) => d >= isoMonthStart());
      case "custom": return dates.filter((d) =>
        (!customFrom || d >= customFrom) && (!customTo || d <= customTo));
      default: return dates;
    }
  }, [manualOnlyByDate, filter, customFrom, customTo]);

  // ── Derived display flags ────────────────────────────────────────────────────
  const hasImported   = filtered.length > 0;
  const hasManual     = filteredManualDates.length > 0;
  const hasAny        = hasImported || hasManual;
  const noSummaries   = (summaries?.length ?? 0) === 0 && !hasManual;
  const noFilterMatch = !hasAny && (summaries?.length ?? 0) > 0;

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalEarnings = filtered.reduce((s, r) => s + r.earnings, 0);
  const totalTrips    = filtered.reduce((s, r) => s + r.trips, 0);

  // Extra earnings sum for the active filter — added to the summary bar so the
  // displayed total always equals imported platform earnings + manual entries.
  // allExtraEarnings already fetched above; no extra network call needed.
  const extraEarningsTotal = useMemo(() => {
    const today = isoToday();
    let relevant = allExtraEarnings;
    switch (filter) {
      case "today":  relevant = allExtraEarnings.filter((e) => e.date === today); break;
      case "week":   relevant = allExtraEarnings.filter((e) => e.date >= isoNDaysAgo(6)); break;
      case "month":  relevant = allExtraEarnings.filter((e) => e.date >= isoMonthStart()); break;
      case "custom": relevant = allExtraEarnings.filter((e) =>
        (!customFrom || e.date >= customFrom) && (!customTo || e.date <= customTo)); break;
    }
    return relevant.reduce((s, e) => s + e.amount, 0);
  }, [allExtraEarnings, filter, customFrom, customTo]);

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
      setToast({ message: t("history.deleteSuccess"), type: "success" });
    } catch {
      setToast({ message: t("history.deleteError"), type: "error" });
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
      setToast({ message: t("history.updateSuccess"), type: "success" });
      setEditTarget(null);
    } catch {
      setToast({ message: t("history.updateError"), type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const FILTERS: { id: Filter; label: string }[] = [
    { id: "today",  label: t("common.today") },
    { id: "week",   label: t("common.week") },
    { id: "month",  label: t("common.month") },
    { id: "all",    label: t("common.all") },
    { id: "custom", label: t("common.period") },
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

      <AnimatePresence>
        {showManualModal && (
          <ManualEarningModal
            initialDate={isoToday()}
            onClose={() => setShowManualModal(false)}
            showToast={(msg, type) => setToast({ message: msg, type })}
          />
        )}
      </AnimatePresence>

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(8,8,8,0.94)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>

        {isDesktop ? (
          /* ══ Desktop: original single-row layout ══════════════════════════ */
          <div style={{ padding: "16px 40px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Link href="/">
                  <button style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                    <ChevronLeft size={22} />
                  </button>
                </Link>
                <div>
                  <p style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>{t("history.title")}</p>
                  {summaries && summaries.length > 0 && (
                    <p style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
                      {summaries.length} {summaries.length !== 1 ? t("common.records") : t("common.record")} {t("common.saved")}
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
                <button
                  onClick={() => setShowManualModal(true)}
                  style={{
                    background: "rgba(129,140,248,0.08)", border: "1px solid rgba(99,102,241,0.22)",
                    borderRadius: 10, padding: "7px 13px", height: 36,
                    color: "#818cf8", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
                  }}
                >
                  <Pencil size={13} strokeWidth={2.5} /> Manual
                </button>
                <Link href="/import">
                  <button style={{
                    background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)",
                    borderRadius: 10, padding: "7px 14px", height: 36,
                    color: "#00ff88", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  }}>
                    <Plus size={14} /> Importar
                  </button>
                </Link>
              </div>
            </div>

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
                  <AnimatePresence>
                    {filter === "custom" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 14 }}>
                          {[
                            { label: t("common.from"), value: customFrom, onChange: setCustomFrom },
                            { label: t("common.to"),   value: customTo,   onChange: setCustomTo },
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
        ) : (
          /* ══ Mobile: intentional 3-row stacked layout ═════════════════════ */
          <div style={{ padding: "14px 16px 0" }}>

            {/* ── Row 1: back · title/subtitle · filter icon ─────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Link href="/">
                <button style={{
                  background: "none", border: "none", color: "#6b7280",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  padding: 0, flexShrink: 0,
                }}>
                  <ChevronLeft size={22} />
                </button>
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>
                  {t("history.title")}
                </p>
                {summaries && summaries.length > 0 && (
                  <p style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                    {summaries.length} {summaries.length !== 1 ? t("common.records") : t("common.record")} {t("common.saved")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: "none",
                  background: showFilters ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.05)",
                  color: showFilters ? "#00ff88" : "#6b7280", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>

            {/* ── Row 2: action buttons — each takes half the width ──────── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <button
                onClick={() => setShowManualModal(true)}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: "rgba(129,140,248,0.08)", border: "1px solid rgba(99,102,241,0.22)",
                  color: "#818cf8", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "inherit",
                }}
              >
                <Pencil size={14} strokeWidth={2.5} /> Manual
              </button>
              <Link href="/import" style={{ flex: 1, textDecoration: "none" }}>
                <button style={{
                  width: "100%", height: 42, borderRadius: 12,
                  background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)",
                  color: "#00ff88", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "inherit",
                }}>
                  <Plus size={14} /> Importar
                </button>
              </Link>
            </div>

            {/* ── Row 3: period chips — horizontal scroll, never clips ───── */}
            <div style={{
              display: "flex", gap: 6, paddingBottom: 14,
              overflowX: "auto", scrollbarWidth: "none",
              msOverflowStyle: "none" as React.CSSProperties["msOverflowStyle"],
            }}>
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
                      { label: t("common.from"), value: customFrom, onChange: setCustomFrom },
                      { label: t("common.to"),   value: customTo,   onChange: setCustomTo },
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
          </div>
        )}
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: isDesktop ? "24px 40px 60px" : "20px 16px 100px" }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", paddingTop: 72 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(0,255,136,0.1)", borderTopColor: "#00ff88", margin: "0 auto 16px" }} />
            <p style={{ color: "#6b7280", fontSize: 14 }}>{t("history.loadingHistory")}</p>
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
            {/* Empty state — no records at all (no imports, no manual) */}
            {noSummaries && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", paddingTop: 72 }}>
                <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>
                  <Calendar size={36} color="#374151" />
                </div>
                <p style={{ color: "#f9fafb", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
                  {t("history.noRecords")}
                </p>
                <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
                  {t("history.noRecordsSub")}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setShowManualModal(true)} style={{
                    padding: "14px 24px", borderRadius: 14, border: "1px solid rgba(99,102,241,0.3)",
                    background: "rgba(99,102,241,0.08)", color: "#818cf8", fontWeight: 700, fontSize: 14,
                    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7,
                  }}>
                    <Pencil size={15} /> Ganho manual
                  </button>
                  <Link href="/import">
                    <button style={{ padding: "14px 24px", borderRadius: 14, border: "none", background: "#00ff88", color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                      {t("history.addRecord")}
                    </button>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Empty state — filter returns nothing */}
            {noFilterMatch && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", paddingTop: 56 }}>
                <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 14 }}>
                  {t("history.noResultsForPeriod")}
                </p>
                <button onClick={() => setFilter("all")} style={{ background: "none", border: "none", color: "#00ff88", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("history.viewAll")}
                </button>
              </motion.div>
            )}

            {/* ── Records list ────────────────────────────────────────────── */}
            {hasAny && (
              <motion.div variants={listVariants} initial="hidden" animate="show"
                style={isDesktop
                  ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }
                  : { display: "flex", flexDirection: "column", gap: 10 }
                }
              >

                {/* Summary bar — spans full width on desktop */}
                <motion.div variants={cardVariants} style={isDesktop ? { gridColumn: "1 / -1" } : {}}>
                  <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
                    {[
                      { label: filter === "today" ? t("common.today") : filter === "week" ? t("common.week") : filter === "month" ? t("common.month") : t("history.total"), value: formatBRL(totalEarnings + extraEarningsTotal), color: "#00ff88" },
                      { label: t("history.tripsCount"), value: String(totalTrips), color: "#f9fafb" },
                      { label: t("common.days"),        value: String(groupedFiltered.length), color: "#f9fafb" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</p>
                        <p style={{ color, fontWeight: 900, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Section label — spans full width on desktop */}
                <motion.div variants={cardVariants} style={isDesktop ? { gridColumn: "1 / -1" } : {}}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", margin: "6px 0 4px" }}>
                    {t("history.savedRecords")}
                  </p>
                </motion.div>

                {/* Cards — one per date (multi-platform days show DayGroupCard) */}
                <AnimatePresence initial={false}>
                  {groupedFiltered.map(({ date, records }) => {
                    const s = records[0];

                    if (records.length > 1) {
                      return (
                        <motion.div
                          key={`group-${date}`}
                          variants={cardVariants}
                          layout
                          exit={{ opacity: 0, x: -24, transition: { duration: 0.22 } }}
                        >
                          <DayGroupCard
                            records={records}
                            onEdit={(r) => setEditTarget(r)}
                            onDelete={(r) => setConfirmTarget({ id: r.id, date: r.date, source: r.source })}
                          />
                        </motion.div>
                      );
                    }

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
                                  {s.trips} {t("history.tripsCount").toLowerCase()}
                                  {perTrip != null && <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}> · {formatBRL(perTrip)}/{t("history.perTrip")}</span>}
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
                                  title={t("common.edit")}
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
                                  title={t("common.delete")}
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

                          {/* ── Extra earnings panel ──────────────────────────── */}
                          <HistoryExtrasPanel date={s.date} appEarnings={s.earnings} />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Manual-only day cards (dates with manual earnings but no imported ride) */}
                <AnimatePresence initial={false}>
                  {filteredManualDates.map((date) => {
                    const { total, count } = manualOnlyByDate[date];
                    return (
                      <motion.div
                        key={`manual-${date}`}
                        variants={cardVariants}
                        layout
                        exit={{ opacity: 0, x: -24, transition: { duration: 0.22 } }}
                      >
                        <ManualDayCard date={date} total={total} count={count} />
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
