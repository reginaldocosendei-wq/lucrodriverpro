import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Search, Check, X, Trash2, RefreshCw,
  Clock, CheckCircle, XCircle, Shield, AlertTriangle,
} from "lucide-react";
import { getApiBase } from "@/lib/api";

const BASE = getApiBase();

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "pending" | "confirmed" | "rejected";

interface PixPayment {
  id:          number;
  userId:      number | null;
  email:       string;
  name:        string;
  amount:      string;
  status:      Status;
  requestedAt: string;
  confirmedAt: string | null;
  rejectedAt:  string | null;
  notes:       string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: "Pendente",   color: "#eab308", bg: "rgba(234,179,8,0.1)",    icon: Clock },
  confirmed: { label: "Confirmado", color: "#00ff88", bg: "rgba(0,255,136,0.09)",   icon: CheckCircle },
  rejected:  { label: "Recusado",   color: "#f87171", bg: "rgba(239,68,68,0.09)",   icon: XCircle },
};

const FILTERS = [
  { id: "all",       label: "Todos" },
  { id: "pending",   label: "Pendentes" },
  { id: "confirmed", label: "Confirmados" },
  { id: "rejected",  label: "Recusados" },
  { id: "today",     label: "Hoje" },
  { id: "week",      label: "Semana" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function initials(name: string) {
  return name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "??";
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: "ok" | "err" }

// ─── Action feedback state ────────────────────────────────────────────────────
type ActionState = "idle" | "loading" | "ok" | "err";

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PIX PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPixPage() {
  const [, navigate]  = useLocation();
  const [payments, setPayments]       = useState<PixPayment[]>([]);
  const [total, setTotal]             = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter]           = useState("all");
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(true);
  const [access, setAccess]           = useState<"ok" | "denied" | "loading">("loading");
  const [toasts, setToasts]           = useState<Toast[]>([]);
  const [actionStates, setActionStates] = useState<Record<number, ActionState>>({});

  const addToast = (msg: string, type: "ok" | "err") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const setAction = (id: number, state: ActionState) =>
    setActionStates((prev) => ({ ...prev, [id]: state }));

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, search });
      const res = await fetch(`${BASE}/api/admin/pix?${params}`, { credentials: "include" });
      if (res.status === 401) { navigate("/"); return; }
      if (res.status === 403) { setAccess("denied"); setLoading(false); return; }
      const data = await res.json();
      setPayments(data.payments ?? []);
      setTotal(data.total ?? 0);
      setPendingCount(data.pending ?? 0);
      setAccess("ok");
    } catch {
      addToast("Erro de conexão", "err");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const confirm = async (p: PixPayment) => {
    setAction(p.id, "loading");
    try {
      const res = await fetch(`${BASE}/api/admin/pix/${p.id}/confirm`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAction(p.id, "ok");
      addToast("Pagamento confirmado. Acesso PRO ativado.", "ok");
      setTimeout(() => { setAction(p.id, "idle"); fetchPayments(); }, 1200);
    } catch (e: any) {
      setAction(p.id, "err");
      addToast(e.message ?? "Não foi possível processar este pagamento.", "err");
      setTimeout(() => setAction(p.id, "idle"), 2000);
    }
  };

  const reject = async (p: PixPayment) => {
    setAction(p.id, "loading");
    try {
      const res = await fetch(`${BASE}/api/admin/pix/${p.id}/reject`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAction(p.id, "ok");
      addToast("Pagamento recusado.", "ok");
      setTimeout(() => { setAction(p.id, "idle"); fetchPayments(); }, 1200);
    } catch (e: any) {
      setAction(p.id, "err");
      addToast(e.message ?? "Erro ao recusar pagamento.", "err");
      setTimeout(() => setAction(p.id, "idle"), 2000);
    }
  };

  const remove = async (p: PixPayment) => {
    if (!window.confirm(`Excluir registro de ${p.email}?`)) return;
    try {
      const res = await fetch(`${BASE}/api/admin/pix/${p.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      addToast("Registro excluído.", "ok");
      fetchPayments();
    } catch {
      addToast("Erro ao excluir registro.", "err");
    }
  };

  // ── Access denied ─────────────────────────────────────────────────────────
  if (access === "denied") {
    return (
      <div style={{ minHeight: "100dvh", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 32px" }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Shield size={30} color="#f87171" strokeWidth={1.8} />
        </div>
        <p style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", marginBottom: 8 }}>Acesso negado</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28, lineHeight: 1.6 }}>
          Você não tem permissão para acessar este painel.
        </p>
        <button onClick={() => navigate("/")} style={{ padding: "12px 24px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#080808", display: "flex", flexDirection: "column" }}>

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              style={{
                background: t.type === "ok" ? "rgba(0,255,136,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${t.type === "ok" ? "rgba(0,255,136,0.25)" : "rgba(239,68,68,0.25)"}`,
                color: t.type === "ok" ? "#00ff88" : "#f87171",
                padding: "10px 16px", borderRadius: 12,
                fontSize: 13, fontWeight: 600,
                backdropFilter: "blur(8px)",
                maxWidth: 280,
                pointerEvents: "auto",
              }}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#080808" }}>
        <button
          onClick={() => navigate("/")}
          style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ChevronLeft size={20} color="rgba(255,255,255,0.55)" />
        </button>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.01em" }}>Controle PIX</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>Lucro Driver Admin</p>
        </div>

        {pendingCount > 0 && (
          <div style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.22)", borderRadius: 20, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#eab308" }}>{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>
          </div>
        )}

        <button
          onClick={fetchPayments}
          style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <RefreshCw size={16} color="rgba(255,255,255,0.4)" />
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 0 12px" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por email ou nome..."
              style={{
                width: "100%", boxSizing: "border-box",
                height: 44, paddingLeft: 42, paddingRight: 16,
                background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, color: "#f9fafb", fontSize: 14,
                fontFamily: "inherit", outline: "none",
              }}
            />
          </div>
        </div>

        {/* ── Filter chips ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 4 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                flexShrink: 0, height: 34, paddingInline: 14, borderRadius: 10,
                background: filter === f.id ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${filter === f.id ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: filter === f.id ? "#00ff88" : "rgba(255,255,255,0.45)",
                fontSize: 13, fontWeight: filter === f.id ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.18s ease",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        {!loading && access === "ok" && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {total} registro{total !== 1 ? "s" : ""}
          </p>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.08)", borderTopColor: "#00ff88" }}
            />
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!loading && payments.length === 0 && access === "ok" && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Nenhum registro encontrado</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)" }}>Tente outro filtro ou aguarde solicitações.</p>
          </div>
        )}

        {/* ── Payment cards ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {!loading && payments.map((p, i) => {
            const cfg    = STATUS_CONFIG[p.status as Status] ?? STATUS_CONFIG.pending;
            const Icon   = cfg.icon;
            const aState = actionStates[p.id] ?? "idle";

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  background: "#0e0e0e",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  padding: "18px 18px 16px",
                  marginBottom: 12,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Status accent bar */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: cfg.color, borderRadius: "20px 0 0 20px", opacity: 0.7 }} />

                {/* Top row: avatar + info + amount */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                  {/* Avatar */}
                  <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: "0.02em" }}>
                    {initials(p.name || p.email)}
                  </div>

                  {/* Name + email + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name || "Sem nome"}
                    </p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                      {p.email}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>
                      {fmtDate(p.requestedAt)}
                    </p>
                  </div>

                  {/* Amount + status */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 900, color: "#f9fafb", letterSpacing: "-0.02em", marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
                      R${p.amount}
                    </p>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, borderRadius: 20, padding: "4px 10px" }}>
                      <Icon size={11} color={cfg.color} strokeWidth={2.5} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, letterSpacing: "0.04em" }}>{cfg.label}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {p.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Confirm */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => confirm(p)}
                      disabled={aState === "loading"}
                      style={{
                        flex: 1, height: 42, borderRadius: 12, border: "none",
                        background: aState === "ok" ? "rgba(0,255,136,0.2)" : "rgba(0,255,136,0.12)",
                        color: "#00ff88", fontWeight: 700, fontSize: 13,
                        cursor: aState === "loading" ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        fontFamily: "inherit", transition: "all 0.2s ease",
                      }}
                    >
                      {aState === "loading" ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,255,136,0.2)", borderTopColor: "#00ff88" }} />
                      ) : aState === "ok" ? (
                        <><Check size={14} strokeWidth={2.5} /> Confirmado</>
                      ) : (
                        <><Check size={14} strokeWidth={2.5} /> Confirmar &amp; Ativar PRO</>
                      )}
                    </motion.button>

                    {/* Reject */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => reject(p)}
                      disabled={aState === "loading"}
                      style={{ width: 42, height: 42, borderRadius: 12, border: "none", background: "rgba(239,68,68,0.08)", color: "#f87171", cursor: aState === "loading" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0 }}
                    >
                      <X size={16} strokeWidth={2.5} />
                    </motion.button>

                    {/* Delete */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => remove(p)}
                      style={{ width: 42, height: 42, borderRadius: 12, border: "none", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0 }}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </motion.button>
                  </div>
                )}

                {p.status === "confirmed" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <CheckCircle size={14} color="#00ff88" strokeWidth={2} />
                      <span style={{ fontSize: 12, color: "rgba(0,255,136,0.7)", fontWeight: 600 }}>
                        PRO ativado {p.confirmedAt ? fmtDate(p.confirmedAt) : ""}
                      </span>
                    </div>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={() => remove(p)} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Trash2 size={13} strokeWidth={2} />
                    </motion.button>
                  </div>
                )}

                {p.status === "rejected" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <AlertTriangle size={13} color="#f87171" strokeWidth={2} />
                      <span style={{ fontSize: 12, color: "rgba(248,113,113,0.7)", fontWeight: 600 }}>
                        Recusado {p.rejectedAt ? fmtDate(p.rejectedAt) : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <motion.button whileTap={{ scale: 0.96 }} onClick={() => confirm(p)} style={{ height: 34, paddingInline: 12, borderRadius: 10, border: "none", background: "rgba(0,255,136,0.08)", color: "#00ff88", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Ativar PRO
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }} onClick={() => remove(p)} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={13} strokeWidth={2} />
                      </motion.button>
                    </div>
                  </div>
                )}

              </motion.div>
            );
          })}
        </AnimatePresence>

      </div>
    </div>
  );
}
