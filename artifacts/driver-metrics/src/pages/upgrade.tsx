import { useEffect, useMemo, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useIsDesktop } from "@/lib/useBreakpoint";
import {
  Check, ArrowLeft, Shield, Zap, AlertTriangle,
  Clock, ChevronRight, TrendingUp, MapPin, Timer, Award,
  Target, BarChart2, Brain, CalendarDays,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { getApiBase, authFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { DEV_SKIP_STRIPE_CHECKOUT } from "@/lib/dev-flags";

const BASE = getApiBase();

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.5 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function Upgrade() {
  const { data: user }             = useGetMe();
  const queryClient                = useQueryClient();
  const [location, navigate]       = useLocation();
  const [selected, setSelected]    = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading]  = useState(false);
  const [error, setError]          = useState<string | null>(null);
  const { t, currency }            = useT();

  useEffect(() => { setError(null); }, [location]);

  const isBRL = currency === "BRL";
  const u              = user as any;
  const trialExpired   = u?.trialExpired === true;
  const trialActive    = u?.trialActive  === true;
  const trialDaysLeft  = u?.trialDaysLeft ?? 7;
  const isExpiredParam = typeof window !== "undefined" && window.location.search.includes("expired=1");
  const showExpired    = trialExpired || isExpiredParam;
  const isDesktop      = useIsDesktop();

  const PLANS = useMemo(() => [
    {
      id:       "monthly",
      label:    t("upgrade.monthly"),
      price:    isBRL ? "R$\u00a019,90"  : "$3.99",
      period:   isBRL ? "/mês"           : "/mo",
      sub:      t("upgrade.anchor"),
      badge:    null,
      perMonth: isBRL ? 19.90 : 3.99,
      stripeCurrency: isBRL ? "brl" : "usd",
    },
    {
      id:       "yearly",
      label:    t("upgrade.yearly"),
      price:    isBRL ? "R$\u00a0149,90" : "$29.90",
      period:   isBRL ? "/ano"           : "/yr",
      sub:      isBRL ? "R$\u00a012,49/mês" : "$2.49/mo",
      badge:    isBRL ? t("upgrade.save37") : t("upgrade.save38"),
      perMonth: isBRL ? 12.49 : 2.49,
      stripeCurrency: isBRL ? "brl" : "usd",
    },
  ], [isBRL, t]);

  const BENEFITS_EXPANDED = [
    { icon: TrendingUp,   color: "#00ff88", label: "Análise de lucro real",         sub: "Veja o que sobra no bolso após todos os custos, não só o faturamento." },
    { icon: MapPin,       color: "#60a5fa", label: "Lucro real por km rodado",       sub: "Descubra se cada quilômetro vale realmente a pena." },
    { icon: Timer,        color: "#a78bfa", label: "Lucro real por hora trabalhada", sub: "Saiba quanto você ganha de verdade por hora — sem ilusões." },
    { icon: Target,       color: "#fb923c", label: "Acompanhamento de meta diária",  sub: "Defina quanto quer ganhar e veja seu progresso em tempo real." },
    { icon: BarChart2,    color: "#f472b6", label: "Comparação semanal e mensal",    sub: "Compare semanas e meses automaticamente. Evolua com dados." },
    { icon: Award,        color: "#eab308", label: "Missões inteligentes e XP",      sub: "Gamificação que transforma hábito em evolução consistente." },
    { icon: CalendarDays, color: "#34d399", label: "Projeção mensal de realidade",   sub: "Veja a tempo se o mês vai fechar bem — antes que seja tarde." },
    { icon: Brain,        color: "#c084fc", label: "Decisões melhores todo dia",     sub: "Dados que transformam intuição em inteligência operacional." },
  ];

  const TRUST = useMemo(() => [
    { icon: "🔒", label: t("upgrade.trust1"), sub: t("upgrade.trust1sub") },
    { icon: "🤝", label: t("upgrade.trust2"), sub: t("upgrade.trust2sub") },
    { icon: "⚡", label: t("upgrade.trust3"), sub: t("upgrade.trust3sub") },
  ], [t]);

  const handleCheckout = async () => {
    if (!user) {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      return;
    }
    if (DEV_SKIP_STRIPE_CHECKOUT) {
      setIsLoading(true);
      setError(null);
      try {
        const r = await authFetch(`${BASE}/api/dev/simulate-upgrade`, { method: "POST", credentials: "include" });
        if (!r.ok) throw new Error("simulate failed");
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/?upgraded=1");
      } catch {
        setError(t("upgrade.errorGeneral"));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    const basePath   = import.meta.env.BASE_URL.replace(/\/$/, "");
    const origin     = window.location.origin;
    const successUrl = `${origin}${basePath}/checkout/success`;
    const cancelUrl  = `${origin}${basePath}/checkout/cancel`;

    try {
      const res = await authFetch(`${BASE}/api/create-checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected, successUrl, cancelUrl }),
      });
      if (res.status === 401) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (["stripe_auth", "stripe_invalid", "stripe_error"].includes(data.code)) {
          navigate("/pix-auto");
          return;
        }
        setError("Não foi possível processar o pagamento. Tente via PIX abaixo.");
        return;
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(t("upgrade.errorGeneral"));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Already PRO ──────────────────────────────────────────────────────────────
  if (u?.plan === "pro" && !u?.trialActive && !trialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", gap: 24, padding: "0 24px" }}
      >
        <div style={{ width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg,#eab308,#ca8a04)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 48px rgba(234,179,8,0.3)" }}>
          <Check size={38} color="#000" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb", marginBottom: 6 }}>{t("upgrade.alreadyPro")}</p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{t("upgrade.alreadyProSub")}</p>
        </div>
        <Link href="/">
          <button style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 20px", color: "#f9fafb", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <ArrowLeft size={16} /> {t("upgrade.backToDashboard")}
          </button>
        </Link>
      </motion.div>
    );
  }

  const activePlan = PLANS.find((p) => p.id === selected)!;
  const perDayAmt  = (activePlan.perMonth / 30).toFixed(2);
  const perDayFmt  = isBRL ? `R$${perDayAmt}` : `$${perDayAmt}`;

  return (
    <motion.div
      variants={stagger} initial="hidden" animate="show"
      style={{
        display: "flex", flexDirection: "column", gap: 0, paddingBottom: 60,
        width: "100%",
        maxWidth: isDesktop ? 720 : undefined,
        margin: isDesktop ? "0 auto" : undefined,
      }}
    >

      {/* ── Back ─────────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontFamily: "inherit", padding: 0, fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> {t("upgrade.back")}
        </button>
      </motion.div>

      {/* ── Alerts ───────────────────────────────────────────────────────────── */}
      {showExpired && (
        <motion.div variants={fadeUp} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "10px 14px" }}>
            <AlertTriangle size={14} color="#f87171" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>{t("upgrade.expiredAlert")}</span>
          </div>
        </motion.div>
      )}
      {trialActive && !showExpired && (
        <motion.div variants={fadeUp} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.18)", borderRadius: 12, padding: "10px 14px" }}>
            <Clock size={14} color="#eab308" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#eab308" }}>
              {trialDaysLeft <= 1 ? t("upgrade.trialLastDay") : t("upgrade.trialEndsIn", { days: trialDaysLeft })}
            </span>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 32, position: "relative" }}>

        {/* Ambient glow behind hero */}
        <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", width: 340, height: 200, background: "radial-gradient(ellipse, rgba(0,255,136,0.07) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* PRO badge */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.28)", borderRadius: 20, padding: "6px 14px" }}>
              <motion.div
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308" }}
              />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#eab308", letterSpacing: "0.12em", textTransform: "uppercase" }}>✦ Lucro Driver PRO</span>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: isDesktop ? 36 : 28, fontWeight: 900, lineHeight: 1.15, color: "#f9fafb", letterSpacing: "-0.03em", marginBottom: 14 }}>
            {showExpired ? (
              <span style={{ color: "#00ff88" }}>{t("upgrade.headlineExpired")}</span>
            ) : (
              <>
                Dirija mais inteligente.<br />
                <span style={{ color: "#00ff88" }}>Ganhe mais.</span>{" "}
                Desperdice menos.
              </>
            )}
          </h1>

          {/* Sub */}
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, maxWidth: 500 }}>
            {showExpired
              ? t("upgrade.expiredSub")
              : "Desbloqueie a inteligência completa por trás do seu lucro diário — e pare de trabalhar no escuro."
            }
          </p>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          MAIN VALUE PROP CARD
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <div style={{
          position: "relative", borderRadius: 22, overflow: "hidden",
          background: "linear-gradient(135deg, #0d1a12 0%, #0a0f18 100%)",
          border: "1px solid rgba(0,255,136,0.18)",
          boxShadow: "0 0 60px rgba(0,255,136,0.06) inset, 0 16px 48px rgba(0,0,0,0.5)",
          padding: "24px 20px",
        }}>
          <div style={{ position: "absolute", top: -30, right: -20, width: 220, height: 180, background: "radial-gradient(ellipse, rgba(0,255,136,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>

            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(0,255,136,0.5)", textTransform: "uppercase", marginBottom: 10 }}>
              A diferença que faz tudo mudar
            </p>
            <p style={{ fontSize: isDesktop ? 19 : 17, fontWeight: 900, color: "#f9fafb", lineHeight: 1.3, letterSpacing: "-0.02em", marginBottom: 20 }}>
              Com o PRO você para de adivinhar<br />
              <span style={{ color: "#00ff88" }}>e começa a decidir.</span>
            </p>

            {/* Contrast row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Sem PRO", items: ["Fatura sem saber o lucro", "Horas perdidas invisíveis", "Custos que crescem sozinhos", "Decisões no feeling"], color: "rgba(239,68,68,0.6)", bg: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.15)", prefix: "✗" },
                { label: "Com PRO", items: ["Lucro real por corrida", "Melhor hora para rodar", "Custos sob controle", "Decisões com inteligência"], color: "#00ff88", bg: "rgba(0,255,136,0.05)", border: "rgba(0,255,136,0.15)", prefix: "✓" },
              ].map((col) => (
                <div key={col.label} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 14, padding: "12px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: col.color, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>{col.label}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {col.items.map((item) => (
                      <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ fontSize: 11, color: col.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{col.prefix}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.35 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          BENEFITS — 8 items
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 12 }}>
          Tudo que você desbloqueia
        </p>
        <div style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 22, overflow: "hidden" }}>
          {BENEFITS_EXPANDED.map(({ icon: Icon, color, label, sub }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.055, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                borderBottom: i < BENEFITS_EXPANDED.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: `${color}12`, border: `1px solid ${color}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={17} color={color} strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", lineHeight: 1.4 }}>{sub}</p>
              </div>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Check size={9} color="#00ff88" strokeWidth={3} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          EMOTIONAL PERSUASION
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { emoji: "💡", text: "A maioria dos motoristas olha para o faturamento. O PRO mostra o que realmente fica no bolso." },
            { emoji: "⏱️", text: "Trabalhar mais não é sempre ganhar mais. Os dados mostram o caminho certo." },
            { emoji: "📊", text: "A diferença entre um motorista ocupado e um motorista lucrativo são os dados." },
          ].map((item) => (
            <div
              key={item.emoji}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 14, padding: "14px 16px",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{item.emoji}</span>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, fontStyle: "italic" }}>
                "{item.text}"
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          PLAN SELECTOR
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 10 }}>
          {t("upgrade.choosePlan")}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {PLANS.map((plan) => {
            const active = selected === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id as "monthly" | "yearly")}
                style={{
                  flex: 1, position: "relative",
                  padding: "16px 14px", borderRadius: 18,
                  border: `2px solid ${active ? "#00ff88" : "rgba(255,255,255,0.08)"}`,
                  background: active ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.02)",
                  textAlign: "left", cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                {plan.badge && (
                  <div style={{ position: "absolute", top: -9, right: 12, background: "linear-gradient(135deg,#eab308,#ca8a04)", color: "#000", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 999, letterSpacing: "0.04em" }}>
                    {plan.badge}
                  </div>
                )}
                {active && (
                  <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: "#00ff88", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={10} color="#000" strokeWidth={3} />
                  </div>
                )}
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: active ? "rgba(0,255,136,0.7)" : "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 6 }}>
                  {plan.label}
                </p>
                <p style={{ fontSize: 22, fontWeight: 900, color: active ? "#f9fafb" : "rgba(255,255,255,0.55)", letterSpacing: "-0.02em", marginBottom: 2 }}>
                  {plan.price}
                  <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>{plan.period}</span>
                </p>
                <p style={{ fontSize: 11, color: active ? "rgba(0,255,136,0.65)" : "rgba(255,255,255,0.25)", fontWeight: 500 }}>
                  {plan.sub}
                </p>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          PRICE HIGHLIGHT CARD
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <div style={{
          position: "relative", borderRadius: 22, overflow: "hidden",
          background: "#0e0e0e",
          border: "1px solid rgba(0,255,136,0.15)",
          boxShadow: "0 0 0 1px rgba(0,255,136,0.04) inset, 0 12px 40px rgba(0,0,0,0.45)",
          padding: "22px 20px",
        }}>
          <div style={{ position: "absolute", top: -40, right: -20, width: 200, height: 160, background: "radial-gradient(ellipse,rgba(0,255,136,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 4 }}>{t("upgrade.youPay")}</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={selected}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    style={{ fontSize: 44, fontWeight: 900, color: "#00ff88", letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: "0 0 36px rgba(0,255,136,0.38)" }}
                  >
                    {activePlan.price}
                    <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(0,255,136,0.5)" }}>{activePlan.period}</span>
                  </motion.p>
                </AnimatePresence>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{t("upgrade.perDay")}</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums" }}>{perDayFmt}</p>
              </div>
            </div>

            {/* Less than R$1/day framing */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>💰</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>
                  {isBRL ? "Menos de R$1 por dia" : "Less than $0.15 per day"}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  {isBRL ? "Menos que um café. Impacto de uma consultoria." : "Less than a coffee. Impact of real analytics."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontSize: 16 }}>🚗</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{t("upgrade.anchor")}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{t("upgrade.returnEstimate")}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          CTA BLOCK
      ══════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        style={{
          marginBottom: 24,
          maxWidth: isDesktop ? 680 : undefined,
          marginLeft: isDesktop ? "auto" : undefined,
          marginRight: isDesktop ? "auto" : undefined,
          width: "100%",
        }}
      >
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: isDesktop ? "28px 28px 22px" : "22px 18px 18px",
        }}>

          {/* CTA intro copy */}
          <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>
            Comece hoje a usar inteligência de lucro real —<br />
            <span style={{ color: "rgba(255,255,255,0.75)" }}>a única ferramenta feita para o motorista brasileiro.</span>
          </p>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="cta-error"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#f87171", textAlign: "center", lineHeight: 1.5 }}>
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Primary CTA */}
          <motion.button
            whileTap={{ scale: 0.985 }}
            onClick={handleCheckout}
            disabled={isLoading}
            style={{
              display: "block", width: "100%", height: 68,
              borderRadius: 18, border: "none",
              background: isLoading ? "rgba(0,255,136,0.4)" : "linear-gradient(135deg,#00ff88 0%,#00d974 100%)",
              color: "#000", fontWeight: 900, fontSize: 18, letterSpacing: "-0.01em",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontFamily: "inherit", position: "relative", overflow: "hidden",
              boxShadow: isLoading ? "none" : "0 10px 36px rgba(0,255,136,0.42), 0 2px 10px rgba(0,0,0,0.4)",
              transition: "opacity 0.2s, box-shadow 0.2s",
            }}
          >
            {!isLoading && (
              <motion.span
                aria-hidden
                animate={{ x: ["-110%", "210%"] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 2.2 }}
                style={{ position: "absolute", inset: 0, width: "38%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)", pointerEvents: "none" }}
              />
            )}
            {isLoading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                  style={{ display: "block", width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(0,0,0,0.18)", borderTopColor: "#000" }}
                />
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative" }}>
                <Zap size={20} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                Desbloquear PRO agora
                <ChevronRight size={20} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              </span>
            )}
          </motion.button>

          {/* Reassurance */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "6px 14px", marginTop: 14 }}>
            {["✓ 7 dias grátis", "✓ Sem cobrança agora", "✓ Cancele quando quiser"].map((txt) => (
              <span key={txt} style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", whiteSpace: "nowrap" }}>{txt}</span>
            ))}
          </div>

          {/* PIX */}
          {isBRL && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>ou</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
              </div>
              <button
                onClick={() => navigate("/pix-auto")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "none", border: "none", padding: "4px 0", color: "rgba(255,255,255,0.5)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                <span style={{ fontSize: 15 }}>📲</span>
                {t("upgrade.ctaPix")}
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          AUTHORITY / SOCIAL PROOF
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <div style={{
          borderRadius: 20,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          padding: "20px 18px",
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: 16 }}>Por que o PRO existe</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { icon: "🎯", headline: "Feito para motoristas que querem controle real", body: "Não é para quem quer ver só números — é para quem quer transformar dados em decisões." },
              { icon: "📱", headline: "Criado para o dia a dia do motorista brasileiro", body: "Uber, 99, iFood — cada corrida registrada vira inteligência estratégica no seu bolso." },
              { icon: "📈", headline: "Cada dia registrado tem mais valor", body: "Quanto mais histórico, mais precisa a análise. O PRO cresce com você." },
            ].map((item) => (
              <div key={item.headline} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>{item.headline}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          TRUST BADGES
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {TRUST.map(({ icon, label, sub }) => (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 8px 12px", textAlign: "center" }}
            >
              <p style={{ fontSize: 20, marginBottom: 8, lineHeight: 1 }}>{icon}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", lineHeight: 1.35, marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1.4 }}>{sub}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0 4px" }}>
          <Shield size={12} color="rgba(255,255,255,0.28)" />
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", textAlign: "center" }}>
            {t("upgrade.security")}
          </p>
        </div>
      </motion.div>

    </motion.div>
  );
}
