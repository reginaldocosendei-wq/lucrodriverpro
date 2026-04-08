import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export interface WeeklyComparison {
  thisWeekEarnings: number;
  lastWeekEarnings: number;
  delta: number;
  deltaPct: number | null;
  days: Array<{ date: string; earnings: number; label: string; isToday: boolean }>;
  maxDay: number;
}

// ─── DAY BAR ─────────────────────────────────────────────────────────────────
function DayBar({
  day, maxVal, index,
}: {
  day: { date: string; earnings: number; label: string; isToday: boolean };
  maxVal: number;
  index: number;
}) {
  const pct    = maxVal > 0 ? (day.earnings / maxVal) * 100 : 0;
  const active = day.earnings > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      {/* Earnings label */}
      <p style={{
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)",
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
        opacity: active ? 1 : 0,
      }}>
        {day.earnings > 0 ? `${(day.earnings / 1000).toFixed(1)}k` : ""}
      </p>

      {/* Bar column */}
      <div style={{
        width: "100%", height: 80,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}>
        <div style={{
          width: "70%", height: "100%",
          position: "relative", display: "flex", alignItems: "flex-end",
        }}>
          {/* Track */}
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(255,255,255,0.04)", borderRadius: 6,
          }} />
          {/* Fill */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 + index * 0.06 }}
            style={{
              width: "100%", borderRadius: 6, position: "relative", zIndex: 1,
              background: day.isToday
                ? "linear-gradient(180deg, #00ff88, #00cc6a)"
                : active
                  ? "linear-gradient(180deg, #818cf8aa, #818cf855)"
                  : "transparent",
              boxShadow: day.isToday ? "0 0 12px rgba(0,255,136,0.3)" : "none",
            }}
          />
        </div>
      </div>

      {/* Day label */}
      <p style={{
        fontSize: 10, fontWeight: day.isToday ? 800 : 500,
        color: day.isToday ? "#00ff88" : "rgba(255,255,255,0.3)",
        textTransform: "uppercase",
      }}>
        {day.label}
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export function WeeklyChartPanel({ data }: { data: WeeklyComparison | undefined }) {
  if (!data) return null;

  const isUp   = data.delta > 0;
  const isDown = data.delta < 0;
  const hasLastWeek = data.lastWeekEarnings > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
        color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 10,
      }}>
        Últimos 7 dias
      </p>

      <div style={{
        background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "18px 18px 14px",
      }}>

        {/* ── Weekly totals comparison ─────────────────────────────────── */}
        {hasLastWeek && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 16,
          }}>
            <div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>
                Esta semana
              </p>
              <p style={{
                fontSize: 20, fontWeight: 900, color: "#f9fafb",
                fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
              }}>
                {formatBRL(data.thisWeekEarnings)}
              </p>
            </div>

            {/* Delta arrow */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              {isUp
                ? <TrendingUp size={20} color="#00ff88" />
                : isDown
                  ? <TrendingDown size={20} color="#ef4444" />
                  : <span style={{ fontSize: 16, color: "rgba(255,255,255,0.2)" }}>—</span>
              }
              {data.deltaPct !== null && data.deltaPct !== 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: isUp ? "#00ff88" : "#ef4444",
                }}>
                  {isUp ? "+" : ""}{data.deltaPct}%
                </span>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>
                Semana passada
              </p>
              <p style={{
                fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.3)",
                fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
              }}>
                {formatBRL(data.lastWeekEarnings)}
              </p>
            </div>
          </div>
        )}

        {/* ── Bar chart ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
          {data.days.map((day, i) => (
            <DayBar key={day.date} day={day} maxVal={data.maxDay} index={i} />
          ))}
        </div>

        {/* ── Delta banner ──────────────────────────────────────────────── */}
        {hasLastWeek && data.delta !== 0 && (
          <div style={{
            marginTop: 12,
            padding: "8px 12px", borderRadius: 10,
            background: isUp ? "rgba(0,255,136,0.05)" : "rgba(239,68,68,0.05)",
            border: `1px solid ${isUp ? "rgba(0,255,136,0.12)" : "rgba(239,68,68,0.12)"}`,
          }}>
            <p style={{
              fontSize: 12, fontWeight: 600,
              color: isUp ? "#00ff88" : "#ef4444",
            }}>
              {isUp ? "+" : ""}{formatBRL(data.delta)}{" "}
              {isUp ? "a mais que a semana passada" : "a menos que a semana passada"}
            </p>
          </div>
        )}

      </div>
    </motion.div>
  );
}
