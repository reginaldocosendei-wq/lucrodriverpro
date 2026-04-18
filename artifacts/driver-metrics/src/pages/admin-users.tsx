import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Search, Shield, Users, Crown, Clock,
  Zap, ZapOff, RotateCcw, Trash2, RefreshCw,
  CheckCircle, XCircle, AlertCircle, ChevronRight,
} from "lucide-react";
import { getApiBase, authFetch } from "@/lib/api";

const BASE = getApiBase();

// ─── Types ────────────────────────────────────────────────────────────────────
type PlanSource = "stripe" | "pix_admin" | "trial" | "free";

interface AdminUser {
  id:             number;
  name:           string;
  email:          string;
  plan:           "free" | "pro";
  planSource:     PlanSource;
  trialActive:    boolean;
  trialExpired:   boolean;
  trialDaysLeft:  number;
  trialEndDate:   string | null;
  trialStartDate: string | null;
  stripeCustomerId: string | null;
  stripeSubId:    string | null;
  createdAt:      string;
}

interface Stats {
  total:      number;
  totalPro:   number;
  totalTrial: number;
  totalFree:  number;
  pendingPix: number;
}

interface Toast { id: number; msg: string; type: "ok" | "err"; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pro_stripe:   { label: "PRO · Stripe",  color: "#00ff88", bg: "rgba(0,255,136,0.1)" },
  pro_pix:      { label: "PRO · PIX",     color: "#00ff88", bg: "rgba(0,255,136,0.1)" },
  pro_admin:    { label: "PRO · Admin",   color: "#00ff88", bg: "rgba(0,255,136,0.1)" },
  trial:        { label: "Trial",         color: "#eab308", bg: "rgba(234,179,8,0.1)" },
  trial_exp:    { label: "Trial expirado",color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  free:         { label: "Free",          color: "rgba(255,255,255,0.3)", bg: "rgba(255,255,255,0.05)" },
};

function badgeKey(u: AdminUser): string {
  if (u.plan === "pro" && !u.trialActive) {
    if (u.planSource === "stripe") return "pro_stripe";
    return "pro_pix";
  }
  if (u.trialActive)   return "trial";
  if (u.trialExpired)  return "trial_exp";
  return "free";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [, navigate]    = useLocation();
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [filter, setFilter]       = useState("all");
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [access, setAccess]       = useState<"ok" | "denied" | "loading">("loading");
  const [toasts, setToasts]       = useState<Toast[]>([]);
  const [acting, setActing]       = useState<Record<number, string>>({});
  const [confirmDel, setConfirmDel] = useState<AdminUser | null>(null);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);

  const addToast = (msg: string, type: "ok" | "err") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  const fetchStats = useCallback(async () => {
    try {
      const r = await authFetch(`${BASE}/api/admin/users/stats`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } catch { /* ignore */ }
  }, []);

  const fetchUsers = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, page: String(p), search });
      const r = await authFetch(`${BASE}/api/admin/users?${params}`, { credentials: "include" });
      if (r.status === 403) { setAccess("denied"); return; }
      if (!r.ok) { addToast("Erro ao carregar usuários", "err"); return; }
      const data = await r.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setAccess("ok");
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => { fetchUsers(1); fetchStats(); }, [filter]);
  useEffect(() => {
    const t = setTimeout(() => { fetchUsers(1); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function action(userId: number, endpoint: string, label: string) {
    setActing((p) => ({ ...p, [userId]: endpoint }));
    try {
      const r = await authFetch(`${BASE}/api/admin/users/${userId}/${endpoint}`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) { addToast(d.error ?? "Erro", "err"); return; }
      addToast(d.message ?? label, "ok");
      await fetchUsers(); await fetchStats();
    } catch { addToast("Erro de conexão", "err"); }
    finally { setActing((p) => { const n = { ...p }; delete n[userId]; return n; }); }
  }

  async function deleteUser(u: AdminUser) {
    setActing((p) => ({ ...p, [u.id]: "delete" }));
    setConfirmDel(null);
    try {
      const r = await authFetch(`${BASE}/api/admin/users/${u.id}`, {
        method: "DELETE", credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) { addToast(d.error ?? "Erro", "err"); return; }
      addToast(d.message ?? "Usuário excluído", "ok");
      await fetchUsers(); await fetchStats();
    } catch { addToast("Erro de conexão", "err"); }
    finally { setActing((p) => { const n = { ...p }; delete n[u.id]; return n; }); }
  }

  // ── Access denied ────────────────────────────────────────────────────────────
  if (access === "denied") {
    return (
      <div style={{ minHeight: "100dvh", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <Shield size={40} color="rgba(255,255,255,0.15)" strokeWidth={1.5} />
        <p style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Acesso restrito</p>
        <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Configure ADMIN_EMAIL nas Secrets.</p>
        <button onClick={() => navigate("/")} style={{ marginTop: 24, padding: "10px 20px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Voltar
        </button>
      </div>
    );
  }

  const FILTERS = [
    { key: "all",   label: "Todos",  count: stats?.total },
    { key: "pro",   label: "PRO",    count: stats?.totalPro },
    { key: "trial", label: "Trial",  count: stats?.totalTrial },
    { key: "free",  label: "Free",   count: stats?.totalFree },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#080808", display: "flex", flexDirection: "column" }}>

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              style={{ padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                background: t.type === "ok" ? "rgba(0,255,136,0.12)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${t.type === "ok" ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}`,
                color: t.type === "ok" ? "#00ff88" : "#f87171", maxWidth: 280 }}>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDel(null)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>Excluir usuário?</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>{confirmDel.email}</p>
              <p style={{ fontSize: 12, color: "#f87171", marginBottom: 20 }}>Esta ação é irreversível. Todos os dados do usuário serão excluídos.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDel(null)}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancelar
                </button>
                <button onClick={() => deleteUser(confirmDel)}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: 960, margin: "0 auto", width: "100%", padding: "0 16px 100px", overflowY: "auto", height: "100dvh" }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 52, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate("/")}
              style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ChevronLeft size={18} color="rgba(255,255,255,0.6)" />
            </motion.button>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>Painel Admin</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,0.92)", marginTop: 2 }}>Usuários</h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate("/admin/pix")}
              style={{ height: 34, padding: "0 12px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)", color: "#eab308", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              PIX {stats && stats.pendingPix > 0 && (
                <span style={{ background: "#eab308", color: "#000", borderRadius: 20, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{stats.pendingPix}</span>
              )}
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => { fetchUsers(); fetchStats(); }}
              style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <RefreshCw size={15} color="rgba(255,255,255,0.4)" />
            </motion.button>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {[
              { label: "Total",   value: stats.total,      icon: Users,       color: "rgba(255,255,255,0.5)" },
              { label: "PRO",     value: stats.totalPro,   icon: Crown,       color: "#00ff88" },
              { label: "Trial",   value: stats.totalTrial, icon: Clock,       color: "#eab308" },
              { label: "Free",    value: stats.totalFree,  icon: AlertCircle, color: "rgba(255,255,255,0.25)" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
                <Icon size={14} color={color} strokeWidth={2} style={{ marginBottom: 6 }} />
                <p style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.2)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Search ────────────────────────────────────────────────────────── */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search size={14} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email ou nome…"
            style={{ width: "100%", height: 44, borderRadius: 14, background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", paddingLeft: 38, paddingRight: 16, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* ── Filter chips ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
          {FILTERS.map(({ key, label, count }) => (
            <motion.button key={key} whileTap={{ scale: 0.94 }} onClick={() => { setFilter(key); setPage(1); }}
              style={{
                flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 20, border: "none",
                background: filter === key ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.04)",
                color: filter === key ? "#00ff88" : "rgba(255,255,255,0.35)",
                fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              {label}
              {count !== undefined && (
                <span style={{ background: filter === key ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.08)", borderRadius: 20, padding: "1px 7px", fontSize: 10 }}>
                  {count}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* ── User list ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 130, borderRadius: 18, background: "#0e0e0e", opacity: 0.5 }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Users size={36} color="rgba(255,255,255,0.1)" strokeWidth={1.5} />
            <p style={{ marginTop: 12, fontSize: 14, color: "rgba(255,255,255,0.2)" }}>Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {users.map((u) => {
              const bk    = badgeKey(u);
              const badge = PLAN_BADGE[bk] ?? PLAN_BADGE.free;
              const busy  = !!acting[u.id];

              return (
                <motion.div key={u.id} layout
                  style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "14px 16px" }}>

                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.email}
                      </p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginTop: 3 }}>
                        Cadastro: {fmt(u.createdAt)}
                        {u.trialActive && ` · ${u.trialDaysLeft}d restantes`}
                        {u.trialExpired && ` · Trial encerrado em ${fmt(u.trialEndDate)}`}
                      </p>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: badge.bg, borderRadius: 20, padding: "4px 10px", flexShrink: 0, marginLeft: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: badge.color, letterSpacing: "0.04em" }}>{badge.label}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {u.plan === "free" && !u.trialActive && (
                      <ActionBtn disabled={busy} color="#00ff88" onClick={() => action(u.id, "activate-pro", "PRO ativado")}>
                        <Zap size={11} /> Ativar PRO
                      </ActionBtn>
                    )}
                    {u.plan === "pro" && !u.trialActive && (
                      <ActionBtn disabled={busy} color="#f87171" onClick={() => action(u.id, "remove-pro", "PRO removido")}>
                        <ZapOff size={11} /> Remover PRO
                      </ActionBtn>
                    )}
                    {u.trialActive && (
                      <>
                        <ActionBtn disabled={busy} color="#00ff88" onClick={() => action(u.id, "activate-pro", "PRO ativado")}>
                          <Crown size={11} /> Converter PRO
                        </ActionBtn>
                        <ActionBtn disabled={busy} color="#f87171" onClick={() => action(u.id, "end-trial", "Trial encerrado")}>
                          <XCircle size={11} /> Encerrar Trial
                        </ActionBtn>
                      </>
                    )}
                    {!u.trialActive && !u.trialStartDate && u.plan === "free" && (
                      <ActionBtn disabled={busy} color="#eab308" onClick={() => action(u.id, "start-trial", "Trial iniciado")}>
                        <Clock size={11} /> Iniciar Trial
                      </ActionBtn>
                    )}
                    <ActionBtn disabled={busy} color="#f87171" variant="ghost" onClick={() => setConfirmDel(u)}>
                      <Trash2 size={11} /> Excluir
                    </ActionBtn>
                  </div>

                  {busy && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(0,255,136,0.2)", borderTopColor: "#00ff88" }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Processando…</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {total > 40 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 24 }}>
            <motion.button whileTap={{ scale: 0.92 }} disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); fetchUsers(p); }}
              style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.3 : 1 }}>
              <ChevronLeft size={16} color="rgba(255,255,255,0.5)" />
            </motion.button>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
              {page} / {Math.ceil(total / 40)}
            </span>
            <motion.button whileTap={{ scale: 0.92 }} disabled={page >= Math.ceil(total / 40)}
              onClick={() => { const p = page + 1; setPage(p); fetchUsers(p); }}
              style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: page >= Math.ceil(total / 40) ? "default" : "pointer", opacity: page >= Math.ceil(total / 40) ? 0.3 : 1 }}>
              <ChevronRight size={16} color="rgba(255,255,255,0.5)" />
            </motion.button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Reusable small action button ─────────────────────────────────────────────
function ActionBtn({
  children, color, disabled, onClick, variant,
}: {
  children: React.ReactNode;
  color: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "ghost";
}) {
  return (
    <motion.button whileTap={{ scale: 0.94 }} onClick={onClick} disabled={disabled}
      style={{
        height: 30, padding: "0 10px", borderRadius: 9, border: "none",
        background: variant === "ghost" ? "rgba(255,255,255,0.04)" : `${color}18`,
        color: variant === "ghost" ? "rgba(255,255,255,0.3)" : color,
        fontSize: 11, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
        opacity: disabled ? 0.5 : 1,
      }}>
      {children}
    </motion.button>
  );
}
