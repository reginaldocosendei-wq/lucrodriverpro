import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface GamificationData {
  streak: { current: number; longest: number; danger: boolean; fire: boolean };
  level:  { level: number; name: string; icon: string; xp: number; xpInLevel: number; xpNeeded: number; pct: number; isMax: boolean };
  emotional: { status: string; message: string; color: string; icon: string };
  alerts: Array<{ type: string; message: string; icon: string }>;
  missions: Array<{ key: string; title: string; icon: string; description: string; progress: number; target: number; pct: number; done: boolean; xp: number }>;
  weeklyComparison: {
    thisWeekEarnings: number;
    lastWeekEarnings: number;
    delta: number;
    deltaPct: number | null;
    days: Array<{ date: string; earnings: number; label: string; isToday: boolean }>;
    maxDay: number;
  };
  shockOfReality: {
    dailyAvg: number;
    projectedMonth: number;
    projectedProfit: number;
    workedDaysThisMonth: number;
    daysLeftInMonth: number;
    effectiveHourlyRate: number | null;
    daysToHitMonthlyGoal: number | null;
    monthEarnings: number;
    goalMonthly: number;
    goalMonthlyPct: number | null;
  };
}

// ─── ALERT COLORS ─────────────────────────────────────────────────────────────
const ALERT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  success: { bg: "rgba(0,255,136,0.06)",  border: "rgba(0,255,136,0.2)",  text: "#00ff88" },
  warning: { bg: "rgba(234,179,8,0.06)", border: "rgba(234,179,8,0.2)",  text: "#eab308" },
  danger:  { bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.2)",  text: "#ef4444" },
  info:    { bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.2)", text: "#60a5fa" },
};

// ═════════════════════════════════════════════════════════════════════════════
export function GamificationBar({ data }: { data: GamificationData | null | undefined }) {
  if (!data) return null;

  const { streak, level, emotional, alerts } = data;
  const aColor = ALERT_COLORS[alerts[0]?.type ?? "info"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Streak + Level strip ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#0e0e0e",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18, padding: "12px 16px",
        }}
      >
        {/* Streak pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: streak.danger
            ? "rgba(239,68,68,0.08)"
            : streak.fire
              ? "rgba(255,100,0,0.1)"
              : "rgba(255,255,255,0.04)",
          border: `1px solid ${streak.danger
            ? "rgba(239,68,68,0.25)"
            : streak.fire
              ? "rgba(255,100,0,0.25)"
              : "rgba(255,255,255,0.08)"}`,
          borderRadius: 30, padding: "5px 12px",
          flexShrink: 0,
        }}>
          <motion.span
            animate={streak.fire && !streak.danger ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
            style={{ fontSize: 14 }}
          >
            🔥
          </motion.span>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: streak.danger ? "#ef4444" : streak.fire ? "#ff6400" : "rgba(255,255,255,0.5)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {streak.current}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>
            dia{streak.current !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

        {/* Level pill */}
        <Link href="/profile">
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.03)", borderRadius: 30, padding: "5px 12px",
            cursor: "pointer", flexShrink: 0,
          }}>
            <span style={{ fontSize: 14 }}>{level.icon}</span>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>
                Nv {level.level}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>
                {level.name}
              </span>
            </div>
          </div>
        </Link>

        {/* XP bar — fills remaining width */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              XP
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
              {level.xpInLevel}/{level.xpNeeded}
            </span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${level.pct}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              style={{
                height: "100%", borderRadius: 999,
                background: "linear-gradient(90deg, #818cf8, #c084fc)",
                boxShadow: "0 0 8px rgba(129,140,248,0.4)",
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Emotional status ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: `${emotional.color}06`,
          border: `1px solid ${emotional.color}18`,
          borderLeft: `3px solid ${emotional.color}`,
          borderRadius: 14, padding: "12px 14px",
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>{emotional.icon}</span>
        <p style={{
          fontSize: 13, fontWeight: 600,
          color: "rgba(255,255,255,0.8)",
          lineHeight: 1.45, flex: 1,
          wordBreak: "break-word", overflowWrap: "break-word",
        }}>
          {emotional.message}
        </p>
      </motion.div>

      {/* ── Smart alerts ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {alerts.slice(0, 2).map((alert, i) => {
          const c = ALERT_COLORS[alert.type] ?? ALERT_COLORS.info;
          return (
            <motion.div
              key={`${alert.type}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 12, padding: "10px 14px",
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{alert.icon}</span>
              <p style={{ fontSize: 12, fontWeight: 600, color: c.text, lineHeight: 1.4, flex: 1 }}>
                {alert.message}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>

    </div>
  );
}
