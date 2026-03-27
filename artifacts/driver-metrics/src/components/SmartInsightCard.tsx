import { motion } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type InsightStatus = "good" | "average" | "bad" | "idle";

export interface SmartInsightProps {
  status: InsightStatus;
  message: string;
  suggestion: string;
}

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const CONFIG: Record<InsightStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  icon: string;
}> = {
  good: {
    label:  "Ótimo",
    color:  "#00ff88",
    bg:     "rgba(0,255,136,0.04)",
    border: "rgba(0,255,136,0.18)",
    glow:   "rgba(0,255,136,0.22)",
    icon:   "🔥",
  },
  average: {
    label:  "Regular",
    color:  "#eab308",
    bg:     "rgba(234,179,8,0.04)",
    border: "rgba(234,179,8,0.2)",
    glow:   "rgba(234,179,8,0.2)",
    icon:   "⚡",
  },
  bad: {
    label:  "Ruim",
    color:  "#ef4444",
    bg:     "rgba(239,68,68,0.04)",
    border: "rgba(239,68,68,0.2)",
    glow:   "rgba(239,68,68,0.2)",
    icon:   "⚠️",
  },
  idle: {
    label:  "Sem dados",
    color:  "rgba(255,255,255,0.28)",
    bg:     "rgba(255,255,255,0.02)",
    border: "rgba(255,255,255,0.08)",
    glow:   "transparent",
    icon:   "🌙",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CARD
// ═══════════════════════════════════════════════════════════════════════════════
export function SmartInsightCard({ status, message, suggestion }: SmartInsightProps) {
  const c = CONFIG[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "relative",
        borderRadius: 22,
        overflow: "hidden",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${c.color}`,
      }}
    >
      {/* Ambient corner glow */}
      <div style={{
        position: "absolute",
        top: -32, right: -24,
        width: 140, height: 120,
        background: `radial-gradient(ellipse, ${c.glow} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "20px 18px" }}>

        {/* ── Status row ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          {/* Pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: `${c.color}12`,
            border: `1px solid ${c.color}28`,
            borderRadius: 20,
            padding: "5px 11px",
          }}>
            {/* Status dot */}
            <motion.div
              animate={status !== "idle"
                ? { opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }
                : { opacity: 0.4 }
              }
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 6, height: 6,
                borderRadius: "50%",
                background: c.color,
                boxShadow: `0 0 6px ${c.color}`,
              }}
            />
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: c.color,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
            }}>
              {c.label}
            </span>
          </div>

          {/* Icon floated right */}
          <span style={{ marginLeft: "auto", fontSize: 18 }}>{c.icon}</span>
        </div>

        {/* ── Message ────────────────────────────────────────────────────── */}
        <p style={{
          fontSize: 15,
          fontWeight: 600,
          color: "rgba(255,255,255,0.82)",
          lineHeight: 1.6,
          marginBottom: 16,
          letterSpacing: "-0.005em",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}>
          {message}
        </p>

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <div style={{
          height: 1,
          background: `linear-gradient(to right, ${c.color}28, transparent)`,
          marginBottom: 14,
        }} />

        {/* ── Suggestion ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
          <div style={{
            width: 26, height: 26, flexShrink: 0,
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13,
          }}>
            💡
          </div>
          <p style={{
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.42)",
            lineHeight: 1.6,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}>
            {suggestion}
          </p>
        </div>

      </div>
    </motion.div>
  );
}
