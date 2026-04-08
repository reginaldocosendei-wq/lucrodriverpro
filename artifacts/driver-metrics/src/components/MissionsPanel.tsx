import { motion } from "framer-motion";
import { Link } from "wouter";

export interface Mission {
  key: string;
  title: string;
  icon: string;
  description: string;
  progress: number;
  target: number;
  pct: number;
  done: boolean;
  xp: number;
}

// ─── MINI RING ────────────────────────────────────────────────────────────────
function Ring({ pct, done }: { pct: number; done: boolean }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, pct) / 100) * circ;

  return (
    <svg width={40} height={40} style={{ flexShrink: 0 }}>
      <circle cx={20} cy={20} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3} />
      <motion.circle
        cx={20} cy={20} r={r}
        fill="none"
        stroke={done ? "#00ff88" : "#818cf8"}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
      />
      {done && (
        <text x="20" y="25" textAnchor="middle" fontSize="12" fill="#00ff88">✓</text>
      )}
      {!done && (
        <text x="20" y="25" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)" fontWeight="700">
          {Math.round(pct)}%
        </text>
      )}
    </svg>
  );
}

// ─── SINGLE MISSION CARD ─────────────────────────────────────────────────────
function MissionCard({ mission, delay }: { mission: Mission; delay: number }) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        background: mission.done
          ? "rgba(0,255,136,0.04)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${mission.done
          ? "rgba(0,255,136,0.15)"
          : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16, padding: "14px 14px",
        cursor: mission.key === "set_goal" || mission.key === "record_today" ? "pointer" : "default",
        transition: "opacity 0.2s",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
        background: mission.done
          ? "rgba(0,255,136,0.1)"
          : "rgba(255,255,255,0.05)",
        border: `1px solid ${mission.done
          ? "rgba(0,255,136,0.2)"
          : "rgba(255,255,255,0.07)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17,
      }}>
        {mission.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 700,
          color: mission.done ? "#00ff88" : "rgba(255,255,255,0.85)",
          marginBottom: 2,
          textDecoration: mission.done ? "line-through" : "none",
          opacity: mission.done ? 0.7 : 1,
        }}>
          {mission.title}
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.35 }}>
          {mission.description}
        </p>
      </div>

      {/* Ring progress */}
      <Ring pct={mission.pct} done={mission.done} />

      {/* XP badge */}
      <div style={{
        fontSize: 9, fontWeight: 800,
        color: mission.done ? "#00ff88" : "rgba(129,140,248,0.7)",
        background: mission.done ? "rgba(0,255,136,0.08)" : "rgba(129,140,248,0.08)",
        border: `1px solid ${mission.done ? "rgba(0,255,136,0.2)" : "rgba(129,140,248,0.15)"}`,
        borderRadius: 20, padding: "3px 8px", flexShrink: 0,
        letterSpacing: "0.04em",
      }}>
        +{mission.xp} XP
      </div>
    </motion.div>
  );

  if (mission.key === "set_goal") return <Link href="/goals">{inner}</Link>;
  if (mission.key === "record_today" && !mission.done) return <Link href="/import">{inner}</Link>;
  return inner;
}

// ═════════════════════════════════════════════════════════════════════════════
export function MissionsPanel({ missions }: { missions: Mission[] | undefined }) {
  if (!missions || missions.length === 0) return null;

  const done = missions.filter((m) => m.done).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
        }}>
          Missões do dia
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: done === missions.length ? "#00ff88" : "rgba(255,255,255,0.3)",
          }}>
            {done}/{missions.length}
          </span>
          <div style={{ display: "flex", gap: 3 }}>
            {missions.map((m) => (
              <div key={m.key} style={{
                width: 6, height: 6, borderRadius: "50%",
                background: m.done ? "#00ff88" : "rgba(255,255,255,0.12)",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Mission cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {missions.map((m, i) => (
          <MissionCard key={m.key} mission={m} delay={i * 0.06} />
        ))}
      </div>

      {/* All done celebration */}
      {done === missions.length && done > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            marginTop: 10,
            background: "rgba(0,255,136,0.06)",
            border: "1px solid rgba(0,255,136,0.2)",
            borderRadius: 12, padding: "10px 14px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: "#00ff88" }}>
            🎉 Todas as missões concluídas! Excelente dia!
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
