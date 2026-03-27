import { useState, useEffect, useRef } from "react";
import { useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { formatBRL } from "@/lib/utils";
import { Card } from "@/components/ui";
import {
  TrendingUp, Car, AlertCircle, Target, Award,
  Zap, Lock, Plus, ChevronRight, Camera, Clock, Navigation, Star,
  TrendingDown, Gauge,
} from "lucide-react";
import { motion, animate, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { InsightsPanel } from "@/components/InsightsPanel";
import { DecisionEngine } from "@/components/DecisionEngine";
import { DailyGoalCard } from "@/components/DailyGoalCard";
import { WeeklyRanking } from "@/components/WeeklyRanking";
import { LostProfitCard } from "@/components/LostProfitCard";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
function Counter({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    const ctrl = animate(from, value, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => ctrl.stop();
  }, [value]);

  return (
    <>
      {new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(display)}
    </>
  );
}

// ─── RING PROGRESS ───────────────────────────────────────────────────────────
function Ring({ pct, color, size = 84, stroke = 7 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, pct) / 100) * circ;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, accent, icon: Icon, loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 18,
        padding: "18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${accent}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={14} color={accent} />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
          textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)",
        }}>
          {label}
        </span>
      </div>

      <div>
        {loading ? (
          <div style={{ height: 28, width: 80, borderRadius: 6, background: "rgba(255,255,255,0.06)" }} />
        ) : (
          <p style={{ fontSize: 22, fontWeight: 800, color: "#f9fafb", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {value}
          </p>
        )}
        {sub && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4, fontWeight: 500 }}>{sub}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── PROGRESS BAR ────────────────────────────────────────────────────────────
function ProgressBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
      <motion.div
        style={{ height: "100%", borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}60` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay }}
      />
    </div>
  );
}

// ─── PLATFORM META ───────────────────────────────────────────────────────────
const platformMeta: Record<string, { label: string; pronoun: string }> = {
  uber: { label: "Uber", pronoun: "nele" },
  "99": { label: "99", pronoun: "nela" },
  indriver: { label: "InDrive", pronoun: "nele" },
  outro: { label: "Outro", pronoun: "nele" },
};

// ─── DAILY ANALYSIS ───────────────────────────────────────────────────────────
function DailyAnalysis({ summary }: { summary: any }) {
  if (!summary?.earningsToday || summary.earningsToday <= 0) return null;

  const { earningsToday, costsToday, realProfitToday, ridesCountToday, avgPerRide } = summary;
  const earningsPerRideToday = summary.earningsPerTripToday;
  const marginPct = earningsToday > 0 ? (realProfitToday / earningsToday) * 100 : 0;
  const costRatioPct = earningsToday > 0 ? (costsToday / earningsToday) * 100 : 0;

  type S = "great" | "good" | "weak" | "negative";
  const status: S =
    realProfitToday <= 0 ? "negative"
    : marginPct >= 50 ? "great"
    : marginPct >= 25 ? "good"
    : "weak";

  const cfg = {
    great:    { label: "Ótimo dia 🔥", color: "#00ff88", border: "rgba(0,255,136,0.2)",    bg: "rgba(0,255,136,0.05)",    message: "Margem excelente. Você está maximizando cada real ganho.", suggestions: ["Replique a estratégia de hoje", "Custos sob controle — continue assim"] },
    good:     { label: "Bom dia 👍",   color: "#4ade80", border: "rgba(74,222,128,0.2)",   bg: "rgba(74,222,128,0.04)",   message: "Dia sólido. Você lucrou de forma consistente.", suggestions: ["Trabalhe nos horários de pico", "Prefira corridas mais longas"] },
    weak:     { label: "Dia fraco ⚠️", color: "#eab308", border: "rgba(234,179,8,0.25)",  bg: "rgba(234,179,8,0.05)",    message: "Lucro baixo. Vale rever custos e horários.", suggestions: ["Foque nos horários de alta demanda", "Controle gastos com combustível"] },
    negative: { label: "Prejuízo ❌",  color: "#ef4444", border: "rgba(239,68,68,0.25)",  bg: "rgba(239,68,68,0.05)",    message: "Custos superaram os ganhos hoje.", suggestions: ["Reduza custos fixos com urgência", "Evite horários de baixa demanda"] },
  }[status];

  const secondary: string[] = [];
  if (costRatioPct > 40 && costsToday > 0)
    secondary.push(`Custos representaram ${Math.round(costRatioPct)}% dos ganhos — acima de 40%.`);
  if (avgPerRide > 0 && earningsPerRideToday && earningsPerRideToday < avgPerRide * 0.8)
    secondary.push(`Corridas renderam ${formatBRL(earningsPerRideToday)} cada — abaixo da média de ${formatBRL(avgPerRide)}.`);
  if (ridesCountToday > 0 && realProfitToday > 0)
    secondary.push(`Lucro médio por corrida: ${formatBRL(realProfitToday / ridesCountToday)}.`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 22,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 4 }}>
            Análise do dia
          </p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb" }}>{cfg.label}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 2 }}>LUCRO HOJE</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: cfg.color, fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(realProfitToday)}
          </p>
        </div>
      </div>

      {/* Margin bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginBottom: 6 }}>
          <span>Ganhos {formatBRL(earningsToday)}</span>
          <span>Custos {formatBRL(costsToday)}</span>
        </div>
        <div style={{ height: 8, background: "rgba(0,0,0,0.5)", borderRadius: 999, overflow: "hidden" }}>
          <motion.div
            style={{ height: "100%", background: cfg.color, boxShadow: `0 0 12px ${cfg.color}60`, borderRadius: 999 }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, Math.min(100, Math.abs(marginPct)))}%` }}
            transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 5, fontWeight: 500 }}>
          {realProfitToday > 0 ? `${Math.round(marginPct)}% de margem de lucro` : "Margem negativa"}
        </p>
      </div>

      {/* Message */}
      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{cfg.message}</p>
      </div>

      {/* Secondary insights */}
      {secondary.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {secondary.map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, marginTop: 5, flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 10 }}>
          💡 Como melhorar
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cfg.suggestions.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, flexShrink: 0 }}>{i + 1}.</span>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{s}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── FAKE WEEK DATA ───────────────────────────────────────────────────────────
const fakeWeekData = [
  { day: "Seg", v: 178 }, { day: "Ter", v: 243 }, { day: "Qua", v: 159 },
  { day: "Qui", v: 312 }, { day: "Sex", v: 276 }, { day: "Sáb", v: 391 }, { day: "Dom", v: 208 },
];

// ─── STAGGER VARIANTS ─────────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.45 } },
};

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: user } = useGetMe();

  if (isLoading) {
    return (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: "2px solid rgba(0,255,136,0.15)", borderTopColor: "#00ff88",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Carregando seu painel...</p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const isFree = user?.plan !== "pro";
  const isAfterNoon = hour >= 12;

  const pctToday = Math.min(100, summary.goalDailyPct || 0);
  const profit = summary.realProfitToday ?? 0;
  const profitPositive = profit >= 0;
  const profitMonth = summary.realProfitMonth ?? 0;
  const profitMonthPositive = profitMonth >= 0;
  const marginMonth = summary.earningsMonth > 0 ? (profitMonth / summary.earningsMonth) * 100 : 0;

  let ringColor = "#00ff88";
  if (isAfterNoon && pctToday < 40) ringColor = "#ef4444";
  else if (isAfterNoon && pctToday < 80) ringColor = "#eab308";

  // Simple alerts
  const alerts: { id: string; color: string; icon: React.ReactNode; title: string; text: string }[] = [];
  if (pctToday < 100 && summary.goalDailyPct > 0) {
    const dailyGoal = summary.earningsToday / (pctToday / 100);
    const remaining = dailyGoal - summary.earningsToday;
    if (remaining > 0 && isFinite(remaining)) {
      alerts.push({
        id: "meta", color: pctToday >= 80 ? "#00ff88" : "#eab308",
        icon: <Zap size={15} />,
        title: pctToday >= 80 ? "Quase lá! 🎯" : "Abaixo da meta",
        text: `Faltam ${formatBRL(remaining)} para bater sua meta diária.`,
      });
    }
  }
  if (summary.bestPlatform && summary.bestPlatform !== "-") {
    const meta = platformMeta[summary.bestPlatform.toLowerCase()] ?? { label: summary.bestPlatform, pronoun: "nele" };
    alerts.push({
      id: "platform", color: "#eab308",
      icon: <Award size={15} />,
      title: `${meta.label} em destaque 🏆`,
      text: `Sua plataforma mais rentável agora. Concentre-se ${meta.pronoun}.`,
    });
  }
  if (summary.earningsToday > 0) {
    const remaining = 30 - new Date().getDate();
    const projected = summary.earningsMonth + summary.earningsToday * remaining;
    if (projected > summary.earningsMonth) {
      alerts.push({
        id: "proj", color: "#60a5fa",
        icon: <TrendingUp size={15} />,
        title: "Projeção do mês 📈",
        text: `No ritmo de hoje, você vai faturar ${formatBRL(projected)} este mês.`,
      });
    }
  }
  if (summary.avgPerKm > 0 && summary.avgPerKm < 1.5) {
    alerts.push({
      id: "km", color: "#ef4444",
      icon: <AlertCircle size={15} />,
      title: "Rentabilidade por km baixa",
      text: `${formatBRL(summary.avgPerKm)}/km — abaixo do ideal. Prefira corridas mais longas.`,
    });
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 112 }}
    >

      {/* ─── GREETING HEADER ─────────────────────────────────────────────── */}
      <motion.div variants={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
            {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb" }}>Seu painel financeiro</p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)",
          borderRadius: 20, padding: "5px 12px",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#00ff88", letterSpacing: "0.06em" }}>AO VIVO</span>
        </div>
      </motion.div>

      {/* ─── HERO: REAL PROFIT CARD ──────────────────────────────────────── */}
      <motion.div variants={item}>
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden" }}>
          {/* Backgrounds */}
          <div style={{ position: "absolute", inset: 0, background: "#0d0d0d" }} />
          {/* Grid texture */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.07,
            backgroundImage: "linear-gradient(rgba(0,255,136,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
          {/* Top glow */}
          <div style={{
            position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
            width: 320, height: 200,
            background: profitPositive ? "radial-gradient(ellipse, rgba(0,255,136,0.25) 0%, transparent 70%)" : "radial-gradient(ellipse, rgba(239,68,68,0.2) 0%, transparent 70%)",
          }} />

          <div style={{ position: "relative", zIndex: 2, padding: "28px 24px 24px" }}>
            {/* Label */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20, padding: "5px 12px", marginBottom: 20,
            }}>
              <Gauge size={12} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                Lucro real hoje
              </span>
            </div>

            {/* BIG NUMBER */}
            <div style={{ marginBottom: 6 }}>
              <p style={{
                fontSize: 68, fontWeight: 900, lineHeight: 1,
                color: profitPositive ? "#00ff88" : "#ef4444",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
                textShadow: profitPositive ? "0 0 40px rgba(0,255,136,0.5)" : "0 0 40px rgba(239,68,68,0.4)",
              }}>
                <Counter value={profit} />
              </p>
            </div>

            {/* Subtitle */}
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 400, marginBottom: 24, lineHeight: 1.5 }}>
              Faturou{" "}
              <span style={{ color: "#f9fafb", fontWeight: 700 }}>{formatBRL(summary.earningsToday)}</span>
              {" "}· custou{" "}
              <span style={{ color: "rgba(239,68,68,0.9)", fontWeight: 600 }}>{formatBRL(summary.costsToday)}</span>
            </p>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />

            {/* Stats row */}
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
                  Corridas hoje
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb" }}>
                  {summary.ridesCountToday ?? 0}
                </p>
              </div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
              <div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
                  Faturamento
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb" }}>
                  {formatBRL(summary.earningsToday)}
                </p>
              </div>
              {summary.hoursToday != null && (
                <>
                  <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
                  <div>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
                      Horas
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb" }}>
                      {summary.hoursToday.toFixed(1)}h
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Goal ring */}
            {summary.goalDailyPct > 0 && (
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16, background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Ring pct={pctToday} color={ringColor} size={64} stroke={6} />
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ringColor }}>{Math.round(pctToday)}%</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 5 }}>
                    Meta diária de ganhos
                  </p>
                  <ProgressBar pct={pctToday} color={ringColor} />
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
                    {pctToday >= 100 ? "✓ Meta batida! Parabéns!" : pctToday >= 80 ? "Quase lá!" : isAfterNoon && pctToday < 50 ? "Abaixo da média hoje" : "Você está indo bem!"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── 5 METRIC CARDS ─────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 12 }}>
          Indicadores do dia
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Corridas */}
          <MetricCard
            label="Corridas hoje"
            value={summary.ridesCountToday ?? 0}
            accent="#60a5fa"
            icon={Car}
          />

          {/* Faturamento */}
          <MetricCard
            label="Faturamento"
            value={formatBRL(summary.earningsToday)}
            sub="bruto hoje"
            accent="#a78bfa"
            icon={TrendingUp}
          />

          {/* R$/corrida */}
          <MetricCard
            label="R$/corrida"
            value={
              summary.earningsPerTripToday != null
                ? formatBRL(summary.earningsPerTripToday)
                : summary.avgPerRide > 0
                ? formatBRL(summary.avgPerRide)
                : <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>Sem dados</span>
            }
            sub={summary.earningsPerTripToday != null ? "hoje" : summary.avgPerRide > 0 ? "média geral" : undefined}
            accent="#00ff88"
            icon={Target}
          />

          {/* R$/km */}
          <MetricCard
            label="R$/km"
            value={
              summary.earningsPerKmToday != null
                ? formatBRL(summary.earningsPerKmToday)
                : summary.avgPerKm > 0
                ? formatBRL(summary.avgPerKm)
                : <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>Informe km</span>
            }
            sub={summary.kmToday != null ? `${summary.kmToday.toFixed(1)} km hoje` : undefined}
            accent="#f97316"
            icon={Navigation}
          />

          {/* R$/hora */}
          <MetricCard
            label="R$/hora"
            value={
              summary.earningsPerHourToday != null
                ? formatBRL(summary.earningsPerHourToday)
                : <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>Informe horas</span>
            }
            sub={summary.hoursToday != null ? `${summary.hoursToday.toFixed(1)}h hoje` : undefined}
            accent="#c084fc"
            icon={Clock}
          />

          {/* Avaliação */}
          <MetricCard
            label="Avaliação"
            value={
              (summary.ratingToday ?? summary.ratingAll) != null
                ? <span style={{ color: "#fbbf24" }}>{(summary.ratingToday ?? summary.ratingAll)!.toFixed(2)} <span style={{ fontSize: 14 }}>★</span></span>
                : <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>Sem dados</span>
            }
            sub="média dos passageiros"
            accent="#eab308"
            icon={Star}
          />
        </div>
      </motion.div>

      {/* ─── MONTH SUMMARY ──────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 22, padding: "20px 20px 18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 3 }}>
                Resumo do mês
              </p>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>Onde vai seu dinheiro</p>
            </div>
            <div style={{
              background: profitMonthPositive ? "rgba(0,255,136,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${profitMonthPositive ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}`,
              borderRadius: 10, padding: "6px 12px",
              textAlign: "right",
            }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 1 }}>LUCRO MÊS</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: profitMonthPositive ? "#00ff88" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                {formatBRL(profitMonth)}
              </p>
            </div>
          </div>

          {/* Stacked bars */}
          <div style={{ height: 10, borderRadius: 999, background: "rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", marginBottom: 12 }}>
            <motion.div
              style={{ height: "100%", background: "rgba(239,68,68,0.7)", borderRadius: "999px 0 0 999px" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (summary.costsMonth / (summary.earningsMonth || 1)) * 100)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            />
            <motion.div
              style={{ height: "100%", background: "#00ff88", boxShadow: "0 0 10px rgba(0,255,136,0.5)", borderRadius: "0 999px 999px 0" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, marginMonth)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(239,68,68,0.7)" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Gastos {formatBRL(summary.costsMonth)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Lucro {formatBRL(Math.max(0, profitMonth))}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── DAILY GOAL ──────────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <DailyGoalCard
          goalDaily={summary.goalDaily ?? 0}
          earningsToday={summary.earningsToday ?? 0}
        />
      </motion.div>

      {/* ─── DAILY ANALYSIS ─────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <DailyAnalysis summary={summary} />
      </motion.div>

      {/* ─── WEEKLY RANKING ──────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <WeeklyRanking />
      </motion.div>

      {/* ─── LOST PROFIT ESTIMATION ──────────────────────────────────────────── */}
      <motion.div variants={item}>
        <LostProfitCard />
      </motion.div>

      {/* ─── DECISION ENGINE ─────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <DecisionEngine />
      </motion.div>

      {/* ─── FINANCIAL INTELLIGENCE ──────────────────────────────────────────── */}
      <motion.div variants={item}>
        <InsightsPanel />
      </motion.div>

      {/* ─── WEEKLY CHART ────────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 22, padding: "20px 20px 16px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 3 }}>
                Evolução
              </p>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>Faturamento da semana</p>
            </div>
            {isFree && (
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: "linear-gradient(135deg, #eab308, #d97706)",
                color: "#000", padding: "4px 10px", borderRadius: 999,
                letterSpacing: "0.06em",
              }}>✦ PRO</span>
            )}
          </div>

          <div style={{ height: 140, position: "relative" }}>
            {isFree && (
              <>
                <div style={{ position: "absolute", inset: 0, filter: "blur(3px)", opacity: 0.25, pointerEvents: "none" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fakeWeekData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fakeG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="#00ff88" strokeWidth={2} fill="url(#fakeG)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                  <Link href="/reports">
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: "linear-gradient(135deg, #eab308, #d97706)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 8px 24px rgba(234,179,8,0.35)",
                      }}>
                        <Lock size={19} color="#000" />
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#f9fafb" }}>Desbloqueie com PRO</p>
                    </div>
                  </Link>
                </div>
              </>
            )}
            {!isFree && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fakeWeekData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="proG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#555", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "#161616", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                    itemStyle={{ color: "#00ff88", fontWeight: 700 }}
                    formatter={(v: number) => [formatBRL(v), "Faturamento"]}
                    cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="v" stroke="#00ff88" strokeWidth={2.5} fill="url(#proG)" dot={false} activeDot={{ r: 5, fill: "#00ff88", stroke: "#000", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── SMART ALERTS ────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <motion.div variants={item} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
            Alertas
          </p>
          {alerts.slice(0, 3).map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px", borderRadius: 18,
                border: `1px solid ${a.color}30`,
                background: `${a.color}08`,
              }}
            >
              <div style={{ color: a.color, marginTop: 1, flexShrink: 0 }}>{a.icon}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 3 }}>{a.title}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{a.text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ─── GOAL PROGRESS ───────────────────────────────────────────────────── */}
      {(summary.goalWeekly > 0 || summary.goalMonthly > 0) && (
        <motion.div variants={item}>
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 22, padding: 20,
          }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", marginBottom: 20 }}>Metas de ganhos</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {summary.goalWeekly > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Esta semana</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", marginLeft: 10 }}>{formatBRL(summary.earningsWeek)}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#00ff88" }}>{Math.round(summary.goalWeeklyPct || 0)}%</span>
                  </div>
                  <ProgressBar pct={summary.goalWeeklyPct || 0} color="#00ff88" delay={0.2} />
                </div>
              )}
              {summary.goalMonthly > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Este mês</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", marginLeft: 10 }}>{formatBRL(summary.earningsMonth)}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#00ff88" }}>{Math.round(summary.goalMonthlyPct || 0)}%</span>
                  </div>
                  <ProgressBar pct={summary.goalMonthlyPct || 0} color="#00ff88" delay={0.4} />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── PRO UPSELL ──────────────────────────────────────────────────────── */}
      {isFree && (
        <motion.div variants={item}>
          <Link href="/upgrade">
            <div style={{
              position: "relative", borderRadius: 22, overflow: "hidden", cursor: "pointer",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(217,119,6,0.08))" }} />
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, background: "rgba(234,179,8,0.15)", borderRadius: "50%", filter: "blur(40px)" }} />
              <div style={{
                position: "relative", zIndex: 2, padding: 18,
                border: "1px solid rgba(234,179,8,0.2)", borderRadius: 22,
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <div style={{
                  width: 52, height: 52, flexShrink: 0,
                  background: "linear-gradient(135deg, #eab308, #d97706)",
                  borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(234,179,8,0.3)",
                }}>
                  <Lock size={22} color="#000" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb", marginBottom: 3 }}>Ative o PRO ✦</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
                    Desbloqueie relatórios, simulador e histórico completo.
                  </p>
                </div>
                <ChevronRight size={18} color="rgba(234,179,8,0.7)" style={{ flexShrink: 0 }} />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* ─── IMPORT CTA ──────────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <Link href="/import">
          <motion.div whileTap={{ scale: 0.97 }} style={{
            position: "relative", borderRadius: 22, overflow: "hidden", cursor: "pointer",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,204,106,0.06))" }} />
            <div style={{
              position: "relative", zIndex: 2, padding: 18,
              border: "1px solid rgba(0,255,136,0.15)", borderRadius: 22,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 52, height: 52, flexShrink: 0,
                background: "linear-gradient(135deg, #00ff88, #00cc6a)",
                borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 24px rgba(0,255,136,0.3)",
              }}>
                <Camera size={22} color="#000" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb", marginBottom: 3 }}>Importar resultados do dia</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                  Tire um print e registre em 10 segundos
                </p>
              </div>
              <ChevronRight size={18} color="rgba(0,255,136,0.6)" style={{ flexShrink: 0 }} />
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* ─── FLOATING ACTION BUTTON ──────────────────────────────────────────── */}
      <Link href="/rides">
        <motion.div
          style={{ position: "fixed", bottom: 88, right: 20, zIndex: 40 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.9, type: "spring", damping: 15, stiffness: 200 }}
          whileTap={{ scale: 0.92 }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#00ff88", color: "#000",
            fontWeight: 800, fontSize: 13,
            paddingLeft: 18, paddingRight: 20, height: 52, borderRadius: 999,
            boxShadow: "0 8px 32px rgba(0,255,136,0.45)",
          }}>
            <Plus size={19} strokeWidth={2.5} />
            <span>Nova corrida</span>
          </div>
        </motion.div>
      </Link>

    </motion.div>
  );
}
