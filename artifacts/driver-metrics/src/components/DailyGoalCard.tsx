import { motion } from "framer-motion";
import { Link } from "wouter";
import { formatBRL } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Props {
  goalDaily: number;
  earningsToday: number;
}

// ─── MOTIVATIONAL CONFIG ──────────────────────────────────────────────────────
function getMotivation(pct: number): { message: string; sub: string; color: string; emoji: string } {
  if (pct >= 100) return {
    message: "Meta atingida! Você arrasou hoje!",
    sub: "Descanse ou continue para superar sua marca.",
    color: "#00ff88",
    emoji: "🎉",
  };
  if (pct >= 80) return {
    message: "Quase lá! Só mais um pouco.",
    sub: "Você está muito perto. Não para agora!",
    color: "#00ff88",
    emoji: "🎯",
  };
  if (pct >= 60) return {
    message: "Ótimo ritmo! Continue assim.",
    sub: "Você está na reta final. Mantenha o foco.",
    color: "#22c55e",
    emoji: "🚀",
  };
  if (pct >= 40) return {
    message: "Metade do caminho! Você está indo bem.",
    sub: "Continue rodando — cada corrida conta.",
    color: "#eab308",
    emoji: "💪",
  };
  if (pct >= 20) return {
    message: "Bom começo! Cada corrida te aproxima.",
    sub: "Mantenha o ritmo e a meta fica mais perto.",
    color: "#f97316",
    emoji: "⚡",
  };
  return {
    message: "Bora! Sua meta está esperando.",
    sub: "Comece a registrar suas corridas de hoje.",
    color: "#ef4444",
    emoji: "🏁",
  };
}

// ─── MILESTONE MARKERS ────────────────────────────────────────────────────────
function Milestone({ pct, pos, active }: { pct: number; pos: number; active: boolean }) {
  return (
    <div style={{ position: "absolute", left: `${pos}%`, top: "50%", transform: "translate(-50%, -50%)", zIndex: 2 }}>
      <div style={{
        width: active ? 10 : 8,
        height: active ? 10 : 8,
        borderRadius: "50%",
        background: active ? "#fff" : "rgba(255,255,255,0.15)",
        border: active ? "2px solid rgba(0,0,0,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
        transition: "all 0.4s",
        boxShadow: active ? "0 0 6px rgba(255,255,255,0.4)" : "none",
      }} />
      <p style={{
        position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
        fontSize: 8, fontWeight: 700,
        color: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
        whiteSpace: "nowrap",
        transition: "color 0.4s",
      }}>
        {pct}%
      </p>
    </div>
  );
}

// ─── ANIMATED PROGRESS BAR ───────────────────────────────────────────────────
function GoalBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, pct));

  return (
    <div style={{ position: "relative", height: 20, marginBottom: 20 }}>
      {/* Track */}
      <div style={{
        position: "absolute", inset: 0, top: "50%", transform: "translateY(-50%)",
        height: 10, background: "rgba(255,255,255,0.06)",
        borderRadius: 999, overflow: "hidden",
      }}>
        {/* Fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: "100%",
            background: clamped >= 100
              ? `linear-gradient(90deg, #00ff88, #00cc6a)`
              : `linear-gradient(90deg, ${color}cc, ${color})`,
            borderRadius: 999,
            boxShadow: `0 0 12px ${color}60`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* shimmer */}
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1.5 }}
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
            }}
          />
        </motion.div>
      </div>

      {/* Milestone dots at 25/50/75 */}
      {[25, 50, 75].map((m) => (
        <Milestone key={m} pct={m} pos={m} active={clamped >= m} />
      ))}
    </div>
  );
}

// ─── STAT PILL ────────────────────────────────────────────────────────────────
function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1, textAlign: "center",
      background: "rgba(0,0,0,0.3)", borderRadius: 14, padding: "10px 8px",
      border: "1px solid rgba(255,255,255,0.05)",
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}

// ─── NO GOAL EMPTY STATE ─────────────────────────────────────────────────────
function NoGoalState() {
  return (
    <Link href="/goals">
      <motion.div
        whileTap={{ scale: 0.98 }}
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1.5px dashed rgba(255,255,255,0.1)",
          borderRadius: 24, padding: "22px 20px",
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: "rgba(0,255,136,0.08)",
          border: "1px solid rgba(0,255,136,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>
          🎯
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 3 }}>
            Defina sua meta diária
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.45 }}>
            Toque para configurar quanto quer ganhar hoje.
          </p>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "#00ff88",
          background: "rgba(0,255,136,0.1)", borderRadius: 20, padding: "5px 12px",
          border: "1px solid rgba(0,255,136,0.2)", whiteSpace: "nowrap",
        }}>
          Definir →
        </div>
      </motion.div>
    </Link>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function DailyGoalCard({ goalDaily, earningsToday }: Props) {
  if (!goalDaily || goalDaily <= 0) return <NoGoalState />;

  const rawPct = (earningsToday / goalDaily) * 100;
  const pct = Math.min(100, rawPct);
  const remaining = Math.max(0, goalDaily - earningsToday);
  const exceeded = rawPct > 100 ? rawPct - 100 : 0;
  const mot = getMotivation(pct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: pct >= 100
          ? "linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,204,106,0.04) 100%)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${pct >= 100 ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 24,
        padding: "20px 18px 18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft glow when achieved */}
      {pct >= 100 && (
        <div style={{
          position: "absolute", top: -40, right: -20,
          width: 180, height: 120,
          background: "radial-gradient(ellipse, rgba(0,255,136,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: `${mot.color}15`,
            border: `1px solid ${mot.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>
            {mot.emoji}
          </div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
              Meta do dia
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>
              {formatBRL(goalDaily)}
            </p>
          </div>
        </div>

        {/* Percentage badge */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: `${mot.color}18`,
            border: `1px solid ${mot.color}40`,
            borderRadius: 20, padding: "5px 14px",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: mot.color, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(pct)}%
          </span>
        </motion.div>
      </div>

      {/* ── Progress bar ── */}
      <GoalBar pct={pct} color={mot.color} />

      {/* ── Stats pills ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Pill
          label="Ganho hoje"
          value={formatBRL(earningsToday)}
          color={mot.color}
        />
        {pct < 100 ? (
          <Pill
            label="Faltam"
            value={formatBRL(remaining)}
            color="rgba(255,255,255,0.55)"
          />
        ) : (
          <Pill
            label="Superou em"
            value={`+${Math.round(exceeded)}%`}
            color="#00ff88"
          />
        )}
        <Pill
          label="Meta"
          value={formatBRL(goalDaily)}
          color="rgba(255,255,255,0.3)"
        />
      </div>

      {/* ── Motivational message ── */}
      <div style={{
        background: `${mot.color}08`,
        border: `1px solid ${mot.color}18`,
        borderRadius: 14, padding: "12px 14px",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <div style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💬</div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", lineHeight: 1.45, marginBottom: 2 }}>
            {mot.message}
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.45 }}>
            {mot.sub}
          </p>
        </div>
      </div>

      {/* ── Link to edit goal ── */}
      <Link href="/goals">
        <p style={{
          textAlign: "center", fontSize: 10, fontWeight: 700,
          color: "rgba(255,255,255,0.2)", marginTop: 14,
          letterSpacing: "0.06em", textTransform: "uppercase",
          cursor: "pointer",
        }}>
          Alterar meta →
        </p>
      </Link>
    </motion.div>
  );
}
