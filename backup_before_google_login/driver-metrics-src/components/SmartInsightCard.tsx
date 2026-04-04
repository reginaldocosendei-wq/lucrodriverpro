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
    bg:     "rgba(0,255,136,0.03)",
    border: "rgba(0,255,136,0.14)",
    glow:   "rgba(0,255,136,0.1)",
    icon:   "🔥",
  },
  average: {
    label:  "Regular",
    color:  "#eab308",
    bg:     "rgba(234,179,8,0.03)",
    border: "rgba(234,179,8,0.14)",
    glow:   "rgba(234,179,8,0.09)",
    icon:   "⚡",
  },
  bad: {
    label:  "Ruim",
    color:  "#ef4444",
    bg:     "rgba(239,68,68,0.03)",
    border: "rgba(239,68,68,0.14)",
    glow:   "rgba(239,68,68,0.09)",
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
        borderRadius: 20,
        overflow: "hidden",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${c.color}`,
      }}
    >

      <div style={{ position: "relative", zIndex: 1, padding: "20px" }}>

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
            <div style={{
              width: 6, height: 6,
              borderRadius: "50%",
              background: c.color,
              opacity: status === "idle" ? 0.4 : 0.85,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: c.color,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
            }}>
              {c.label}
            </span>
          </div>

        </div>

        {/* ── Message ────────────────────────────────────────────────────── */}
        <p style={{
          fontSize: 15,
          fontWeight: 600,
          color: "rgba(255,255,255,0.88)",
          lineHeight: 1.68,
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
        <p style={{
          fontSize: 13,
          fontWeight: 400,
          color: "rgba(255,255,255,0.42)",
          lineHeight: 1.7,
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}>
          {suggestion}
        </p>

      </div>
    </motion.div>
  );
}
