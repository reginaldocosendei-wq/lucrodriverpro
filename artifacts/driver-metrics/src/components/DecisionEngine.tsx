import { motion } from "framer-motion";
import { useInsights, type Decision } from "@/hooks/useInsights";

// ─── SEMI-CIRCLE GAUGE ───────────────────────────────────────────────────────
function Gauge({ score, color }: { score: number; color: string }) {
  const W = 200;
  const cx = W / 2;
  const cy = W / 2 + 10;
  const r = 78;
  const strokeW = 14;
  const gap = 28; // degrees cut from the bottom on each side

  // The arc goes from (180 + gap/2)° to (360 + 180 - gap/2)°
  const startDeg = 180 + gap / 2;
  const endDeg = 360 + 180 - gap / 2;
  const totalDeg = endDeg - startDeg;

  function polar(deg: number): [number, number] {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function arc(start: number, end: number, color: string, opacity = 1) {
    const [x1, y1] = polar(start);
    const [x2, y2] = polar(end);
    const large = end - start > 180 ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  }

  const filledDeg = (score / 100) * totalDeg;
  const fillEnd = startDeg + filledDeg;

  return (
    <svg width={W} height={W * 0.7} viewBox={`0 0 ${W} ${W * 0.7}`} style={{ overflow: "visible" }}>
      {/* Track */}
      {arc(startDeg, endDeg, "rgba(255,255,255,0.07)")}
      {/* Tick marks */}
      {[0, 25, 50, 75, 100].map((pct) => {
        const deg = startDeg + (pct / 100) * totalDeg;
        const [ox, oy] = polar(deg);
        const [ix, iy] = polar(deg);
        const inR = r - strokeW / 2 - 4;
        const outR = r + strokeW / 2 + 3;
        const rad = ((deg - 90) * Math.PI) / 180;
        const x1 = cx + inR * Math.cos(rad);
        const y1 = cy + inR * Math.sin(rad);
        const x2 = cx + outR * Math.cos(rad);
        const y2 = cy + outR * Math.sin(rad);
        return <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeLinecap="round" />;
      })}
      {/* Filled arc */}
      {score > 0 && (
        <motion.path
          d={`M ${polar(startDeg).join(" ")} A ${r} ${r} 0 ${filledDeg > 180 ? 1 : 0} 1 ${polar(fillEnd).join(" ")}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          filter={`drop-shadow(0 0 8px ${color})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </svg>
  );
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS = {
  good:    { color: "#00ff88", glow: "rgba(0,255,136,0.25)", bg: "rgba(0,255,136,0.05)",    border: "rgba(0,255,136,0.18)"    },
  average: { color: "#eab308", glow: "rgba(234,179,8,0.2)",  bg: "rgba(234,179,8,0.05)",    border: "rgba(234,179,8,0.2)"     },
  bad:     { color: "#ef4444", glow: "rgba(239,68,68,0.2)",  bg: "rgba(239,68,68,0.05)",    border: "rgba(239,68,68,0.18)"    },
};

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
function EngineEmpty() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 24, padding: "24px 20px",
      textAlign: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
        fontSize: 22,
      }}>🧠</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
        Motor de decisão
      </p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
        Importe o resumo de hoje para ativar a análise em tempo real.
      </p>
    </div>
  );
}

// ─── SCORE BANDS LEGEND ───────────────────────────────────────────────────────
function ScoreBand({ label, range, color, active }: { label: string; range: string; color: string; active: boolean }) {
  return (
    <div style={{
      flex: 1, textAlign: "center",
      padding: "6px 4px",
      borderRadius: 10,
      background: active ? `${color}15` : "transparent",
      border: active ? `1px solid ${color}30` : "1px solid transparent",
      transition: "all 0.3s",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, margin: "0 auto 4px", opacity: active ? 1 : 0.3 }} />
      <p style={{ fontSize: 9, fontWeight: 700, color: active ? color : "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>{range}</p>
    </div>
  );
}

// ─── DECISION CARD ────────────────────────────────────────────────────────────
function DecisionCard({ decision }: { decision: Decision }) {
  const cfg = STATUS[decision.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Top glow */}
      <div style={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: 240, height: 120,
        background: `radial-gradient(ellipse, ${cfg.glow} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "24px 20px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                Motor de decisão
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>Análise em tempo real</p>
            </div>
          </div>
          {/* Verdict badge */}
          <div style={{
            background: `${cfg.color}20`,
            border: `1px solid ${cfg.color}50`,
            borderRadius: 20, padding: "5px 12px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: "0.07em" }}>
              {decision.verdict}
            </span>
          </div>
        </div>

        {/* Gauge + Score */}
        <div style={{ position: "relative", display: "flex", justifyContent: "center", margin: "-4px 0 -16px" }}>
          <Gauge score={decision.score} color={cfg.color} />
          {/* Center score */}
          <div style={{
            position: "absolute",
            bottom: 22, left: "50%", transform: "translateX(-50%)",
            textAlign: "center",
          }}>
            <motion.p
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontSize: 44, fontWeight: 900, lineHeight: 1,
                color: cfg.color,
                textShadow: `0 0 30px ${cfg.glow}`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {decision.score}
            </motion.p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.06em" }}>EFICIÊNCIA</p>
          </div>
        </div>

        {/* Score bands */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          <ScoreBand label="CRÍTICO"   range="0–44"   color="#ef4444" active={decision.score < 45} />
          <ScoreBand label="ATENÇÃO"   range="45–69"  color="#eab308" active={decision.score >= 45 && decision.score < 70} />
          <ScoreBand label="EFICIENTE" range="70–100" color="#00ff88" active={decision.score >= 70} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 18 }} />

        {/* Message */}
        <div style={{
          background: "rgba(0,0,0,0.25)", borderRadius: 14,
          padding: "14px 16px", marginBottom: 14,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb", lineHeight: 1.55 }}>
            {decision.message}
          </p>
        </div>

        {/* Suggestion */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          background: `${cfg.color}08`, borderRadius: 14,
          padding: "12px 14px",
          border: `1px solid ${cfg.color}15`,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>
            {decision.suggestion}
          </p>
        </div>

      </div>
    </motion.div>
  );
}

// ─── EXPORTED COMPONENT ───────────────────────────────────────────────────────
export function DecisionEngine() {
  const { data, isLoading } = useInsights();

  if (isLoading) {
    return (
      <div style={{
        height: 100, borderRadius: 24,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        animation: "pulse 1.5s infinite",
      }} />
    );
  }

  if (!data?.decision) return <EngineEmpty />;

  return <DecisionCard decision={data.decision} />;
}
