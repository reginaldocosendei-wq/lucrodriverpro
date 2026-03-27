import { useState, useEffect, useRef } from "react";
import { useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { formatBRL } from "@/lib/utils";
import {
  TrendingUp, Car, Target, Award, Zap, Lock,
  Plus, ChevronRight, Camera, Clock, Navigation, Star,
  AlertCircle, Gauge,
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

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  card: { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 22 },
  cardPad: "18px 16px",
  gap: 12,
  sectionGap: 24,
  text: { primary: "#f9fafb", muted: "rgba(255,255,255,0.35)", dim: "rgba(255,255,255,0.18)" },
  green: "#00ff88", red: "#ef4444", gold: "#eab308",
  blue: "#60a5fa", purple: "#a78bfa", orange: "#f97316",
};

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
function Counter({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    const ctrl = animate(from, value, {
      duration: 1.6, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => ctrl.stop();
  }, [value]);
  return (
    <>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(display)}</>
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
        transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
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

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({ emoji, label, title }: { emoji: string; label: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
      }}>
        {emoji}
      </div>
      <div>
        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", color: T.text.dim, textTransform: "uppercase", marginBottom: 1 }}>
          {label}
        </p>
        <p style={{ fontSize: 12, fontWeight: 800, color: T.text.muted }}>{title}</p>
      </div>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: React.ReactNode; sub?: string; accent: string; icon: React.ElementType;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "#0e0e0e",
        border: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 20, padding: "16px 14px",
        display: "flex", flexDirection: "column", gap: 10, minHeight: 96,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: `${accent}15`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={12} color={accent} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: T.text.muted }}>
          {label}
        </span>
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 900, color: T.text.primary, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: 10, color: T.text.dim, marginTop: 4 }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── ALERT CARD ──────────────────────────────────────────────────────────────
function AlertCard({ color, icon, title, text, delay }: {
  color: string; icon: React.ReactNode; title: string; text: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "16px 16px", borderRadius: 20,
        border: `1px solid ${color}25`,
        background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: "absolute", left: 0, top: "20%", bottom: "20%",
        width: 3, background: color, borderRadius: "0 3px 3px 0",
        boxShadow: `0 0 8px ${color}60`,
      }} />

      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: T.text.primary, marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}>{text}</p>
      </div>
    </motion.div>
  );
}

// ─── DAILY ANALYSIS ──────────────────────────────────────────────────────────
function DailyAnalysis({ summary }: { summary: any }) {
  if (!summary?.earningsToday || summary.earningsToday <= 0) return null;

  const { earningsToday, costsToday, realProfitToday, ridesCountToday, avgPerRide } = summary;
  const earningsPerRideToday = summary.earningsPerTripToday;
  const marginPct = earningsToday > 0 ? (realProfitToday / earningsToday) * 100 : 0;
  const costRatioPct = earningsToday > 0 ? (costsToday / earningsToday) * 100 : 0;

  type S = "great" | "good" | "weak" | "negative";
  const status: S = realProfitToday <= 0 ? "negative" : marginPct >= 50 ? "great" : marginPct >= 25 ? "good" : "weak";

  const cfg = {
    great:    { label: "Ótimo dia 🔥",  color: T.green,  border: "rgba(0,255,136,0.18)",  bg: "rgba(0,255,136,0.04)",  message: "Margem excelente. Você está maximizando cada real ganho.", suggestions: ["Replique a estratégia de hoje", "Custos sob controle — continue assim"] },
    good:     { label: "Bom dia 👍",    color: "#4ade80", border: "rgba(74,222,128,0.18)", bg: "rgba(74,222,128,0.03)", message: "Dia sólido. Você lucrou de forma consistente.", suggestions: ["Trabalhe nos horários de pico", "Prefira corridas mais longas"] },
    weak:     { label: "Dia fraco ⚠️",  color: T.gold,   border: "rgba(234,179,8,0.22)",  bg: "rgba(234,179,8,0.04)",  message: "Lucro baixo. Vale rever custos e horários.", suggestions: ["Foque nos horários de alta demanda", "Controle gastos com combustível"] },
    negative: { label: "Prejuízo ❌",   color: T.red,    border: "rgba(239,68,68,0.22)",  bg: "rgba(239,68,68,0.04)",  message: "Custos superaram os ganhos hoje.", suggestions: ["Reduza custos fixos com urgência", "Evite horários de baixa demanda"] },
  }[status];

  const secondary: string[] = [];
  if (costRatioPct > 40 && costsToday > 0)
    secondary.push(`Custos representaram ${Math.round(costRatioPct)}% dos ganhos — acima do ideal de 40%.`);
  if (avgPerRide > 0 && earningsPerRideToday && earningsPerRideToday < avgPerRide * 0.8)
    secondary.push(`Corridas renderam ${formatBRL(earningsPerRideToday)} — abaixo da média de ${formatBRL(avgPerRide)}.`);
  if (ridesCountToday > 0 && realProfitToday > 0)
    secondary.push(`Lucro médio por corrida: ${formatBRL(realProfitToday / ridesCountToday)}.`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 22, padding: 20 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: T.text.dim, textTransform: "uppercase", marginBottom: 5 }}>Análise do dia</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: T.text.primary }}>{cfg.label}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 9, color: T.text.dim, fontWeight: 700, marginBottom: 3 }}>LUCRO HOJE</p>
          <p style={{ fontSize: 24, fontWeight: 900, color: cfg.color, fontVariantNumeric: "tabular-nums" }}>{formatBRL(realProfitToday)}</p>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.text.muted, fontWeight: 600, marginBottom: 6 }}>
          <span>Ganhos {formatBRL(earningsToday)}</span>
          <span>Custos {formatBRL(costsToday)}</span>
        </div>
        <div style={{ height: 8, background: "rgba(0,0,0,0.5)", borderRadius: 999, overflow: "hidden" }}>
          <motion.div
            style={{ height: "100%", background: cfg.color, boxShadow: `0 0 12px ${cfg.color}50`, borderRadius: 999 }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, Math.min(100, Math.abs(marginPct)))}%` }}
            transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
        <p style={{ fontSize: 10, color: T.text.dim, marginTop: 5 }}>
          {realProfitToday > 0 ? `${Math.round(marginPct)}% de margem de lucro` : "Margem negativa"}
        </p>
      </div>

      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: "12px 14px", marginBottom: secondary.length ? 14 : 0 }}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{cfg.message}</p>
      </div>

      {secondary.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {secondary.map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: cfg.color, marginTop: 6, flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{s}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cfg.suggestions.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 12px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, flexShrink: 0 }}>{i + 1}.</span>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{s}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── FAKE WEEK DATA ───────────────────────────────────────────────────────────
const fakeWeekData = [
  { day: "Seg", v: 178 }, { day: "Ter", v: 243 }, { day: "Qua", v: 159 },
  { day: "Qui", v: 312 }, { day: "Sex", v: 276 }, { day: "Sáb", v: 391 }, { day: "Dom", v: 208 },
];

// ─── PLATFORM META ────────────────────────────────────────────────────────────
const platformMeta: Record<string, { label: string; pronoun: string }> = {
  uber: { label: "Uber", pronoun: "nele" },
  "99": { label: "99", pronoun: "nela" },
  indriver: { label: "InDrive", pronoun: "nele" },
  outro: { label: "Outro", pronoun: "nele" },
};

// ─── STAGGER VARIANTS ─────────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.44 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: user } = useGetMe();

  if (isLoading) {
    return (
      <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(0,255,136,0.15)", borderTopColor: T.green, animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 13, color: T.text.muted, fontWeight: 500 }}>Carregando seu painel...</p>
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

  let ringColor = T.green;
  if (isAfterNoon && pctToday < 40) ringColor = T.red;
  else if (isAfterNoon && pctToday < 80) ringColor = T.gold;

  // ── Build alerts ────────────────────────────────────────────────────────────
  const alerts: { id: string; color: string; icon: React.ReactNode; title: string; text: string }[] = [];
  if (pctToday < 100 && summary.goalDailyPct > 0) {
    const dailyGoal = summary.earningsToday / (pctToday / 100);
    const remaining = dailyGoal - summary.earningsToday;
    if (remaining > 0 && isFinite(remaining)) {
      alerts.push({
        id: "meta", color: pctToday >= 80 ? T.green : T.gold,
        icon: <Zap size={16} />,
        title: pctToday >= 80 ? "Quase lá! 🎯" : "Abaixo da meta",
        text: `Faltam ${formatBRL(remaining)} para bater sua meta diária de ganhos.`,
      });
    }
  }
  if (summary.bestPlatform && summary.bestPlatform !== "-") {
    const meta = platformMeta[summary.bestPlatform.toLowerCase()] ?? { label: summary.bestPlatform, pronoun: "nele" };
    alerts.push({
      id: "platform", color: T.gold,
      icon: <Award size={16} />,
      title: `${meta.label} em destaque 🏆`,
      text: `Sua plataforma mais rentável agora. Concentre-se ${meta.pronoun}.`,
    });
  }
  if (summary.earningsToday > 0) {
    const daysLeft = 30 - new Date().getDate();
    const projected = summary.earningsMonth + summary.earningsToday * daysLeft;
    if (projected > summary.earningsMonth) {
      alerts.push({
        id: "proj", color: T.blue,
        icon: <TrendingUp size={16} />,
        title: "Projeção do mês 📈",
        text: `No ritmo de hoje você vai faturar ${formatBRL(projected)} este mês.`,
      });
    }
  }
  if (summary.avgPerKm > 0 && summary.avgPerKm < 1.5) {
    alerts.push({
      id: "km", color: T.red,
      icon: <AlertCircle size={16} />,
      title: "Rentabilidade por km baixa",
      text: `${formatBRL(summary.avgPerKm)}/km — abaixo do ideal. Prefira corridas mais longas.`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: T.gap, paddingBottom: 112 }}
    >

      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  GREETING
          ╚══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <div>
          <p style={{ fontSize: 12, color: T.text.muted, fontWeight: 500 }}>
            {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </p>
          <p style={{ fontSize: 17, fontWeight: 800, color: T.text.primary }}>Painel financeiro</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,255,136,0.07)", border: "1px solid rgba(0,255,136,0.18)", borderRadius: 20, padding: "5px 12px" }}>
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, color: T.green, letterSpacing: "0.06em" }}>AO VIVO</span>
        </div>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  SECTION 1 — LUCRO
          ╚══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden" }}>
          {/* Dark base */}
          <div style={{ position: "absolute", inset: 0, background: "#080808" }} />

          {/* Grid texture */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.055,
            backgroundImage: "linear-gradient(rgba(0,255,136,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.8) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />

          {/* Radial glow */}
          <div style={{
            position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
            width: 380, height: 220,
            background: profitPositive
              ? "radial-gradient(ellipse, rgba(0,255,136,0.22) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(239,68,68,0.18) 0%, transparent 70%)",
          }} />

          <div style={{ position: "relative", zIndex: 2, padding: "28px 22px 24px" }}>
            {/* Chip label */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, padding: "5px 12px", marginBottom: 18,
            }}>
              <Gauge size={11} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                Lucro real hoje
              </span>
            </div>

            {/* BIG NUMBER */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              style={{
                fontSize: 72, fontWeight: 900, lineHeight: 1,
                color: profitPositive ? T.green : T.red,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
                textShadow: profitPositive ? "0 0 48px rgba(0,255,136,0.45)" : "0 0 48px rgba(239,68,68,0.4)",
                marginBottom: 8,
              }}
            >
              <Counter value={profit} />
            </motion.p>

            {/* Earnings/costs summary */}
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 400, marginBottom: 22, lineHeight: 1.6 }}>
              Faturou{" "}
              <span style={{ color: T.text.primary, fontWeight: 700 }}>{formatBRL(summary.earningsToday)}</span>
              <span style={{ color: "rgba(255,255,255,0.25)" }}> · custou </span>
              <span style={{ color: "rgba(239,68,68,0.85)", fontWeight: 700 }}>{formatBRL(summary.costsToday)}</span>
            </p>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />

            {/* Stats row */}
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: "Corridas", value: String(summary.ridesCountToday ?? 0) },
                { label: "Faturamento", value: formatBRL(summary.earningsToday) },
                ...(summary.hoursToday != null ? [{ label: "Horas", value: `${summary.hoursToday.toFixed(1)}h` }] : []),
              ].map((s, i, arr) => (
                <div key={s.label} style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  {i > 0 && <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.07)" }} />}
                  <div>
                    <p style={{ fontSize: 9, color: T.text.dim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: T.text.primary, fontVariantNumeric: "tabular-nums" }}>
                      {s.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Goal ring — inside hero */}
            {summary.goalDailyPct > 0 && (
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14, background: "rgba(0,0,0,0.35)", borderRadius: 16, padding: "13px 16px" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Ring pct={pctToday} color={ringColor} size={58} stroke={5} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: ringColor }}>{Math.round(pctToday)}%</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 6 }}>Meta diária</p>
                  <ProgressBar pct={pctToday} color={ringColor} />
                  <p style={{ fontSize: 9, color: T.text.dim, marginTop: 5 }}>
                    {pctToday >= 100 ? "✓ Meta batida! Parabéns!" : pctToday >= 80 ? "Quase lá!" : isAfterNoon && pctToday < 50 ? "Abaixo da média hoje" : "Você está indo bem!"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  SECTION 2 — MÉTRICAS
          ╚══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} style={{ marginTop: 6 }}>
        <SectionHeader emoji="📊" label="Seção 2" title="Indicadores do dia" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MetricCard label="Corridas hoje" value={summary.ridesCountToday ?? 0} accent={T.blue} icon={Car} />
          <MetricCard label="Faturamento" value={formatBRL(summary.earningsToday)} sub="bruto hoje" accent={T.purple} icon={TrendingUp} />
          <MetricCard
            label="R$/corrida"
            value={
              summary.earningsPerTripToday != null ? formatBRL(summary.earningsPerTripToday)
              : summary.avgPerRide > 0 ? formatBRL(summary.avgPerRide)
              : <span style={{ fontSize: 14, color: T.text.dim }}>Sem dados</span>
            }
            sub={summary.earningsPerTripToday != null ? "hoje" : summary.avgPerRide > 0 ? "média geral" : undefined}
            accent={T.green}
            icon={Target}
          />
          <MetricCard
            label="R$/km"
            value={
              summary.earningsPerKmToday != null ? formatBRL(summary.earningsPerKmToday)
              : summary.avgPerKm > 0 ? formatBRL(summary.avgPerKm)
              : <span style={{ fontSize: 14, color: T.text.dim }}>Informe km</span>
            }
            sub={summary.kmToday != null ? `${summary.kmToday.toFixed(1)} km hoje` : undefined}
            accent={T.orange}
            icon={Navigation}
          />
          <MetricCard
            label="R$/hora"
            value={
              summary.earningsPerHourToday != null ? formatBRL(summary.earningsPerHourToday)
              : <span style={{ fontSize: 14, color: T.text.dim }}>Informe horas</span>
            }
            sub={summary.hoursToday != null ? `${summary.hoursToday.toFixed(1)}h hoje` : undefined}
            accent="#c084fc"
            icon={Clock}
          />
          <MetricCard
            label="Avaliação"
            value={
              (summary.ratingToday ?? summary.ratingAll) != null
                ? <span style={{ color: T.gold }}>{(summary.ratingToday ?? summary.ratingAll)!.toFixed(2)} <span style={{ fontSize: 16 }}>★</span></span>
                : <span style={{ fontSize: 14, color: T.text.dim }}>Sem dados</span>
            }
            sub="média dos passageiros"
            accent={T.gold}
            icon={Star}
          />
        </div>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  SECTION 3 — INSIGHTS
          ╚══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHeader emoji="🧠" label="Seção 3" title="Inteligência financeira" />
        <DailyAnalysis summary={summary} />
        <DecisionEngine />
        <WeeklyRanking />
        <LostProfitCard />
        <InsightsPanel />
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  SECTION 4 — META
          ╚══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHeader emoji="🎯" label="Seção 4" title="Metas de ganhos" />

        <DailyGoalCard goalDaily={summary.goalDaily ?? 0} earningsToday={summary.earningsToday ?? 0} />

        {/* Weekly + Monthly goal bars */}
        {(summary.goalWeekly > 0 || summary.goalMonthly > 0) && (
          <div style={{ ...T.card, padding: T.cardPad, display: "flex", flexDirection: "column", gap: 20 }}>
            {summary.goalWeekly > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}80` }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.text.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Esta semana</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: T.text.primary, fontVariantNumeric: "tabular-nums" }}>
                      {formatBRL(summary.earningsWeek)}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.green }}>{Math.round(summary.goalWeeklyPct || 0)}%</span>
                </div>
                <ProgressBar pct={summary.goalWeeklyPct || 0} color={T.green} delay={0.2} />
                <p style={{ fontSize: 9, color: T.text.dim, marginTop: 5 }}>Meta: {formatBRL(summary.goalWeekly)}</p>
              </div>
            )}
            {summary.goalMonthly > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.purple, boxShadow: `0 0 6px ${T.purple}80` }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.text.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Este mês</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: T.text.primary, fontVariantNumeric: "tabular-nums" }}>
                      {formatBRL(summary.earningsMonth)}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.purple }}>{Math.round(summary.goalMonthlyPct || 0)}%</span>
                </div>
                <ProgressBar pct={summary.goalMonthlyPct || 0} color={T.purple} delay={0.4} />
                <p style={{ fontSize: 9, color: T.text.dim, marginTop: 5 }}>Meta: {formatBRL(summary.goalMonthly)}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  SECTION 5 — ALERTAS
          ╚══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionHeader emoji="⚡" label="Seção 5" title="Alertas e projeções" />

        {/* Smart alerts */}
        {alerts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.slice(0, 4).map((a, i) => (
              <AlertCard key={a.id} color={a.color} icon={a.icon} title={a.title} text={a.text} delay={i * 0.08} />
            ))}
          </div>
        )}

        {alerts.length === 0 && (
          <div style={{
            ...T.card, padding: T.cardPad,
            display: "flex", alignItems: "center", gap: 12, opacity: 0.5,
          }}>
            <span style={{ fontSize: 20 }}>🔕</span>
            <p style={{ fontSize: 13, color: T.text.muted }}>Nenhum alerta ativo no momento.</p>
          </div>
        )}

        {/* Month summary */}
        <div style={{ ...T.card, padding: T.cardPad }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: T.text.dim, textTransform: "uppercase", marginBottom: 4 }}>Resumo do mês</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: T.text.primary }}>Onde vai seu dinheiro</p>
            </div>
            <div style={{
              background: profitMonthPositive ? "rgba(0,255,136,0.07)" : "rgba(239,68,68,0.07)",
              border: `1px solid ${profitMonthPositive ? "rgba(0,255,136,0.18)" : "rgba(239,68,68,0.18)"}`,
              borderRadius: 10, padding: "6px 12px", textAlign: "right",
            }}>
              <p style={{ fontSize: 9, color: T.text.dim, marginBottom: 2 }}>LUCRO MÊS</p>
              <p style={{ fontSize: 15, fontWeight: 900, color: profitMonthPositive ? T.green : T.red, fontVariantNumeric: "tabular-nums" }}>
                {formatBRL(profitMonth)}
              </p>
            </div>
          </div>

          <div style={{ height: 10, borderRadius: 999, background: "rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", marginBottom: 10 }}>
            <motion.div
              style={{ height: "100%", background: "rgba(239,68,68,0.7)", borderRadius: "999px 0 0 999px" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (summary.costsMonth / (summary.earningsMonth || 1)) * 100)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            />
            <motion.div
              style={{ height: "100%", background: T.green, boxShadow: "0 0 10px rgba(0,255,136,0.5)", borderRadius: "0 999px 999px 0" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, marginMonth)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(239,68,68,0.7)" }} />
              <span style={{ fontSize: 10, color: T.text.muted }}>Gastos {formatBRL(summary.costsMonth)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, boxShadow: `0 0 5px ${T.green}80` }} />
              <span style={{ fontSize: 10, color: T.text.muted }}>Lucro {formatBRL(Math.max(0, profitMonth))}</span>
            </div>
          </div>
        </div>

        {/* Weekly earnings chart */}
        <div style={{ ...T.card, padding: "20px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: T.text.dim, textTransform: "uppercase", marginBottom: 3 }}>Evolução</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: T.text.primary }}>Faturamento da semana</p>
            </div>
            {isFree && (
              <span style={{ fontSize: 9, fontWeight: 800, background: "linear-gradient(135deg, #eab308, #d97706)", color: "#000", padding: "4px 10px", borderRadius: 999, letterSpacing: "0.06em" }}>
                ✦ PRO
              </span>
            )}
          </div>

          <div style={{ height: 130, position: "relative" }}>
            {isFree ? (
              <>
                <div style={{ position: "absolute", inset: 0, filter: "blur(3px)", opacity: 0.2, pointerEvents: "none" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fakeWeekData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                      <defs><linearGradient id="fakeG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.3} /><stop offset="95%" stopColor={T.green} stopOpacity={0} /></linearGradient></defs>
                      <Area type="monotone" dataKey="v" stroke={T.green} strokeWidth={2} fill="url(#fakeG)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                  <Link href="/reports">
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 13, background: "linear-gradient(135deg, #eab308, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(234,179,8,0.35)" }}>
                        <Lock size={17} color="#000" />
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: T.text.primary }}>Desbloqueie com PRO</p>
                    </div>
                  </Link>
                </div>
              </>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fakeWeekData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <defs><linearGradient id="proG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.2} /><stop offset="95%" stopColor={T.green} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#555", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "#161616", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                    itemStyle={{ color: T.green, fontWeight: 700 }}
                    formatter={(v: number) => [formatBRL(v), "Faturamento"]}
                    cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="v" stroke={T.green} strokeWidth={2.5} fill="url(#proG)" dot={false} activeDot={{ r: 5, fill: T.green, stroke: "#000", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  PRO UPSELL + IMPORT CTA
          ╚══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isFree && (
          <Link href="/upgrade">
            <motion.div whileTap={{ scale: 0.98 }} style={{ position: "relative", borderRadius: 22, overflow: "hidden", cursor: "pointer" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(234,179,8,0.12), rgba(217,119,6,0.06))" }} />
              <div style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, background: "rgba(234,179,8,0.12)", borderRadius: "50%", filter: "blur(40px)" }} />
              <div style={{ position: "relative", zIndex: 2, padding: 16, border: "1px solid rgba(234,179,8,0.18)", borderRadius: 22, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, flexShrink: 0, background: "linear-gradient(135deg, #eab308, #d97706)", borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(234,179,8,0.3)" }}>
                  <Lock size={20} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: T.text.primary, marginBottom: 3 }}>Ative o PRO ✦</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>Relatórios, simulador e histórico completo.</p>
                </div>
                <ChevronRight size={17} color="rgba(234,179,8,0.7)" style={{ flexShrink: 0 }} />
              </div>
            </motion.div>
          </Link>
        )}

        <Link href="/import">
          <motion.div whileTap={{ scale: 0.97 }} style={{ position: "relative", borderRadius: 22, overflow: "hidden", cursor: "pointer" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,204,106,0.05))" }} />
            <div style={{ position: "relative", zIndex: 2, padding: 16, border: "1px solid rgba(0,255,136,0.14)", borderRadius: 22, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, flexShrink: 0, background: "linear-gradient(135deg, #00ff88, #00cc6a)", borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,255,136,0.28)" }}>
                <Camera size={20} color="#000" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: T.text.primary, marginBottom: 3 }}>Importar resultados do dia</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>Tire um print e registre em 10 segundos</p>
              </div>
              <ChevronRight size={17} color="rgba(0,255,136,0.6)" style={{ flexShrink: 0 }} />
            </div>
          </motion.div>
        </Link>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════════
          ║  FLOATING ACTION BUTTON
          ╚══════════════════════════════════════════════════════════════════════ */}
      <Link href="/rides">
        <motion.div
          style={{ position: "fixed", bottom: 88, right: 20, zIndex: 40 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, type: "spring", damping: 14, stiffness: 220 }}
          whileTap={{ scale: 0.92 }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: T.green, color: "#000",
            fontWeight: 800, fontSize: 13,
            paddingLeft: 18, paddingRight: 20, height: 50, borderRadius: 999,
            boxShadow: "0 8px 32px rgba(0,255,136,0.42)",
          }}>
            <Plus size={18} strokeWidth={2.5} />
            <span>Nova corrida</span>
          </div>
        </motion.div>
      </Link>

    </motion.div>
  );
}
