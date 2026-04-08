import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ChevronRight, Brain } from "lucide-react";
import { useState } from "react";
import { useInsights, type Insight, type InsightStatus } from "@/hooks/useInsights";
import { Link } from "wouter";

const STATUS_CONFIG: Record<InsightStatus, {
  color: string;
  bg: string;
  border: string;
  dot: string;
  Icon: typeof TrendingUp;
}> = {
  good: {
    color: "#00ff88",
    bg: "rgba(0,255,136,0.06)",
    border: "rgba(0,255,136,0.2)",
    dot: "#00ff88",
    Icon: TrendingUp,
  },
  average: {
    color: "#eab308",
    bg: "rgba(234,179,8,0.06)",
    border: "rgba(234,179,8,0.2)",
    dot: "#eab308",
    Icon: Minus,
  },
  bad: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.06)",
    border: "rgba(239,68,68,0.2)",
    dot: "#ef4444",
    Icon: TrendingDown,
  },
};

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[insight.status];
  const { Icon } = cfg;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: index * 0.07 }}
      onClick={() => setExpanded(!expanded)}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 20,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "border-color 0.2s",
        userSelect: "none",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Status icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${cfg.color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} color={cfg.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Status badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            marginBottom: 4,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase" as const, color: cfg.color,
            }}>
              {insight.status === "good" ? "Positivo" : insight.status === "bad" ? "Atenção" : "Neutro"}
            </span>
          </div>

          <p style={{ color: "#f9fafb", fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 4 }}>
            {insight.title}
          </p>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.5 }}>
            {insight.message}
          </p>
        </div>

        {/* Expand toggle */}
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ flexShrink: 0, color: "rgba(255,255,255,0.25)" }}
        >
          <ChevronRight size={16} />
        </motion.div>
      </div>

      {/* Expanded: suggestion */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              marginTop: 12, paddingTop: 12,
              borderTop: `1px solid ${cfg.border}`,
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 1.55 }}>
                {insight.suggestion}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function InsightsPanel() {
  const { data, isLoading } = useInsights();
  const insights = data?.insights;

  if (isLoading) {
    return (
      <div style={{ padding: "20px 0" }}>
        <div style={{
          height: 80, borderRadius: 20,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          animation: "pulse 1.5s infinite",
        }} />
      </div>
    );
  }

  if (!insights || insights.length === 0) return null;

  const badCount = insights.filter((i) => i.status === "bad").length;
  const goodCount = insights.filter((i) => i.status === "good").length;

  const headerStatus: InsightStatus = badCount >= 2 ? "bad" : goodCount >= 2 ? "good" : "average";
  const headerCfg = STATUS_CONFIG[headerStatus];

  const headerText =
    badCount >= 2
      ? "Alguns pontos precisam de atenção"
      : goodCount >= 2
      ? "Você está indo muito bem!"
      : "Análise do seu desempenho";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${headerCfg.color}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Brain size={14} color={headerCfg.color} />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)" }}>
              Inteligência financeira
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", lineHeight: 1.2 }}>
              {headerText}
            </p>
          </div>
        </div>
        <div style={{
          background: `${headerCfg.color}15`,
          border: `1px solid ${headerCfg.color}40`,
          borderRadius: 20, padding: "3px 10px",
          color: headerCfg.color, fontSize: 11, fontWeight: 700,
        }}>
          {insights.length} análise{insights.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Insight cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((insight, i) => (
          <InsightCard key={insight.type} insight={insight} index={i} />
        ))}
      </div>

      {/* Tap hint */}
      <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 10, fontStyle: "italic" }}>
        Toque em qualquer análise para ver a sugestão
      </p>
    </div>
  );
}
