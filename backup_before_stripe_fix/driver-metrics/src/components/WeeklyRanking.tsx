import { motion } from "framer-motion";
import { useWeeklyPerformance, type PerformanceDay } from "@/hooks/useWeeklyPerformance";
import { formatBRL } from "@/lib/utils";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function profitColor(profit: number, max: number): string {
  if (max <= 0) return "rgba(255,255,255,0.15)";
  const ratio = profit / max;
  if (ratio >= 0.85) return "#00ff88";
  if (ratio >= 0.60) return "#22c55e";
  if (ratio >= 0.35) return "#eab308";
  if (ratio >= 0.10) return "#f97316";
  return "#ef4444";
}

function bestDayMessage(best: PerformanceDay | null): string {
  if (!best) return "Importe mais dias para ver seu ranking semanal.";
  if (best.isToday) return "Hoje está sendo seu melhor dia da semana! 🏆";
  if (best.isYesterday) return "Ontem foi seu melhor dia da semana. Ótimo!";
  return `${best.dayFull} foi seu melhor dia da semana. 🏆`;
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 24, padding: "24px 20px", textAlign: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, margin: "0 auto 14px",
        background: "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
      }}>📊</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
        Ranking semanal
      </p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
        Importe pelo menos 2 dias para ver seu ranking e comparar performance.
      </p>
    </div>
  );
}

// ─── DAY BAR ROW ─────────────────────────────────────────────────────────────
function DayBar({
  day, maxProfit, isBest, isWorst, index,
}: {
  day: PerformanceDay;
  maxProfit: number;
  isBest: boolean;
  isWorst: boolean;
  index: number;
}) {
  const barPct = maxProfit > 0 ? Math.max(0, (day.profit / maxProfit) * 100) : 0;
  const color = profitColor(day.profit, maxProfit);
  const hasData = day.earnings > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 14,
        background: isBest
          ? "rgba(0,255,136,0.05)"
          : day.isToday
            ? "rgba(255,255,255,0.04)"
            : "transparent",
        border: isBest
          ? "1px solid rgba(0,255,136,0.15)"
          : day.isToday
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid transparent",
      }}
    >
      {/* Rank badge / medal */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isBest
          ? "rgba(0,255,136,0.15)"
          : isWorst && hasData
            ? "rgba(239,68,68,0.1)"
            : "rgba(255,255,255,0.04)",
        fontSize: isBest || (isWorst && hasData) ? 14 : 11,
        fontWeight: 700,
        color: isBest ? "#00ff88" : isWorst && hasData ? "#ef4444" : "rgba(255,255,255,0.25)",
      }}>
        {isBest ? "🏆" : isWorst && hasData ? "📉" : day.label.substring(0, 3)}
      </div>

      {/* Day label */}
      <div style={{ width: 42, flexShrink: 0 }}>
        <p style={{
          fontSize: 11, fontWeight: 700,
          color: day.isToday ? "#f9fafb" : "rgba(255,255,255,0.55)",
        }}>
          {day.label}
        </p>
        {day.isToday && (
          <p style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>
            HOJE
          </p>
        )}
      </div>

      {/* Bar track */}
      <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden" }}>
        {hasData ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barPct}%` }}
            transition={{ delay: 0.3 + index * 0.06, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height: "100%", background: color, borderRadius: 999,
              boxShadow: isBest ? `0 0 8px ${color}60` : "none",
            }}
          />
        ) : (
          <div style={{ height: "100%", borderRadius: 999, background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 4px, transparent 4px, transparent 8px)" }} />
        )}
      </div>

      {/* Profit value */}
      <div style={{ width: 66, textAlign: "right", flexShrink: 0 }}>
        {hasData ? (
          <>
            <p style={{ fontSize: 12, fontWeight: 800, color: day.profit >= 0 ? color : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
              {formatBRL(day.profit)}
            </p>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
              {day.trips} corridas
            </p>
          </>
        ) : (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontStyle: "italic" }}>
            sem dados
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── SUMMARY PILL ─────────────────────────────────────────────────────────────
function SummaryPill({ emoji, label, value, color }: {
  emoji: string; label: string; value: string; color: string;
}) {
  return (
    <div style={{
      flex: 1, textAlign: "center", padding: "10px 6px",
      background: "rgba(0,0,0,0.3)", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.05)",
    }}>
      <p style={{ fontSize: 14, marginBottom: 3 }}>{emoji}</p>
      <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function WeeklyRanking() {
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

  const activeDays = data?.days?.filter((d) => d.earnings > 0) ?? [];
  if (!data || activeDays.length < 1) return <EmptyState />;

  const { days, bestDay, worstDay, avgProfit, totalProfit } = data;
  const maxProfit = Math.max(...days.filter((d) => d.earnings > 0).map((d) => d.profit), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 24, padding: "20px 16px 16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>🏅</div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
              Últimos 7 dias
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>Ranking semanal</p>
          </div>
        </div>
        {activeDays.length > 0 && (
          <div style={{
            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "4px 10px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            {activeDays.length} dias
          </div>
        )}
      </div>

      {/* Day bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
        {days.map((day, i) => (
          <DayBar
            key={day.date}
            day={day}
            maxProfit={maxProfit}
            isBest={bestDay?.date === day.date}
            isWorst={worstDay?.date === day.date}
            index={i}
          />
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 14 }} />

      {/* Summary pills */}
      {activeDays.length >= 2 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <SummaryPill
            emoji="🏆"
            label="Melhor dia"
            value={bestDay ? formatBRL(bestDay.profit) : "—"}
            color="#00ff88"
          />
          <SummaryPill
            emoji="📉"
            label="Pior dia"
            value={worstDay ? formatBRL(worstDay.profit) : "—"}
            color="#ef4444"
          />
          <SummaryPill
            emoji="⚖️"
            label="Média/dia"
            value={avgProfit != null ? formatBRL(avgProfit) : "—"}
            color="rgba(255,255,255,0.6)"
          />
        </div>
      )}

      {/* Message */}
      <div style={{
        background: "rgba(0,255,136,0.05)",
        border: "1px solid rgba(0,255,136,0.12)",
        borderRadius: 14, padding: "11px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>💬</span>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
          {bestDayMessage(bestDay ?? null)}
          {totalProfit != null && totalProfit > 0 && (
            <span style={{ color: "#00ff88", fontWeight: 700 }}>
              {" "}Lucro total: {formatBRL(totalProfit)}.
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}
