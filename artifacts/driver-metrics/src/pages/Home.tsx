import { useState, useEffect, useRef } from "react";
import { useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { formatBRL } from "@/lib/utils";
import { Card } from "@/components/ui";
import {
  TrendingUp, Car, MapPin, AlertCircle, Target, Award,
  Zap, Lock, Plus, ChevronRight, Camera
} from "lucide-react";
import { motion, animate } from "framer-motion";
import { Link } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

// Animated number counter
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    const controls = animate(from, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value]);

  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(display);

  return <span>{prefix}{suffix ? `${formatted}${suffix}` : formatted}</span>;
}

// Circular progress ring
function RingProgress({ pct, color, size = 96, stroke = 8 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, pct) / 100) * circ;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

// Fake weekly chart data for FREE blurred version
const fakeWeekData = [
  { day: "Seg", v: 180 }, { day: "Ter", v: 240 }, { day: "Qua", v: 160 },
  { day: "Qui", v: 310 }, { day: "Sex", v: 280 }, { day: "Sáb", v: 390 }, { day: "Dom", v: 210 },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.5 } },
};

const platformMeta: Record<string, { label: string; pronoun: string }> = {
  uber: { label: "Uber", pronoun: "nele" },
  "99": { label: "99", pronoun: "nela" },
  indriver: { label: "InDrive", pronoun: "nele" },
  outro: { label: "Outro", pronoun: "nele" },
};

// ─── DAILY ANALYSIS CARD ───────────────────────────────────────────────────
function DailyAnalysisCard({ summary }: { summary: any }) {
  if (!summary) return null;

  const {
    earningsToday, costsToday, realProfitToday,
    ridesCountToday, earningsPerRideToday, avgPerRide,
  } = summary;

  if (!earningsToday || earningsToday <= 0) return null;

  const profitMarginPct = earningsToday > 0 ? (realProfitToday / earningsToday) * 100 : 0;
  const costRatioPct    = earningsToday > 0 ? (costsToday / earningsToday) * 100 : 0;

  type Status = "great" | "good" | "weak" | "negative";
  let status: Status;
  if (realProfitToday <= 0)         status = "negative";
  else if (profitMarginPct >= 50)   status = "great";
  else if (profitMarginPct >= 25)   status = "good";
  else                              status = "weak";

  const cfg = {
    great: {
      label: "Ótimo dia! 🔥",
      color: "#00ff88",
      bg: "from-emerald-500/15",
      border: "border-emerald-500/30",
      message: "Excelente performance! Você manteve uma ótima margem de lucro hoje.",
      suggestions: [
        "Replique a estratégia de hoje amanhã",
        "Seus custos estão controlados — continue assim",
        "Registre o que funcionou para repetir",
      ],
    },
    good: {
      label: "Bom dia 👍",
      color: "#4ade80",
      bg: "from-green-500/10",
      border: "border-green-500/20",
      message: "Dia consistente. Você lucrou de forma sólida com os ganhos de hoje.",
      suggestions: [
        "Trabalhe nos horários de pico para aumentar ainda mais",
        "Prefira corridas mais longas quando possível",
        "Analise quais horas renderam mais hoje",
      ],
    },
    weak: {
      label: "Dia fraco ⚠️",
      color: "#eab308",
      bg: "from-yellow-500/10",
      border: "border-yellow-500/20",
      message: "Você trabalhou, mas o lucro foi baixo. Vale rever seus custos e horários.",
      suggestions: [
        "Foque nos horários de maior demanda",
        "Evite corridas curtas de baixo valor",
        "Controle os gastos com combustível",
      ],
    },
    negative: {
      label: "Dia no prejuízo ❌",
      color: "#ef4444",
      bg: "from-red-500/10",
      border: "border-red-500/20",
      message: "Você trabalhou mas não lucrou hoje. Seus custos superaram os ganhos.",
      suggestions: [
        "Reduza seus custos fixos com urgência",
        "Evite trabalhar em horários de baixa demanda",
        "Priorize regiões e horários com mais corridas",
      ],
    },
  }[status];

  const insights: string[] = [];
  if (costRatioPct > 40 && costsToday > 0)
    insights.push(`Custos representaram ${Math.round(costRatioPct)}% dos seus ganhos hoje — acima do ideal de 40%.`);
  if (avgPerRide > 0 && earningsPerRideToday > 0 && earningsPerRideToday < avgPerRide * 0.8)
    insights.push(`Corridas renderam ${formatBRL(earningsPerRideToday)} cada — abaixo da sua média de ${formatBRL(avgPerRide)}.`);
  if (ridesCountToday > 0 && realProfitToday > 0)
    insights.push(`Lucro médio por corrida hoje: ${formatBRL(realProfitToday / ridesCountToday)}.`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-3xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} to-transparent p-5 space-y-4`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/40 mb-1">Análise do dia</p>
          <p className="text-xl font-display font-extrabold text-white">{cfg.label}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-white/40 font-medium mb-1">Lucro hoje</p>
          <p className="text-2xl font-display font-extrabold tabular-nums" style={{ color: cfg.color }}>
            {formatBRL(realProfitToday)}
          </p>
        </div>
      </div>

      {/* Profit margin bar */}
      <div>
        <div className="flex justify-between text-[10px] text-white/40 font-bold mb-1.5">
          <span>Ganhos: {formatBRL(earningsToday)}</span>
          <span>Custos: {formatBRL(costsToday)}</span>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: cfg.color, boxShadow: `0 0 10px ${cfg.color}50` }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, Math.min(100, Math.abs(profitMarginPct)))}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
        <p className="text-[10px] text-white/30 mt-1 font-medium">
          {realProfitToday > 0
            ? `${Math.round(profitMarginPct)}% de margem de lucro`
            : "Margem negativa — gastos acima dos ganhos"}
        </p>
      </div>

      {/* Main message */}
      <div className="rounded-2xl bg-black/20 px-4 py-3">
        <p className="text-sm text-white/70 leading-relaxed">{cfg.message}</p>
      </div>

      {/* Secondary insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight) => (
            <div key={insight} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: cfg.color }} />
              <p className="text-xs text-white/50 leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/30 mb-2.5">💡 Como melhorar</p>
        <div className="space-y-2">
          {cfg.suggestions.map((s, i) => (
            <div key={s} className="flex items-start gap-2.5 bg-white/[0.03] rounded-xl px-3 py-2.5">
              <span className="text-xs font-extrabold shrink-0" style={{ color: cfg.color }}>{i + 1}.</span>
              <p className="text-xs text-white/60 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: user } = useGetMe();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Carregando seu painel...</p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const currentHour = new Date().getHours();
  const isAfterNoon = currentHour >= 12;
  const isFree = user?.plan !== "pro";

  const pctToday = Math.min(100, summary.goalDailyPct || 0);
  const isProfitPositive = (summary.realProfitToday ?? summary.realProfitMonth) >= 0;
  const isProfitMonthPositive = summary.realProfitMonth >= 0;
  const profitMargin = summary.earningsMonth > 0
    ? (summary.realProfitMonth / summary.earningsMonth) * 100
    : 0;

  // Goal ring color
  let ringColor = "#00ff88";
  if (isAfterNoon && pctToday < 40) ringColor = "#ef4444";
  else if (isAfterNoon && pctToday < 80) ringColor = "#eab308";

  // Insights
  const alerts: { id: string; icon: React.ReactNode; border: string; bg: string; title: string; text: string }[] = [];

  if (pctToday < 100 && summary.goalDailyPct > 0) {
    const dailyGoal = summary.earningsToday / (pctToday / 100);
    const remaining = dailyGoal - summary.earningsToday;
    if (remaining > 0 && isFinite(remaining)) {
      const almostThere = pctToday >= 80;
      alerts.push({
        id: "meta",
        icon: <Zap size={16} />,
        border: "border-yellow-500/60",
        bg: "from-yellow-500/10",
        title: almostThere ? "Quase lá! 🎯" : "Abaixo da meta hoje",
        text: almostThere
          ? `Faltam apenas ${formatBRL(remaining)} para bater sua meta diária.`
          : `Você ainda precisa de ${formatBRL(remaining)} para atingir sua meta.`,
      });
    }
  }

  if (summary.avgPerKm > 0 && summary.avgPerKm < 1.5) {
    alerts.push({
      id: "rentabilidade",
      icon: <AlertCircle size={16} />,
      border: "border-red-500/60",
      bg: "from-red-500/10",
      title: "Rentabilidade baixa ⚠️",
      text: `Você está ganhando ${formatBRL(summary.avgPerKm)}/km, abaixo do ideal. Priorize corridas mais longas.`,
    });
  }

  if (summary.bestPlatform && summary.bestPlatform !== "-") {
    const meta = platformMeta[summary.bestPlatform] ?? { label: summary.bestPlatform, pronoun: "nele" };
    alerts.push({
      id: "destaque",
      icon: <Award size={16} />,
      border: "border-primary/60",
      bg: "from-primary/10",
      title: `${meta.label} em destaque 🏆`,
      text: `O ${meta.label} está rendendo mais agora. Concentre-se ${meta.pronoun}.`,
    });
  }

  const remainingDays = 30 - new Date().getDate();
  const projectedEarnings = summary.earningsMonth + summary.earningsToday * remainingDays;
  if (projectedEarnings > summary.earningsMonth && summary.earningsToday > 0) {
    alerts.push({
      id: "projecao",
      icon: <TrendingUp size={16} />,
      border: "border-blue-500/60",
      bg: "from-blue-500/10",
      title: "Projeção do mês 📈",
      text: `No ritmo de hoje, você vai faturar ${formatBRL(projectedEarnings)} até o fim do mês.`,
    });
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 pb-28">

      {/* ─── HERO HEADLINE ─── */}
      <motion.div variants={item} className="text-center pt-2 pb-1">
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white leading-tight tracking-tight">
          Faturamento engana.
        </h1>
        <p className="text-sm text-white/40 mt-2 font-medium">
          Descubra quanto realmente sobra no seu bolso.
        </p>
      </motion.div>

      {/* ─── HERO: PROFIT CARD ─── */}
      <motion.div variants={item}>
        <div className="relative rounded-3xl overflow-hidden">
          {/* Green glow background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#003322] via-[#001a11] to-[#0a0a0a]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4" />

          <div className="relative z-10 p-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 text-primary rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Lucro real hoje
            </div>

            {/* Big profit number */}
            <div className="mb-2">
              <div className={`text-6xl md:text-7xl font-display font-extrabold tracking-tight tabular-nums leading-none ${isProfitPositive ? "text-primary drop-shadow-[0_0_24px_rgba(0,255,136,0.4)]" : "text-red-400"}`}>
                <AnimatedNumber value={summary.realProfitToday ?? summary.realProfitMonth} />
              </div>
            </div>

            {/* Revenue comparison sentence */}
            <p className="text-sm text-white/60 font-medium mt-3 leading-relaxed">
              Você faturou{" "}
              <span className="text-white font-bold">{formatBRL(summary.earningsToday)}</span>
              {" "}hoje, mas seu lucro real é{" "}
              <span className={`font-bold ${isProfitPositive ? "text-primary" : "text-red-400"}`}>
                {formatBRL(summary.realProfitToday ?? (summary.earningsToday - (summary.costsMonth / 30)))}
              </span>
            </p>

            {/* Goal progress ring + bar */}
            {summary.goalDailyPct > 0 && (
              <div className="mt-6 flex items-center gap-5">
                <div className="relative shrink-0">
                  <RingProgress pct={pctToday} color={ringColor} size={72} stroke={7} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-display font-extrabold" style={{ color: ringColor }}>
                      {Math.round(pctToday)}%
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/50 font-medium mb-1.5">Sua meta diária de ganhos</p>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: ringColor, boxShadow: `0 0 12px ${ringColor}60` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pctToday}%` }}
                      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mt-1.5 font-medium">
                    {pctToday >= 100
                      ? "✓ Meta batida! Parabéns!"
                      : pctToday >= 80
                      ? "Quase lá — continue rodando!"
                      : isAfterNoon && pctToday < 50
                      ? "Você está abaixo da média hoje"
                      : "Continue, você está indo bem!"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── DAILY ANALYSIS ─── */}
      <motion.div variants={item}>
        <DailyAnalysisCard summary={summary} />
      </motion.div>

      {/* ─── REVENUE + MONTH PROFIT ─── */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        {/* Revenue today */}
        <Card className="p-5 bg-white/[0.03] border-white/[0.05]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Faturamento hoje</p>
          <p className="text-2xl font-display font-bold tabular-nums text-white">
            {formatBRL(summary.earningsToday)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Car size={12} className="text-white/30" />
            <p className="text-[11px] text-white/40 font-medium">{summary.totalRides} corridas</p>
          </div>
        </Card>

        {/* Month profit */}
        <Card className={`p-5 border ${isProfitMonthPositive ? "border-primary/20 bg-primary/5" : "border-red-500/20 bg-red-500/5"}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Lucro do mês</p>
          <p className={`text-2xl font-display font-bold tabular-nums ${isProfitMonthPositive ? "text-primary" : "text-red-400"}`}>
            {formatBRL(summary.realProfitMonth)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Target size={12} className={isProfitMonthPositive ? "text-primary/50" : "text-red-400/50"} />
            <p className="text-[11px] text-white/40 font-medium">{Math.max(0, Math.round(profitMargin))}% de margem</p>
          </div>
        </Card>
      </motion.div>

      {/* ─── MONTH BREAKDOWN BAR ─── */}
      <motion.div variants={item}>
        <Card className="p-5 bg-white/[0.02] border-white/[0.04]">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold text-white">Onde vai seu dinheiro</p>
            <p className="text-xs text-white/40 font-medium">Este mês</p>
          </div>
          <div className="h-3 bg-black/60 rounded-full overflow-hidden flex gap-px mb-3">
            <motion.div
              className="h-full bg-red-500/80 rounded-l-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (summary.costsMonth / (summary.earningsMonth || 1)) * 100)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            />
            <motion.div
              className="h-full bg-primary rounded-r-full"
              style={{ boxShadow: "0 0 8px rgba(0,255,136,0.4)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, profitMargin)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500/80 inline-block" />
              Gastos {formatBRL(summary.costsMonth)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              Lucro {formatBRL(Math.max(0, summary.realProfitMonth))}
            </span>
          </div>
        </Card>
      </motion.div>

      {/* ─── STATS ROW ─── */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <Card className="p-4 bg-white/[0.02] border-white/[0.04] text-center">
          <MapPin size={16} className="text-primary mx-auto mb-2" />
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mb-1">Por km</p>
          <p className="text-base font-display font-bold tabular-nums">{formatBRL(summary.avgPerKm)}</p>
        </Card>
        <Card className="p-4 bg-white/[0.02] border-white/[0.04] text-center">
          <TrendingUp size={16} className="text-primary mx-auto mb-2" />
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mb-1">Por corrida</p>
          <p className="text-base font-display font-bold tabular-nums">{formatBRL(summary.avgPerRide)}</p>
        </Card>
        <Card className="p-4 bg-white/[0.02] border-white/[0.04] text-center">
          <Award size={16} className="text-yellow-500 mx-auto mb-2" />
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mb-1">Melhor plat.</p>
          <p className="text-base font-display font-bold">
            {summary.bestPlatform ? (platformMeta[summary.bestPlatform]?.label ?? summary.bestPlatform) : "—"}
          </p>
        </Card>
      </motion.div>

      {/* ─── WEEKLY CHART ─── */}
      <motion.div variants={item}>
        <Card className="p-5 bg-white/[0.02] border-white/[0.04] relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-white">Evolução da semana</p>
              <p className="text-[11px] text-white/40 mt-0.5">Faturamento dos últimos 7 dias</p>
            </div>
            {isFree && (
              <span className="text-[10px] font-extrabold bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-2.5 py-1 rounded-full tracking-wider">
                ✦ PRO
              </span>
            )}
          </div>

          <div className="h-[140px] w-full relative">
            {isFree && (
              <>
                {/* Blurred fake chart */}
                <div className="absolute inset-0 blur-[3px] opacity-30 pointer-events-none select-none">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fakeWeekData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fakeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="#00ff88" strokeWidth={2} fill="url(#fakeGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Lock overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <Link href="/reports">
                    <div className="flex flex-col items-center gap-2 cursor-pointer group">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/30 group-hover:scale-105 transition-transform">
                        <Lock size={18} className="text-black" />
                      </div>
                      <p className="text-xs font-bold text-white">Desbloqueie com PRO</p>
                      <p className="text-[10px] text-white/50">Ver histórico completo</p>
                    </div>
                  </Link>
                </div>
              </>
            )}

            {!isFree && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fakeWeekData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="proGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#737373", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                    itemStyle={{ color: "#00ff88", fontWeight: 700 }}
                    formatter={(v: number) => [formatBRL(v), "Faturamento"]}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="v" stroke="#00ff88" strokeWidth={2.5} fill="url(#proGrad)" dot={false} activeDot={{ r: 5, fill: "#00ff88", stroke: "#000", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </motion.div>

      {/* ─── ALERTS ─── */}
      {alerts.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Alertas inteligentes</p>
          {alerts.slice(0, 3).map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-start gap-3 p-4 rounded-2xl border ${alert.border} bg-gradient-to-r ${alert.bg} to-transparent`}
            >
              <div className="mt-0.5 text-white/60 shrink-0">{alert.icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white mb-0.5">{alert.title}</p>
                <p className="text-xs text-white/50 leading-relaxed">{alert.text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ─── PRO UPGRADE CARD ─── */}
      {isFree && (
        <motion.div variants={item}>
          <Link href="/reports">
            <div className="relative rounded-3xl overflow-hidden cursor-pointer group">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-yellow-600/10 to-transparent" />
              <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
              <div className="relative z-10 p-5 border border-yellow-500/20 rounded-3xl flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-xl shadow-yellow-500/30 shrink-0">
                  <Lock size={24} className="text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-white mb-1">Desbloqueie seu lucro real ✦</p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Descubra quanto realmente sobra no seu bolso após todos os custos.
                  </p>
                </div>
                <ChevronRight size={20} className="text-yellow-500 shrink-0 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* ─── IMPORT BUTTON ─── */}
      <motion.div variants={item}>
        <Link href="/import">
          <motion.div
            whileTap={{ scale: 0.97 }}
            className="relative rounded-3xl overflow-hidden cursor-pointer group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="relative z-10 p-5 border border-primary/20 rounded-3xl flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-emerald-500 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 shrink-0">
                <Camera size={24} className="text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white mb-1">Importar resultados do dia</p>
                <p className="text-xs text-white/50 leading-relaxed">
                  Tire uma screenshot e registre seus ganhos em 10 segundos
                </p>
              </div>
              <ChevronRight size={20} className="text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* ─── GOAL PROGRESS ─── */}
      <motion.div variants={item}>
        <Card className="p-5 bg-white/[0.02] border-white/[0.04]">
          <p className="text-sm font-bold text-white mb-5">Suas metas de ganhos</p>

          <div className="space-y-5">
            {/* Weekly */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <div>
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wide">Esta semana</span>
                  <span className="text-sm font-display font-bold text-white ml-2">{formatBRL(summary.earningsWeek)}</span>
                </div>
                <span className="text-sm font-bold text-primary">{Math.round(summary.goalWeeklyPct || 0)}%</span>
              </div>
              <div className="h-2.5 bg-black/60 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full"
                  style={{ boxShadow: "0 0 8px rgba(0,255,136,0.3)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, summary.goalWeeklyPct || 0)}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                />
              </div>
            </div>

            {/* Monthly */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <div>
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wide">Este mês</span>
                  <span className="text-sm font-display font-bold text-white ml-2">{formatBRL(summary.earningsMonth)}</span>
                </div>
                <span className="text-sm font-bold text-primary">{Math.round(summary.goalMonthlyPct || 0)}%</span>
              </div>
              <div className="h-2.5 bg-black/60 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full"
                  style={{ boxShadow: "0 0 8px rgba(0,255,136,0.3)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, summary.goalMonthlyPct || 0)}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── FLOATING ACTION BUTTON ─── */}
      <Link href="/rides">
        <motion.div
          className="fixed bottom-24 right-5 z-40 md:bottom-6 md:right-6"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, type: "spring", damping: 15, stiffness: 200 }}
          whileTap={{ scale: 0.92 }}
        >
          <div className="flex items-center gap-2.5 bg-primary text-black font-bold text-sm pl-4 pr-5 h-14 rounded-full shadow-2xl shadow-primary/40 glow-primary hover:bg-primary/90 transition-colors">
            <Plus size={20} strokeWidth={2.5} />
            <span>Nova corrida</span>
          </div>
        </motion.div>
      </Link>

    </motion.div>
  );
}
