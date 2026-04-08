import { motion } from "framer-motion";
import { useWeeklyPerformance, type PerformanceDay } from "@/hooks/useWeeklyPerformance";
import { formatBRL } from "@/lib/utils";

// ─── COMPUTATION ──────────────────────────────────────────────────────────────
type Metric = "hourly" | "perTrip";

interface RatedDay extends PerformanceDay {
  rate: number; // R$/hora or R$/corrida depending on metric
}

interface Analysis {
  metric: Metric;
  best: RatedDay;
  worst: RatedDay;
  rateGap: number;
  gapPercent: number;        // worst as % of best (0–100)
  totalLost: number;         // sum of (bestRate - dayRate) * dayHours across all days
  daysAnalyzed: number;
}

function analyze(days: PerformanceDay[]): Analysis | null {
  // Prefer hourly rate if hours are tracked
  const withHours = days.filter(
    (d) => d.earnings > 0 && d.hours !== null && d.hours > 0,
  );
  const withTrips = days.filter((d) => d.earnings > 0 && d.trips > 0);

  if (withHours.length >= 2) {
    const rated: RatedDay[] = withHours.map((d) => ({
      ...d,
      rate: d.earnings / d.hours!,
    }));
    const best = rated.reduce((a, b) => (b.rate > a.rate ? b : a));
    const worst = rated.reduce((a, b) => (b.rate < a.rate ? b : a));
    const rateGap = best.rate - worst.rate;
    const gapPercent = best.rate > 0 ? (worst.rate / best.rate) * 100 : 0;
    const totalLost = rated.reduce(
      (sum, d) => sum + Math.max(0, (best.rate - d.rate) * d.hours!),
      0,
    );
    return {
      metric: "hourly",
      best,
      worst,
      rateGap,
      gapPercent,
      totalLost,
      daysAnalyzed: rated.length,
    };
  }

  if (withTrips.length >= 2) {
    const rated: RatedDay[] = withTrips.map((d) => ({
      ...d,
      rate: d.earnings / d.trips,
    }));
    const best = rated.reduce((a, b) => (b.rate > a.rate ? b : a));
    const worst = rated.reduce((a, b) => (b.rate < a.rate ? b : a));
    const rateGap = best.rate - worst.rate;
    const gapPercent = best.rate > 0 ? (worst.rate / best.rate) * 100 : 0;
    const totalLost = rated.reduce(
      (sum, d) => sum + Math.max(0, (best.rate - d.rate) * d.trips),
      0,
    );
    return {
      metric: "perTrip",
      best,
      worst,
      rateGap,
      gapPercent,
      totalLost,
      daysAnalyzed: rated.length,
    };
  }

  return null;
}

// ─── EMPTY / NO DATA ─────────────────────────────────────────────────────────
function EmptyState({ reason }: { reason: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 24, padding: "24px 20px", textAlign: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, margin: "0 auto 14px",
        background: "rgba(255,165,0,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
      }}>💸</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
        Estimativa de lucro perdido
      </p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.55 }}>
        {reason}
      </p>
    </div>
  );
}

// ─── PERIOD CARD ─────────────────────────────────────────────────────────────
function PeriodCard({
  day, rate, metric, variant,
}: {
  day: RatedDay;
  rate: number;
  metric: Metric;
  variant: "best" | "worst";
}) {
  const isBest = variant === "best";
  const color = isBest ? "#00ff88" : "#ef4444";
  const bg = isBest ? "rgba(0,255,136,0.06)" : "rgba(239,68,68,0.06)";
  const border = isBest ? "rgba(0,255,136,0.18)" : "rgba(239,68,68,0.15)";
  const label = isBest ? "Melhor período" : "Pior período";
  const emoji = isBest ? "🏆" : "📉";

  return (
    <div style={{
      flex: 1, background: bg, border: `1px solid ${border}`,
      borderRadius: 16, padding: "14px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <p style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {label}
        </p>
      </div>

      {/* Day name */}
      <p style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb", marginBottom: 4 }}>
        {day.label}
      </p>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
        {day.dayFull}
      </p>

      {/* Rate */}
      <div style={{
        background: `${color}12`, borderRadius: 10, padding: "8px 10px", marginBottom: 8,
      }}>
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: 2 }}>
          {metric === "hourly" ? "R$/hora" : "R$/corrida"}
        </p>
        <p style={{ fontSize: 18, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
          {formatBRL(rate)}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {day.hours !== null && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            ⏱ {day.hours.toFixed(1)}h trabalhadas
          </p>
        )}
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          🚗 {day.trips} corridas
        </p>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          💰 {formatBRL(day.earnings)} ganhos
        </p>
      </div>
    </div>
  );
}

// ─── RATE COMPARISON BAR ─────────────────────────────────────────────────────
function RateComparisonBar({ best, worst }: { best: number; worst: number }) {
  const worstPct = best > 0 ? (worst / best) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Eficiência comparada
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#eab308" }}>
          {Math.round(worstPct)}% do melhor
        </span>
      </div>

      {/* Track */}
      <div style={{ height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden", position: "relative" }}>
        {/* Best — full width, green */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, rgba(0,255,136,0.12), rgba(0,255,136,0.04))",
          borderRadius: 999,
        }} />
        {/* Worst — partial, red fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${worstPct}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute", top: 0, left: 0, bottom: 0,
            background: "linear-gradient(90deg, #ef4444, #f97316)",
            borderRadius: 999,
            boxShadow: "0 0 8px rgba(239,68,68,0.4)",
          }}
        />
        {/* Best marker line */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 2,
          background: "#00ff88", opacity: 0.6,
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>
          {formatBRL(worst)}/h — pior
        </span>
        <span style={{ fontSize: 9, color: "#00ff88", fontWeight: 700 }}>
          {formatBRL(best)}/h — melhor
        </span>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function LostProfitCard() {
  const { data, isLoading } = useWeeklyPerformance();

  if (isLoading) {
    return (
      <div style={{
        height: 120, borderRadius: 24,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        animation: "pulse 1.5s infinite",
      }} />
    );
  }

  const days = data?.days ?? [];

  if (days.length === 0) {
    return <EmptyState reason="Importe seus resumos diários para ver quanto lucro pode estar perdendo." />;
  }

  const result = analyze(days);

  if (!result) {
    const needHours = days.filter((d) => d.earnings > 0).every((d) => !d.hours);
    return (
      <EmptyState
        reason={
          needHours
            ? "Registre as horas trabalhadas nos seus resumos para ativar a análise de eficiência."
            : "Importe pelo menos 2 dias com ganhos para comparar os períodos."
        }
      />
    );
  }

  const { metric, best, worst, rateGap, gapPercent, totalLost, daysAnalyzed } = result;
  const metricLabel = metric === "hourly" ? "por hora" : "por corrida";

  // Severity color of the lost profit
  const lostColor = totalLost > 200 ? "#ef4444" : totalLost > 80 ? "#f97316" : "#eab308";

  // Smart message
  const bestPeriodName = best.isToday ? "hoje" : best.isYesterday ? "ontem" : best.dayFull.toLowerCase();
  const message =
    totalLost < 5
      ? `Sua performance foi consistente esta semana. Continue assim!`
      : `Você poderia ter ganho ${formatBRL(totalLost)} a mais trabalhando com a eficiência do seu melhor dia (${bestPeriodName}).`;

  const sub =
    metric === "hourly"
      ? `Priorize ${best.dayFull} — sua taxa de ${formatBRL(best.rate)}/hora é ${Math.round(100 - gapPercent)}% maior que no pior dia.`
      : `Suas corridas em ${best.dayFull} rendem ${Math.round(100 - gapPercent)}% mais por corrida que no dia menos eficiente.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(255,165,0,0.03)",
        border: "1px solid rgba(255,165,0,0.1)",
        borderRadius: 24, padding: "20px 16px 18px",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: -50, right: -30,
        width: 200, height: 140,
        background: "radial-gradient(ellipse, rgba(239,68,68,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>💸</div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
              Oportunidade perdida
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>Estimativa de lucro perdido</p>
          </div>
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)",
          background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "4px 10px",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {daysAnalyzed} dias {metricLabel}
        </div>
      </div>

      {/* ── Best vs Worst cards ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <PeriodCard day={best}  rate={best.rate}  metric={metric} variant="best"  />
        <PeriodCard day={worst} rate={worst.rate} metric={metric} variant="worst" />
      </div>

      {/* ── Rate comparison bar (hourly only) ── */}
      {metric === "hourly" && (
        <div style={{ marginBottom: 16 }}>
          <RateComparisonBar best={best.rate} worst={worst.rate} />
        </div>
      )}

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 16 }} />

      {/* ── Lost profit highlight ── */}
      {totalLost >= 5 && (
        <div style={{
          textAlign: "center", marginBottom: 16,
          background: `${lostColor}08`,
          border: `1px solid ${lostColor}20`,
          borderRadius: 16, padding: "14px 16px",
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            Lucro não realizado esta semana
          </p>
          <motion.p
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 38, fontWeight: 900, color: lostColor,
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
              textShadow: `0 0 24px ${lostColor}50`,
            }}
          >
            {formatBRL(totalLost)}
          </motion.p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
            diferença acumulada entre seu melhor e pior período
          </p>
        </div>
      )}

      {/* ── Gap stat ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, marginBottom: 16,
        background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "10px 14px",
      }}>
        <span style={{ fontSize: 12 }}>📏</span>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          Diferença de{" "}
          <span style={{ fontWeight: 800, color: "#f97316" }}>
            {formatBRL(rateGap)}/{metric === "hourly" ? "hora" : "corrida"}
          </span>{" "}
          entre melhor e pior período
        </p>
      </div>

      {/* ── Message ── */}
      <div style={{
        background: "rgba(239,68,68,0.05)",
        border: "1px solid rgba(239,68,68,0.12)",
        borderRadius: 14, padding: "12px 14px",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", lineHeight: 1.45, marginBottom: 4 }}>
            {message}
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            {sub}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
