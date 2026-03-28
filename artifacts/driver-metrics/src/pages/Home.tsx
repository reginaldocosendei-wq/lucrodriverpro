import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { useT } from "@/lib/i18n";
import { formatBRL } from "@/lib/utils";
import { Car, Clock, Navigation, Camera, ChevronRight, Lock, Zap } from "lucide-react";
import { motion, animate } from "framer-motion";
import { Link, useLocation } from "wouter";
import { SmartInsightCard, type InsightStatus } from "@/components/SmartInsightCard";
import { DailyAnalysisCard, DailyAnalysisEmpty } from "@/components/DailyAnalysisCard";
import { analyzDay, type HistoryEntry } from "@/lib/dailyAnalysis";

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
function Counter({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const c = animate(from, value, {
      duration: 1.6, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => c.stop();
  }, [value]);
  return (
    <>{new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(display)}</>
  );
}

// ─── ANIMATED BAR ────────────────────────────────────────────────────────────
function Bar({
  pct, color, height = 7, delay = 0,
}: { pct: number; color: string; height?: number; delay?: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden" }}>
      <motion.div
        style={{ height: "100%", borderRadius: 999, background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay }}
      />
    </div>
  );
}

// ─── STAGGER ─────────────────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.45 } },
};

// ─── LOADING SKELETON ─────────────────────────────────────────────────────────
function Skeleton({ h = 24, w = "100%", r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ height: h, width: w, borderRadius: r, background: "rgba(255,255,255,0.07)" }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [, navigate] = useLocation();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: user } = useGetMe();

  // Lightweight fetch of recent daily history for trend analysis
  const { data: historyRaw } = useQuery<HistoryEntry[]>({
    queryKey: ["daily-summaries-history"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/daily-summaries`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json() as Array<{
        date: string; earnings: number; trips: number;
        kmDriven?: number | null; hoursWorked?: number | null;
      }>;
      return data.slice(0, 10).map((d) => ({
        date:        d.date,
        earnings:    d.earnings,
        trips:       d.trips,
        kmDriven:    d.kmDriven ?? null,
        hoursWorked: d.hoursWorked ?? null,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
  const { t } = useT();

  const isFree  = user?.plan !== "pro";
  const hour    = new Date().getHours();
  const greeting = hour < 12 ? t("home.goodMorning") : hour < 18 ? t("home.goodAfternoon") : t("home.goodEvening");

  // ── Derived values ──────────────────────────────────────────────────────────
  const profit        = summary?.realProfitToday ?? 0;
  const profitPos     = profit >= 0;
  const earnings      = summary?.earningsToday ?? 0;
  const costs         = summary?.costsToday ?? 0;
  const trips         = summary?.ridesCountToday ?? 0;
  const rph           = summary?.earningsPerHourToday ?? null;
  const rpkm          = summary?.earningsPerKmToday ?? summary?.avgPerKm ?? null;
  const marginPct     = earnings > 0 ? (profit / earnings) * 100 : 0;

  const goalPct       = Math.min(100, summary?.goalDailyPct ?? 0);
  const goalDaily     = summary?.goalDaily ?? 0;
  const goalRemaining = goalDaily > 0 ? Math.max(0, goalDaily - earnings) : 0;

  // ── Profit color ───────────────────────────────────────────────────────────
  const pColor = profitPos ? "#00ff88" : "#ef4444";

  // ── Goal color ─────────────────────────────────────────────────────────────
  const gColor = goalPct >= 100 ? "#00ff88" : goalPct >= 70 ? "#4ade80" : goalPct >= 40 ? "#eab308" : "#ef4444";

  // ── Smart insight (legacy — kept for type compat) ─────────────────────────
  const insightStatus: InsightStatus =
    earnings <= 0 ? "idle"
    : profit <= 0 || marginPct < 15 ? "bad"
    : marginPct < 40 ? "average"
    : "good";

  // ── Daily analysis (rich engine with history + all-time baselines) ────────
  const dailyAnalysis = !isLoading ? analyzDay({
    earnings,
    costs,
    trips,
    km:            summary?.kmToday          ?? null,
    hours:         summary?.hoursToday       ?? null,
    rating:        summary?.ratingToday      ?? null,
    goalDaily:     summary?.goalDaily        ?? 0,
    earningsPerHourToday: summary?.earningsPerHourToday ?? null,
    earningsPerTripToday: summary?.earningsPerTripToday ?? null,
    earningsPerKmToday:   summary?.earningsPerKmToday   ?? null,
    earningsPerHourAll:   summary?.earningsPerHourAll   ?? null,
    earningsPerTripAll:   summary?.earningsPerTripAll   ?? null,
    earningsPerKmAll:     summary?.earningsPerKmAll     ?? null,
    history:              historyRaw ?? [],
  }) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <motion.div
      variants={container} initial="hidden" animate="show"
      style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 112 }}
    >

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <motion.div variants={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
            {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.015em" }}>{t("home.dashboard")}</p>
        </div>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════
          ║  1. LUCRO — Big profit number
          ╚══════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Base */}
          <div style={{ position: "absolute", inset: 0, background: "#080808", pointerEvents: "none" }} />

          {/* Glow */}
          <div style={{
            position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
            width: 400, height: 240, pointerEvents: "none",
            background: profitPos
              ? "radial-gradient(ellipse,rgba(0,255,136,0.09) 0%,transparent 70%)"
              : "radial-gradient(ellipse,rgba(239,68,68,0.08) 0%,transparent 70%)",
          }} />

          <div style={{ position: "relative", zIndex: 2, padding: "24px 20px" }}>
            {/* Label */}
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.38)", textTransform: "uppercase", marginBottom: 8,
            }}>
              {t("home.profitCard")}
            </p>

            {/* Big number */}
            {isLoading ? (
              <Skeleton h={44} w={180} r={10} />
            ) : (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  fontSize: "clamp(32px, 7vw, 44px)",
                  fontWeight: 900,
                  lineHeight: 1.0,
                  color: pColor,
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: '"tnum" 1',
                  letterSpacing: "-0.02em",
                  marginBottom: 10,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                <Counter value={profit} />
              </motion.p>
            )}

            {/* Earnings · costs */}
            {!isLoading && (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 400, marginBottom: 20 }}>
                {t("home.earned")}{" "}
                <span style={{ color: "#f9fafb", fontWeight: 700 }}>{formatBRL(earnings)}</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}> · {t("home.spent")} </span>
                <span style={{ color: "rgba(239,68,68,0.85)", fontWeight: 700 }}>{formatBRL(costs)}</span>
              </p>
            )}

            {/* Margin bar */}
            {!isLoading && earnings > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{t("home.margin")}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: pColor }}>
                    {Math.round(Math.abs(marginPct))}%
                  </span>
                </div>
                {/* Stacked bar: costs + profit */}
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                  <motion.div
                    style={{ height: "100%", background: "rgba(239,68,68,0.65)", borderRadius: "999px 0 0 999px" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, earnings > 0 ? (costs / earnings) * 100 : 0)}%` }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  />
                  <motion.div
                    style={{ height: "100%", background: pColor, borderRadius: "0 999px 999px 0" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, profitPos ? marginPct : 0)}%` }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                  />
                </div>
              </div>
            )}

            {!isLoading && earnings <= 0 && (
              <Link href="/import">
                <div
                  onClick={() => console.log("[HOME] Camera CTA clicked → navigating to /import. Current path:", window.location.pathname)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
                    background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)",
                    borderRadius: 12, padding: "10px 14px",
                  }}
                >
                  <Camera size={14} color="#00ff88" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#00ff88" }}>{t("home.importDay")}</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════
          ║  2. MÉTRICAS — trips · per hour · per km
          ╚══════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        {/* Row label */}
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
          marginBottom: 10,
        }}>
          {t("home.indicators")}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {/* Corridas */}
          <MetricTile
            icon={<Car size={15} color="#60a5fa" />}
            label={t("home.rides")}
            accent="#60a5fa"
            loading={isLoading}
            value={isLoading ? null : (
              <span style={{ fontSize: 34, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>
                {trips}
              </span>
            )}
          />

          {/* R$/hora */}
          <MetricTile
            icon={<Clock size={15} color="#c084fc" />}
            label={t("home.perHour")}
            accent="#c084fc"
            loading={isLoading}
            value={isLoading ? null : rph != null ? (
              <>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>R$</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {rph.toFixed(0)}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontWeight: 500, lineHeight: 1.4 }}>
                {t("home.enterHours")}
              </span>
            )}
          />

          {/* R$/km */}
          <MetricTile
            icon={<Navigation size={15} color="#fb923c" />}
            label={t("home.perKm")}
            accent="#fb923c"
            loading={isLoading}
            value={isLoading ? null : rpkm != null ? (
              <>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>R$</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {rpkm.toFixed(2)}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontWeight: 500, lineHeight: 1.4 }}>
                {t("home.enterKm")}
              </span>
            )}
          />
        </div>
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════
          ║  3. ANÁLISE INTELIGENTE DO DIA
          ╚══════════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 10 }}>
          {t("home.dailyAnalysis")}
        </p>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton h={20} w="60%" r={8} />
            <Skeleton h={18} r={8} />
            <Skeleton h={18} w="85%" r={8} />
            <Skeleton h={14} w="70%" r={8} />
          </div>
        ) : dailyAnalysis ? (
          <DailyAnalysisCard analysis={dailyAnalysis} />
        ) : (
          <DailyAnalysisEmpty />
        )}
      </motion.div>


      {/* ╔══════════════════════════════════════════════════════════════════
          ║  4. META — Goal progress bar
          ╚══════════════════════════════════════════════════════════════════ */}
      {(isLoading || goalDaily > 0) && (
        <motion.div variants={item}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 10 }}>
            {t("home.dailyGoal")}
          </p>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton h={16} w="40%" r={8} />
              <Skeleton h={10} r={999} />
            </div>
          ) : (
            <div style={{
              background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: "20px",
              position: "relative", overflow: "hidden",
            }}>

              {/* Header row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, position: "relative" }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 4 }}>
                    {t("home.earnedToday")}
                  </p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", wordBreak: "break-word", overflowWrap: "break-word" }}>
                      {formatBRL(earnings)}
                    </span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                      {t("home.of")} {formatBRL(goalDaily)}
                    </span>
                  </div>
                </div>

                {/* Percentage badge */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    width: 52, height: 52, borderRadius: "50%",
                    border: `3px solid ${gColor}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${gColor}08`,
                    boxShadow: goalPct >= 100 ? `0 0 20px ${gColor}40` : "none",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 900, color: gColor, fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(goalPct)}%
                  </span>
                </motion.div>
              </div>

              {/* Progress bar with milestone dots */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Bar pct={goalPct} color={gColor} height={8} delay={0.3} />

              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                {goalPct >= 100 ? (
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#00ff88" }}>✓ {t("home.goalReached")}</p>
                ) : (
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                    {t("home.goalRemaining", { value: formatBRL(goalRemaining) })}
                  </p>
                )}
                <Link href="/goals">
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600, cursor: "pointer" }}>
                    {t("home.editGoal")}
                  </span>
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── No-goal prompt ────────────────────────────────────────────────── */}
      {!isLoading && goalDaily <= 0 && (
        <motion.div variants={item}>
          <Link href="/goals">
            <div style={{
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: 20, padding: "16px 20px",
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={17} color="#00ff88" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 2 }}>{t("home.setGoal")}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{t("home.setGoalSub")}</p>
              </div>
              <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
            </div>
          </Link>
        </motion.div>
      )}


      {/* ── PRO upsell ──────────────────────────────────────────────────────── */}
      {isFree && !isLoading && (
        <motion.div variants={item}>
          <Link href="/upgrade">
            <motion.div whileTap={{ scale: 0.98 }} style={{ position: "relative", borderRadius: 20, overflow: "hidden", cursor: "pointer" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(234,179,8,0.1),rgba(217,119,6,0.05))", pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1, padding: "14px 18px", border: "1px solid rgba(234,179,8,0.16)", borderRadius: 20, display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: "linear-gradient(135deg,#eab308,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Lock size={18} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#f9fafb", marginBottom: 2 }}>{t("home.activatePro")}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{t("home.proSub")}</p>
                </div>
                <ChevronRight size={16} color="rgba(234,179,8,0.6)" />
              </div>
            </motion.div>
          </Link>
        </motion.div>
      )}

      {/* ── Import CTA ──────────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <Link href="/import">
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => console.log("[HOME] Import card clicked → navigating to /import. Current path:", window.location.pathname)}
            style={{ position: "relative", borderRadius: 20, overflow: "hidden", cursor: "pointer" }}
          >
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(0,255,136,0.09),rgba(0,204,106,0.04))", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1, padding: "14px 18px", border: "1px solid rgba(0,255,136,0.13)", borderRadius: 20, display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: "linear-gradient(135deg,#00ff88,#00cc6a)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Camera size={18} color="#000" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#f9fafb", marginBottom: 2 }}>{t("home.importDay")}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{t("home.importDaySub")}</p>
              </div>
              <ChevronRight size={16} color="rgba(0,255,136,0.55)" />
            </div>
          </motion.div>
        </Link>
      </motion.div>


      {/* ── FAB ─────────────────────────────────────────────────────────────── */}
      <motion.div
        onClick={() => {
          console.log("[HOME] FAB clicked → calling navigate('/import'). Current path:", window.location.pathname);
          navigate("/import");
          console.log("[HOME] FAB → navigate() called. Path after call:", window.location.pathname);
        }}
        style={{
          position: "fixed", bottom: 92, right: "max(20px, calc((100vw - 480px) / 2 + 20px))",
          zIndex: 50, cursor: "pointer",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.7, type: "spring", damping: 13, stiffness: 240 }}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.08 }}
      >
        <div style={{
          width: 58, height: 58, borderRadius: "50%",
          background: "#00ff88",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}>
          <Camera size={24} color="#000" strokeWidth={2.2} />
        </div>
      </motion.div>

    </motion.div>
  );
}

// ─── METRIC TILE ──────────────────────────────────────────────────────────────
function MetricTile({
  icon, label, accent, value, loading,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  value: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "#0e0e0e",
        border: "1px solid rgba(255,255,255,0.07)",
        borderTop: `3px solid ${accent}`,
        borderRadius: 16,
        padding: "16px 12px",
        display: "flex", flexDirection: "column",
        alignItems: "flex-start", gap: 10,
        minHeight: 104,
        position: "relative", overflow: "hidden",
      }}
    >

      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: `${accent}14`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
          textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)",
        }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 2, minWidth: 0, maxWidth: "100%", flexWrap: "wrap" }}>
        {loading
          ? <Skeleton h={30} w={60} r={8} />
          : value
        }
      </div>
    </motion.div>
  );
}
