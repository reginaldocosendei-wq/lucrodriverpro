import { useState } from "react";
import { useGetEarningsReport, useGetMe } from "@workspace/api-client-react";
import { BarChart2, Lock, TrendingUp, Users, Zap, CheckCircle, AlertCircle, X } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "@/lib/api";

const BASE = getApiBase();

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  // Filter out entries whose value is null (days with no data)
  const visible = payload.filter((e: any) => e.value !== null && e.value !== undefined);
  if (!visible.length) return null;
  return (
    <div style={{
      background: "rgba(17,17,17,0.97)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 14, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      backdropFilter: "blur(12px)", minWidth: 160,
    }}>
      <p style={{ fontWeight: 700, color: "#fff", marginBottom: 8, fontSize: 13 }}>{label}</p>
      {visible.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{entry.name}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Empty chart state ─────────────────────────────────────────────────────────
function EmptyChart({ message = "Sem dados suficientes para exibir este gráfico" }: { message?: string }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <BarChart2 size={32} color="rgba(255,255,255,0.1)" />
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 500, textAlign: "center", maxWidth: 220, lineHeight: 1.5 }}>
        {message}
      </p>
    </div>
  );
}

// ─── Chart card wrapper — overflow visible so tooltips are never clipped ───────
function ChartCard({ title, subtitle, height = 260, children }: {
  title: string; subtitle?: string; height?: number; children: React.ReactNode
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 20, padding: "24px 20px 20px",
      overflow: "visible",
    }}>
      <p style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb", marginBottom: subtitle ? 6 : 20, letterSpacing: "-0.01em" }}>{title}</p>
      {subtitle && (
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 16, fontWeight: 500 }}>{subtitle}</p>
      )}
      <div style={{ height, width: "100%" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Date label formatter — "2026-03-29" → "29/03" ────────────────────────────
function fmtDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  return iso.slice(8) + "/" + iso.slice(5, 7);
}

// ─── Reports page ──────────────────────────────────────────────────────────────
export default function Reports() {
  const { data: user } = useGetMe();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: reports, isLoading } = useGetEarningsReport({
    query: { enabled: user?.plan === "pro" }
  });

  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError]     = useState<string | null>(null);
  const [trialSuccess, setTrialSuccess] = useState(false);

  const isPro = user?.plan === "pro";

  const handleStartTrial = async () => {
    setTrialLoading(true);
    setTrialError(null);
    try {
      const res  = await fetch(`${BASE}/api/auth/trial/start`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setTrialError(data.error || "Algo deu errado. Tente novamente."); return; }
      setTrialSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }), 800);
    } catch {
      setTrialError("Algo deu errado. Tente novamente.");
    } finally {
      setTrialLoading(false);
    }
  };

  // ── Paywall ────────────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-background z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/10 blur-[100px] rounded-full z-0 pointer-events-none" />

        <div className="absolute inset-0 z-0 opacity-20 flex flex-col gap-8 p-4 blur-sm pointer-events-none select-none">
          <div className="h-64 border border-white/10 rounded-3xl bg-white/[0.02] flex items-end justify-between px-8 pb-8 pt-20">
            {[40, 70, 45, 90, 60, 100, 80].map((h, i) => (
              <div key={i} className="w-12 bg-white/20 rounded-t-lg" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 border border-white/10 rounded-3xl bg-white/[0.02]" />
            <div className="h-48 border border-white/10 rounded-3xl bg-white/[0.02]" />
          </div>
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative z-10 max-w-lg w-full bg-black/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-yellow-500/20">
            <Lock size={48} className="text-black" />
          </div>

          <div className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
            <Users size={14} className="text-yellow-500" />
            <span className="text-xs font-bold text-white">Mais de 5.000 motoristas já usam o PRO</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white mb-3 tracking-tight">
            Relatórios <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600">PRO</span>
          </h2>

          <p className="text-sm text-white/50 mb-2 leading-relaxed">
            Você está vendo apenas dados básicos. Desbloqueie relatórios completos com PRO e descubra seu lucro real.
          </p>
          <p className="text-base text-white/70 mb-6 font-medium leading-relaxed">
            Motoristas com relatórios avançados ganham em média <strong className="text-white">23% mais</strong>.
          </p>

          <AnimatePresence>
            {trialError && (
              <motion.div key="trial-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-3 mb-4 text-sm text-red-400 text-left"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="flex-1">{trialError}</span>
                <button onClick={() => setTrialError(null)} className="text-red-400/60 hover:text-red-400"><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {trialSuccess && (
              <motion.div key="trial-success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/30 p-4 mb-4 text-sm text-primary text-left"
              >
                <CheckCircle size={20} className="shrink-0 text-primary" />
                <div>
                  <p className="font-bold text-white mb-0.5">Teste ativado com sucesso!</p>
                  <p className="text-white/60 text-xs">Seu período de teste gratuito de 7 dias foi iniciado. Aproveite os recursos PRO!</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            <button
              onClick={handleStartTrial}
              disabled={trialLoading || trialSuccess}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-yellow-500/30 hover:from-yellow-300 hover:to-yellow-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {trialLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : trialSuccess ? (
                <><CheckCircle size={20} /> Teste ativado!</>
              ) : (
                <><Zap size={20} /> Experimentar grátis por 7 dias</>
              )}
            </button>
            <button
              onClick={() => navigate("/upgrade")}
              className="w-full h-12 rounded-2xl border border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.05] font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            >
              Ver todos os planos
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ display: "flex", height: 256, alignItems: "center", justifyContent: "center" }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(234,179,8,0.15)", borderTopColor: "#eab308" }} />
    </div>
  );

  if (!reports) return null;

  // ── Derived states ────────────────────────────────────────────────────────
  const daily       = (reports as any).daily       as any[] ?? [];
  const byPlatform  = (reports as any).byPlatform  as any[] ?? [];
  const byDayOfWeek = (reports as any).byDayOfWeek as any[] ?? [];

  // Strip null-earnings days so Recharts receives a clean array where every
  // consecutive pair of entries has real values and can be connected by a line.
  // With nulls in the array and connectNulls=false, non-adjacent real points
  // are treated as isolated dots — no line is drawn between them.
  const dailyPoints: any[] = daily.filter((d: any) => d.earnings !== null && d.earnings > 0);

  const hasDailyData    = dailyPoints.length > 0;
  const singleDay       = dailyPoints.length === 1;
  const fewRecords      = dailyPoints.length > 1 && dailyPoints.length < 5;

  const hasAnyEarnings  = hasDailyData || byPlatform.length > 0;
  const hasPlatformData = byPlatform.length > 0;
  const hasDayData      = byDayOfWeek.some((d: any) => d.earnings > 0);

  const axisStyle = { fill: "#6b7280", fontSize: 10, fontWeight: 600 } as const;
  const gridColor = "rgba(255,255,255,0.05)";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>

      {/* PRO badge */}
      <div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 999,
          background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)",
          fontSize: 10, fontWeight: 800, color: "#eab308", letterSpacing: "0.08em",
          marginBottom: 14,
        }}>
          {(user as any)?.trialActive
            ? `⏳ MODO TESTE · ${(user as any)?.trialDaysLeft} DIAS RESTANTES`
            : "✦ RECURSO PRO ATIVO"}
        </div>

        {(user as any)?.trialActive && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderRadius: 14, marginBottom: 14,
            background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.15)",
          }}>
            <span style={{ fontSize: 12, color: "rgba(234,179,8,0.7)" }}>Teste gratuito ativo — faça upgrade para não perder acesso</span>
            <button onClick={() => navigate("/upgrade")}
              style={{ fontSize: 12, fontWeight: 700, color: "#eab308", background: "none", border: "none", cursor: "pointer", marginLeft: 12, flexShrink: 0 }}>
              Fazer upgrade →
            </button>
          </div>
        )}

        <p style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart2 size={22} color="#00ff88" /> Análise de Desempenho
        </p>
      </div>

      {/* No data at all */}
      {!hasAnyEarnings && (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18, padding: "32px 24px", textAlign: "center",
        }}>
          <BarChart2 size={40} color="rgba(255,255,255,0.1)" style={{ margin: "0 auto 14px" }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            Nenhum dado registrado ainda
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
            Importe seu histórico ou adicione corridas manualmente para ver os gráficos.
          </p>
        </div>
      )}

      {/* ── Evolução Diária ───────────────────────────────────────────────── */}
      <ChartCard
        title="📈 Evolução Diária — Últimos 30 dias"
        subtitle={fewRecords ? "Adicione mais dias para visualizar a evolução completa" : undefined}
        height={singleDay ? 200 : 300}
      >
        {!hasDailyData ? (
          <EmptyChart message="Nenhum ganho registrado nos últimos 30 dias. Importe corridas ou adicione dados manualmente." />

        ) : singleDay ? (
          /* ── Single day: polished stat card instead of a near-empty chart ── */
          <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
              {fmtDate(dailyPoints[0].date)} · 1 dia registrado
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {([
                { label: "Ganhos",     value: dailyPoints[0].earnings, color: "#00ff88" },
                { label: "Custos",     value: dailyPoints[0].costs,    color: "#ef4444" },
                ...(dailyPoints[0].profit !== null
                  ? [{ label: "Lucro Real", value: dailyPoints[0].profit, color: "#3b82f6" }]
                  : []),
              ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${color}33`,
                  borderRadius: 16, padding: "14px 20px", textAlign: "center", minWidth: 96,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center", marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.07em" }}>
                      {label.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: 19, fontWeight: 900, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {formatBRL(value ?? 0)}
                  </p>
                </div>
              ))}
            </div>
            <p style={{
              textAlign: "center", fontSize: 13, lineHeight: 1.6, fontWeight: 500,
              color: "rgba(255,255,255,0.35)", maxWidth: 320, margin: "0 auto",
              letterSpacing: "0.01em",
            }}>
              Você já está no lucro. Agora registre mais dias e descubra como escalar seus resultados.
            </p>
          </div>

        ) : (
          /* ── 2+ days: LineChart over the filtered (null-free) points ──────── */
          /* dailyPoints contains only real days — no nulls — so every adjacent  */
          /* pair is connected by a line without needing connectNulls trickery.  */
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyPoints} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                dy={8}
              />
              <YAxis
                tickFormatter={(v) => `R$${v}`}
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                dx={-4}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 2 }} />
              <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, fontWeight: 600 }} iconType="circle" />
              <Line type="monotone" dataKey="earnings" name="Ganhos"     stroke="#00ff88" strokeWidth={2.5} dot={{ r: 2.5, fill: "#00ff88", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#00ff88", stroke: "#000", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="costs"    name="Custos"     stroke="#ef4444" strokeWidth={2.5} dot={{ r: 2.5, fill: "#ef4444", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ef4444", stroke: "#000", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="profit"   name="Lucro Real" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#3b82f6", stroke: "#000", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Platform + Day of Week ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>

        {/* Ganhos por Plataforma */}
        <ChartCard title="🏁 Ganhos por Plataforma" height={hasPlatformData ? Math.max(180, byPlatform.length * 52) : 180}>
          {!hasPlatformData ? (
            <EmptyChart message="Nenhuma plataforma registrada ainda. Importe corridas para ver este gráfico." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byPlatform}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `R$${v}`}
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="platform"
                  type="category"
                  tick={{ fill: "#e5e7eb", fontSize: 12, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="earnings" name="Ganhos Brutos" fill="#00ff88" radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Melhores Dias da Semana */}
        <ChartCard title="📅 Melhores Dias da Semana" height={220}>
          {!hasDayData ? (
            <EmptyChart message="Sem dados suficientes. Adicione mais corridas para ver o desempenho por dia." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byDayOfWeek}
                margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={(v) => `R$${v}`} tick={axisStyle} axisLine={false} tickLine={false} dx={-4} width={52} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="earnings" name="Média de Ganhos" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

    </motion.div>
  );
}
