import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ArrowLeft, Shield, Zap, AlertTriangle,
  Clock, ChevronRight, TrendingUp, MapPin, Timer, Award,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { getApiBase } from "@/lib/api";

const BASE = getApiBase();

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BENEFITS = [
  { icon: TrendingUp, text: "Descubra seu lucro real", sub: "Não o faturamento — o que fica no seu bolso" },
  { icon: MapPin,     text: "Evite corridas ruins",    sub: "Saiba quais horários e regiões valem a pena" },
  { icon: Timer,      text: "Saiba quando parar",      sub: "Seu tempo vale dinheiro. Não desperdice." },
  { icon: Award,      text: "Ganhe mais trabalhando menos", sub: "Métricas reais para decisões mais inteligentes" },
];

const TRUST = [
  { icon: "🔒", label: "Cancelamento fácil", sub: "A qualquer momento" },
  { icon: "🤝", label: "Sem compromisso",    sub: "Sem fidelidade" },
  { icon: "⚡", label: "Acesso imediato",    sub: "Na hora do pagamento" },
];

// ─── PLAN CONFIG ──────────────────────────────────────────────────────────────
const PLANS = [
  { id: "monthly", label: "Mensal",  price: "R$\u00a019,90", period: "/mês",  sub: "Menos que uma corrida",  badge: null,           perMonth: 19.90 },
  { id: "yearly",  label: "Anual",   price: "R$\u00a0149,90", period: "/ano", sub: "R$\u00a012,49 por mês",  badge: "Economize 37%", perMonth: 12.49 },
];

// ─── STAGGER ANIMATION ────────────────────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.45 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPGRADE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Upgrade() {
  const { data: user }   = useGetMe();
  const [, navigate]     = useLocation();
  const [selected, setSelected] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const u = user as any;
  const trialExpired   = u?.trialExpired === true;
  const trialActive    = u?.trialActive  === true;
  const trialDaysLeft  = u?.trialDaysLeft ?? 7;
  const isExpiredParam = typeof window !== "undefined" && window.location.search.includes("expired=1");
  const showExpired    = trialExpired || isExpiredParam;

  // ── Stripe checkout ─────────────────────────────────────────────────────────
  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const productsRes  = await fetch(`${BASE}/api/stripe/products-with-prices`, { credentials: "include" });
      const productsData = await productsRes.json();
      if (!productsData.data?.length) {
        setError("Planos não disponíveis no momento. Tente novamente em breve.");
        return;
      }
      const product  = productsData.data[0];
      const interval = selected === "monthly" ? "month" : "year";
      const price    = product.prices?.find((p: any) => p.recurring?.interval === interval);
      if (!price) { setError("Plano não encontrado. Tente novamente."); return; }

      const origin      = window.location.origin;
      const checkoutRes = await fetch(`${BASE}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceId:    price.id,
          successUrl: `${origin}${BASE}/checkout/success`,
          cancelUrl:  `${origin}${BASE}/checkout/cancel`,
        }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.url) {
        setError("Não foi possível iniciar o pagamento. Tente novamente.");
        return;
      }
      if (Capacitor.isNativePlatform()) {
        window.open(checkoutData.url, "_system");
      } else {
        window.location.href = checkoutData.url;
      }
    } catch {
      setError("Não foi possível iniciar o pagamento. Verifique sua conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Already PRO ─────────────────────────────────────────────────────────────
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
          <p style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb", marginBottom: 6 }}>Você já é PRO ✦</p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Todos os recursos estão desbloqueados.</p>
        </div>
        <Link href="/">
          <button style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 20px", color: "#f9fafb", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <ArrowLeft size={16} /> Voltar ao painel
          </button>
        </Link>
      </motion.div>
    );
  }

  const activePlan = PLANS.find((p) => p.id === selected)!;

  return (
    <motion.div
      variants={stagger} initial="hidden" animate="show"
      style={{ display: "flex", flexDirection: "column", gap: 0, paddingBottom: 40 }}
    >

      {/* ── Back button ───────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontFamily: "inherit", padding: 0, fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          HERO HEADER
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 28, position: "relative" }}>

        {/* Expired alert */}
        {showExpired && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
            <AlertTriangle size={14} color="#f87171" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>Seu teste gratuito encerrou</span>
          </div>
        )}

        {/* Trial urgency */}
        {trialActive && !showExpired && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.18)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
            <Clock size={14} color="#eab308" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#eab308" }}>
              {trialDaysLeft <= 1 ? "Último dia de teste!" : `Teste termina em ${trialDaysLeft} dias`}
            </span>
          </div>
        )}

        {/* PRO badge */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", borderRadius: 20, padding: "6px 14px" }}>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308" }}
            />
            <span style={{ fontSize: 10, fontWeight: 800, color: "#eab308", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ✦ Lucro Driver PRO
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 30, fontWeight: 900, lineHeight: 1.2,
          color: "#f9fafb", letterSpacing: "-0.025em",
          marginBottom: 12,
        }}>
          {showExpired
            ? <>Não perca acesso ao<br /><span style={{ color: "#00ff88" }}>seu lucro real</span></>
            : <>Você já trabalhou hoje.<br /><span style={{ color: "#00ff88" }}>Agora veja quanto</span><br />realmente lucrou.</>
          }
        </h1>

        {/* Sub */}
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.42)", lineHeight: 1.6, maxWidth: 300 }}>
          {showExpired
            ? "Você já viu o poder do PRO. Continue tendo acesso a tudo que faz você ganhar mais."
            : "Pare de confundir faturamento com lucro."
          }
        </p>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          PLAN SELECTOR
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 10 }}>
          Escolha seu plano
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
                {/* Best value badge */}
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: -9, right: 12,
                    background: "linear-gradient(135deg,#eab308,#ca8a04)",
                    color: "#000", fontSize: 9, fontWeight: 800,
                    padding: "3px 8px", borderRadius: 999, letterSpacing: "0.04em",
                  }}>
                    {plan.badge}
                  </div>
                )}

                {/* Active checkmark */}
                {active && (
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#00ff88", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
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
          position: "relative", borderRadius: 24, overflow: "hidden",
          background: "#0e0e0e",
          border: "1px solid rgba(0,255,136,0.15)",
          boxShadow: "0 0 0 1px rgba(0,255,136,0.05) inset, 0 12px 40px rgba(0,0,0,0.4)",
          padding: "22px 20px",
        }}>
          {/* Glow */}
          <div style={{ position: "absolute", top: -40, right: -20, width: 200, height: 160, background: "radial-gradient(ellipse,rgba(0,255,136,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 4 }}>Você paga apenas</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={selected}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    style={{ fontSize: 46, fontWeight: 900, color: "#00ff88", letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(0,255,136,0.4)" }}
                  >
                    {activePlan.price}
                    <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(0,255,136,0.55)" }}>{activePlan.period}</span>
                  </motion.p>
                </AnimatePresence>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>por dia</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums" }}>
                  R${(activePlan.perMonth / 30).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Value anchor */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontSize: 16 }}>🚗</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Menos que uma corrida</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>O retorno é de centenas de reais por mês</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          BENEFITS
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
        <div style={{
          background: "#0e0e0e",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.04) inset",
        }}>
          {BENEFITS.map(({ icon: Icon, text, sub }, i) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 18px",
                borderBottom: i < BENEFITS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              {/* Icon container */}
              <div style={{
                width: 40, height: 40, borderRadius: 13, flexShrink: 0,
                background: "rgba(0,255,136,0.08)",
                border: "1px solid rgba(0,255,136,0.14)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={18} color="#00ff88" strokeWidth={2} />
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 2 }}>{text}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{sub}</p>
              </div>

              {/* Check */}
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Check size={10} color="#00ff88" strokeWidth={3} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          ERROR
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#f87171", textAlign: "center" }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MAIN CTA
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleUpgrade}
          disabled={isLoading}
          style={{
            width: "100%", height: 62, borderRadius: 20, border: "none",
            background: isLoading ? "rgba(0,255,136,0.5)" : "#00ff88",
            color: "#000", fontWeight: 900, fontSize: 18,
            cursor: isLoading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: "0 12px 40px rgba(0,255,136,0.35), 0 4px 12px rgba(0,0,0,0.3)",
            fontFamily: "inherit", letterSpacing: "-0.01em",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Shine sweep on hover */}
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
            style={{
              position: "absolute", top: 0, bottom: 0, width: "40%",
              background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
              pointerEvents: "none",
            }}
          />

          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              style={{ width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(0,0,0,0.2)", borderTopColor: "#000" }}
            />
          ) : (
            <>
              <Zap size={20} strokeWidth={2.5} />
              Começar agora
              <ChevronRight size={20} strokeWidth={2.5} style={{ marginLeft: "auto" }} />
            </>
          )}
        </motion.button>
      </motion.div>

      {/* ── Pix option ─────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
        <button
          style={{
            width: "100%", height: 50, borderRadius: 16,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>🔑</span>
          Prefere Pix? Pague em segundos
        </button>
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
          Pix disponível em breve
        </p>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          TRUST BADGES
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {TRUST.map(({ icon, label, sub }) => (
            <div
              key={label}
              style={{
                background: "#0e0e0e",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 18,
                padding: "14px 10px",
                textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <p style={{ fontSize: 22, marginBottom: 6 }}>{icon}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, marginBottom: 3 }}>{label}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.3 }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Security line */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0" }}>
          <Shield size={13} color="rgba(255,255,255,0.2)" />
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
            Pagamento seguro via Stripe · Seus dados estão protegidos
          </p>
        </div>
      </motion.div>

    </motion.div>
  );
}
