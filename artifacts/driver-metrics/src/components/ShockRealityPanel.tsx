import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export interface ShockOfReality {
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
}

// ─── STAT LINE ────────────────────────────────────────────────────────────────
function StatLine({
  label, value, sub, color = "rgba(255,255,255,0.85)",
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 2 }}>{sub}</p>}
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
        {value}
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export function ShockRealityPanel({ data }: { data: ShockOfReality | undefined }) {
  const [open, setOpen] = useState(false);

  if (!data) return null;

  // Empty state — no data yet
  if (data.workedDaysThisMonth === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 10 }}>
          Realidade do mês
        </p>
        <div style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
            📊
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>Projeção mensal</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>
              Registre pelo menos 1 dia para ver sua projeção do mês.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const profitPositive = data.projectedProfit >= 0;
  const onTrack = data.goalMonthly > 0
    ? data.projectedMonth >= data.goalMonthly * 0.9
    : null;

  // Header verdict
  let verdict = "";
  let verdictColor = "#60a5fa";
  if (data.goalMonthly > 0) {
    if (onTrack) {
      verdict = "Você está no ritmo para bater a meta mensal!";
      verdictColor = "#00ff88";
    } else {
      const gap = data.goalMonthly - data.projectedMonth;
      verdict = `Projeção R$ ${formatBRL(gap).replace("R$\u00a0", "")} abaixo da meta — ajuste o ritmo.`;
      verdictColor = "#eab308";
    }
  } else {
    verdict = profitPositive
      ? `Lucro projetado de ${formatBRL(data.projectedProfit)} este mês.`
      : `Prejuízo projetado de ${formatBRL(Math.abs(data.projectedProfit))} — revise seus custos.`;
    verdictColor = profitPositive ? "#00ff88" : "#ef4444";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left",
          background: "none", border: "none", cursor: "pointer",
          padding: 0, marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
        }}>
          Realidade do mês
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
            {open ? "Ocultar" : "Ver detalhes"}
          </span>
          {open
            ? <ChevronUp size={14} color="rgba(255,255,255,0.25)" />
            : <ChevronDown size={14} color="rgba(255,255,255,0.25)" />
          }
        </div>
      </button>

      {/* Summary card — always visible */}
      <div style={{
        background: "#0e0e0e",
        border: `1px solid ${verdictColor}22`,
        borderLeft: `3px solid ${verdictColor}`,
        borderRadius: 18, overflow: "hidden",
      }}>

        {/* Header row */}
        <div style={{ padding: "16px 18px 14px", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Projeção mensal
              </span>
            </div>
            <p style={{
              fontSize: 28, fontWeight: 900, color: "#f9fafb",
              fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1,
              marginBottom: 6,
            }}>
              {formatBRL(data.projectedMonth)}
            </p>
            <p style={{ fontSize: 12, color: verdictColor, fontWeight: 600, lineHeight: 1.4 }}>
              {verdict}
            </p>
          </div>

          {/* Profit badge */}
          <div style={{
            background: profitPositive ? "rgba(0,255,136,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${profitPositive ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}`,
            borderRadius: 14, padding: "8px 12px", textAlign: "center", flexShrink: 0,
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 3 }}>
              Lucro real
            </p>
            <p style={{
              fontSize: 14, fontWeight: 900,
              color: profitPositive ? "#00ff88" : "#ef4444",
              fontVariantNumeric: "tabular-nums",
            }}>
              {formatBRL(data.projectedProfit)}
            </p>
          </div>
        </div>

        {/* Monthly goal progress bar */}
        {data.goalMonthly > 0 && data.goalMonthlyPct !== null && (
          <div style={{ padding: "0 18px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
                Meta mensal {formatBRL(data.monthEarnings)} / {formatBRL(data.goalMonthly)}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color: data.goalMonthlyPct >= 100 ? "#00ff88" : "#eab308" }}>
                {data.goalMonthlyPct}%
              </span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.goalMonthlyPct}%` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  height: "100%", borderRadius: 999,
                  background: data.goalMonthlyPct >= 100
                    ? "linear-gradient(90deg, #00ff88, #00cc6a)"
                    : "linear-gradient(90deg, #eab308, #f97316)",
                }}
              />
            </div>
          </div>
        )}

        {/* Expanded detail panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                padding: "14px 18px 18px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", flexDirection: "column", gap: 12,
              }}>

                <StatLine
                  label="Dias trabalhados este mês"
                  value={`${data.workedDaysThisMonth} dias`}
                />

                <StatLine
                  label="Média diária real"
                  value={formatBRL(data.dailyAvg)}
                  sub="Por dia trabalhado"
                />

                {data.effectiveHourlyRate !== null && (
                  <StatLine
                    label="Taxa horária efetiva"
                    value={`${formatBRL(data.effectiveHourlyRate)}/h`}
                    sub="Faturamento total ÷ horas trabalhadas"
                    color={data.effectiveHourlyRate >= 20 ? "#00ff88" : data.effectiveHourlyRate >= 12 ? "#eab308" : "#ef4444"}
                  />
                )}

                {data.daysToHitMonthlyGoal !== null && data.goalMonthly > 0 && (
                  <StatLine
                    label={data.daysToHitMonthlyGoal === 0 ? "Meta mensal atingida!" : "Dias para bater a meta mensal"}
                    value={data.daysToHitMonthlyGoal === 0 ? "🎯" : `${data.daysToHitMonthlyGoal} dias`}
                    sub={data.daysToHitMonthlyGoal > 0 ? `Mantendo média de ${formatBRL(data.dailyAvg)}/dia` : undefined}
                    color={data.daysToHitMonthlyGoal === 0 ? "#00ff88" : "rgba(255,255,255,0.85)"}
                  />
                )}

                <div style={{ paddingTop: 2 }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.55 }}>
                    Projeção baseada em {data.workedDaysThisMonth} dia{data.workedDaysThisMonth !== 1 ? "s" : ""} trabalhado{data.workedDaysThisMonth !== 1 ? "s" : ""} e {data.daysLeftInMonth} dia{data.daysLeftInMonth !== 1 ? "s" : ""} restante{data.daysLeftInMonth !== 1 ? "s" : ""} no mês.
                  </p>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
