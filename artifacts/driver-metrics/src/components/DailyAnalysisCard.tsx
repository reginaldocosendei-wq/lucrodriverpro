import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { AlertTriangle, Lightbulb, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, XCircle, ArrowUp, ArrowDown } from "lucide-react";
import type { DailyAnalysis, DayStatus } from "@/lib/dailyAnalysis";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS: Record<DayStatus, {
  label:  string;
  color:  string;
  bg:     string;
  border: string;
  glow:   string;
  icon:   React.ReactNode;
}> = {
  great_day: {
    label:  "Ótimo dia",
    color:  "#00ff88",
    bg:     "rgba(0,255,136,0.06)",
    border: "rgba(0,255,136,0.14)",
    glow:   "rgba(0,255,136,0.08)",
    icon:   <TrendingUp size={14} color="#00ff88" strokeWidth={2.5} />,
  },
  good_day: {
    label:  "Bom dia",
    color:  "#4ade80",
    bg:     "rgba(74,222,128,0.06)",
    border: "rgba(74,222,128,0.14)",
    glow:   "rgba(74,222,128,0.06)",
    icon:   <Minus size={14} color="#4ade80" strokeWidth={2.5} />,
  },
  weak_day: {
    label:  "Dia fraco",
    color:  "#eab308",
    bg:     "rgba(234,179,8,0.06)",
    border: "rgba(234,179,8,0.14)",
    glow:   "rgba(234,179,8,0.06)",
    icon:   <TrendingDown size={14} color="#eab308" strokeWidth={2.5} />,
  },
  not_worth_it: {
    label:  "Não compensou",
    color:  "#f87171",
    bg:     "rgba(248,113,113,0.06)",
    border: "rgba(248,113,113,0.12)",
    glow:   "rgba(248,113,113,0.06)",
    icon:   <XCircle size={14} color="#f87171" strokeWidth={2.5} />,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function DailyAnalysisCard({ analysis }: { analysis: DailyAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS[analysis.status];

  const hasWarnings        = analysis.warnings.length > 0;
  const hasRecommendations = analysis.recommendations.length > 0;
  const hasExtras          = hasWarnings || hasRecommendations;

  return (
    <motion.div
      layout
      style={{
        background: "#0e0e0e",
        border:     `1px solid ${cfg.border}`,
        borderRadius: 20,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle top glow */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 60,
        background: `linear-gradient(to bottom, ${cfg.glow}, transparent)`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "18px 18px 0" }}>

        {/* ── Status badge + trend + expand toggle ────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Status badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 20, padding: "5px 12px",
            }}>
              {cfg.icon}
              <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: "0.05em" }}>
                {cfg.label.toUpperCase()}
              </span>
            </div>

            {/* Trend pill */}
            {analysis.trendPct !== null && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: analysis.trendPct >= 0 ? "rgba(0,255,136,0.06)" : "rgba(248,113,113,0.06)",
                border: `1px solid ${analysis.trendPct >= 0 ? "rgba(0,255,136,0.14)" : "rgba(248,113,113,0.12)"}`,
                borderRadius: 20, padding: "4px 10px",
              }}>
                {analysis.trendPct >= 0
                  ? <ArrowUp size={10} color="#00ff88" strokeWidth={2.5} />
                  : <ArrowDown size={10} color="#f87171" strokeWidth={2.5} />
                }
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: analysis.trendPct >= 0 ? "#00ff88" : "#f87171",
                  letterSpacing: "0.03em",
                }}>
                  {Math.abs(Math.round(analysis.trendPct))}% vs média
                </span>
              </div>
            )}
          </div>

          {hasExtras && (
            <button
              onClick={() => setExpanded((p) => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 600,
                fontFamily: "inherit", flexShrink: 0, marginLeft: 4,
              }}
            >
              {expanded ? "Menos" : "Detalhes"}
              {expanded
                ? <ChevronUp size={13} strokeWidth={2.5} />
                : <ChevronDown size={13} strokeWidth={2.5} />
              }
            </button>
          )}
        </div>

        {/* ── Main message ────────────────────────────────────────────────── */}
        <p style={{
          fontSize: 14, lineHeight: 1.65, fontWeight: 500,
          color: "rgba(255,255,255,0.72)",
          marginBottom: hasExtras ? 0 : 18,
        }}>
          {analysis.mainMessage}
        </p>

        {/* ── Quick metric pills (always visible) ─────────────────────────── */}
        {!hasExtras && (
          <div style={{ height: 18 }} />
        )}

      </div>

      {/* ── Expandable section ────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {(expanded || !hasExtras) && hasExtras && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "14px 18px 0" }}>
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 14 }} />

              {/* Warnings */}
              {hasWarnings && (
                <div style={{ marginBottom: hasRecommendations ? 14 : 0 }}>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: 8 }}>
                    Alertas
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {analysis.warnings.map((w, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, ease: [0.22, 1, 0.36, 1], duration: 0.25 }}
                        style={{ display: "flex", alignItems: "flex-start", gap: 9 }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <AlertTriangle size={11} color="#eab308" strokeWidth={2.5} />
                        </div>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontWeight: 500, paddingTop: 3 }}>
                          {w}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {hasRecommendations && (
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: 8 }}>
                    Recomendações
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {analysis.recommendations.map((r, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 + 0.1, ease: [0.22, 1, 0.36, 1], duration: 0.25 }}
                        style={{ display: "flex", alignItems: "flex-start", gap: 9 }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: 8, background: `${cfg.bg}`, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Lightbulb size={11} color={cfg.color} strokeWidth={2.5} />
                        </div>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontWeight: 500, paddingTop: 3 }}>
                          {r}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom padding */}
      <div style={{ height: 18 }} />
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function DailyAnalysisEmpty() {
  return (
    <div style={{
      background: "#0e0e0e",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 20,
      padding: "20px 18px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <TrendingUp size={16} color="rgba(255,255,255,0.15)" strokeWidth={1.5} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
          Análise disponível após o primeiro registro
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          Importe ou registre seu dia para ver o relatório.
        </p>
      </div>
    </div>
  );
}
