import { useEffect, useMemo, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useIsDesktop } from "@/lib/useBreakpoint";
import {
  Check, ArrowLeft, Shield, Zap, AlertTriangle,
  Clock, ChevronRight, TrendingUp, MapPin, Timer, Award,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { getApiBase } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { DEV_SKIP_STRIPE_CHECKOUT } from "@/lib/dev-flags";

const BASE = getApiBase();

// ─── Animations ───────────────────────────────────────────────────────────────
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
  const { data: user }             = useGetMe();
  const queryClient                = useQueryClient();
  const [, navigate]               = useLocation();
  const [selected, setSelected]    = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading]  = useState(false);
  const [error, setError]          = useState<string | null>(null);
  const { t, currency }            = useT();

  // Clear any stale error whenever this page is (re-)mounted.
  // This prevents a previous failure from showing on the next visit.
  useEffect(() => { setError(null); }, []);

  const isBRL = currency === "BRL";

  const u              = user as any;
  const trialExpired   = u?.trialExpired === true;
  const trialActive    = u?.trialActive  === true;
  const trialDaysLeft  = u?.trialDaysLeft ?? 7;
  const isExpiredParam = typeof window !== "undefined" && window.location.search.includes("expired=1");
  const showExpired    = trialExpired || isExpiredParam;

  const isDesktop = useIsDesktop();

  // ── Dynamic plans by currency ────────────────────────────────────────────────
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

  // ── Benefits ─────────────────────────────────────────────────────────────────
  const BENEFITS = useMemo(() => [
    { icon: TrendingUp, text: t("upgrade.benefit1"), sub: t("upgrade.benefit1sub") },
    { icon: MapPin,     text: t("upgrade.benefit2"), sub: t("upgrade.benefit2sub") },
    { icon: Timer,      text: t("upgrade.benefit3"), sub: t("upgrade.benefit3sub") },
    { icon: Award,      text: t("upgrade.benefit4"), sub: t("upgrade.benefit4sub") },
  ], [t]);

  // ── Trust badges ─────────────────────────────────────────────────────────────
  const TRUST = useMemo(() => [
    { icon: "🔒", label: t("upgrade.trust1"), sub: t("upgrade.trust1sub") },
    { icon: "🤝", label: t("upgrade.trust2"), sub: t("upgrade.trust2sub") },
    { icon: "⚡", label: t("upgrade.trust3"), sub: t("upgrade.trust3sub") },
  ], [t]);

  // ── Stripe checkout ──────────────────────────────────────────────────────────
  const handleUpgrade = async () => {
    // Guard: PrivateGuard guarantees user is loaded before this page renders.
    // If user somehow disappeared (background refetch failure), re-validate.
    if (!user) {
      // Force a fresh auth check — if it fails PrivateGuard will redirect.
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      return;
    }

    // ── Dev bypass: skip Stripe and jump straight to success page ────────────
    if (DEV_SKIP_STRIPE_CHECKOUT) {
      navigate("/checkout/success");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ── Step 1: load products ──────────────────────────────────────────────
      const productsRes  = await fetch(`${BASE}/api/stripe/products-with-prices`, { credentials: "include" });
      if (!productsRes.ok) {
        setError(t("upgrade.errorGeneral"));
        return;
      }
      const productsData = await productsRes.json();
      if (!Array.isArray(productsData.data) || productsData.data.length === 0) {
        setError(t("upgrade.errorNoPlans"));
        return;
      }

      // ── Step 2: resolve price ──────────────────────────────────────────────
      const product    = productsData.data[0];
      const interval   = selected === "monthly" ? "month" : "year";
      const targetCurr = PLANS.find((p) => p.id === selected)?.stripeCurrency ?? (isBRL ? "brl" : "usd");

      // Try exact currency match first, then fall back to any matching interval.
      const price =
        product.prices?.find((p: any) => p.recurring?.interval === interval && p.currency === targetCurr) ??
        product.prices?.find((p: any) => p.recurring?.interval === interval);

      if (!price) {
        setError(t("upgrade.errorNoPlan"));
        return;
      }

      // ── Step 3: create Stripe checkout session ────────────────────────────
      const origin      = window.location.origin;
      const checkoutRes = await fetch(`${BASE}/api/stripe/checkout`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceId:    price.id,
          successUrl: `${origin}${BASE}/checkout/success`,
          cancelUrl:  `${origin}${BASE}/checkout/cancel`,
        }),
      });

      // Session expired while on this page → force re-login.
      if (checkoutRes.status === 401) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/login");
        return;
      }

      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok || !checkoutData.url) {
        // Stripe config error — surface a clear message.
        setError(t("upgrade.errorGeneral"));
        return;
      }

      // ── Step 4: redirect to Stripe-hosted checkout ────────────────────────
      if (Capacitor.isNativePlatform()) {
        window.open(checkoutData.url, "_system");
      } else {
        window.location.href = checkoutData.url;
      }
    } catch {
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
        display: "flex", flexDirection: "column", gap: 0, paddingBottom: 40,
        width: "100%",
        maxWidth: isDesktop ? 720 : undefined,
        margin: isDesktop ? "0 auto" : undefined,
      }}
    >

      {/* ── Back button ─────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontFamily: "inherit", padding: 0, fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> {t("upgrade.back")}
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
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>{t("upgrade.expiredAlert")}</span>
          </div>
        )}

        {/* Trial urgency */}
        {trialActive && !showExpired && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.18)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
            <Clock size={14} color="#eab308" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#eab308" }}>
              {trialDaysLeft <= 1
                ? t("upgrade.trialLastDay")
                : t("upgrade.trialEndsIn", { days: trialDaysLeft })}
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
        <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.2, color: "#f9fafb", letterSpacing: "-0.025em", marginBottom: 12 }}>
          {showExpired
            ? <><span style={{ color: "#00ff88" }}>{t("upgrade.headlineExpired")}</span></>
            : t("upgrade.headline").split(". ").map((part, i, arr) => (
                <span key={i}>
                  {i === 1 ? <span style={{ color: "#00ff88" }}>{part}</span> : part}
                  {i < arr.length - 1 ? ". " : ""}
                </span>
              ))
          }
        </h1>

        {/* Sub */}
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.42)", lineHeight: 1.6 }}>
          {showExpired ? t("upgrade.expiredSub") : t("upgrade.headlineSub")}
        </p>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          PLAN SELECTOR
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
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
                {/* Best value badge */}
                {plan.badge && (
                  <div style={{ position: "absolute", top: -9, right: 12, background: "linear-gradient(135deg,#eab308,#ca8a04)", color: "#000", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 999, letterSpacing: "0.04em" }}>
                    {plan.badge}
                  </div>
                )}

                {/* Active checkmark */}
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
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 4 }}>{t("upgrade.youPay")}</p>
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
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{t("upgrade.perDay")}</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums" }}>
                  {perDayFmt}
                </p>
              </div>
            </div>

            {/* Value anchor */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: 12, padding: "10px 14px" }}>
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
          BENEFITS
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
        <div style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 22, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.04) inset" }}>
          {BENEFITS.map(({ icon: Icon, text, sub }, i) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderBottom: i < BENEFITS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} color="#00ff88" strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 2 }}>{text}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{sub}</p>
              </div>
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
      <motion.div variants={fadeUp} style={{ marginBottom: 14, maxWidth: isDesktop ? 560 : undefined, margin: isDesktop ? "0 auto 14px" : undefined }}>
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
          {/* Shine sweep */}
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
            style={{ position: "absolute", top: 0, bottom: 0, width: "40%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)", pointerEvents: "none" }}
          />

          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              style={{ width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(0,0,0,0.2)", borderTopColor: "#000" }}
            />
          ) : (
            <>
              <span style={{ position: "absolute", left: 22, display: "flex", alignItems: "center", pointerEvents: "none" }}>
                <Zap size={20} strokeWidth={2.5} />
              </span>
              <span style={{ position: "relative" }}>{t("upgrade.cta")}</span>
              <span style={{ position: "absolute", right: 22, display: "flex", alignItems: "center", pointerEvents: "none" }}>
                <ChevronRight size={20} strokeWidth={2.5} />
              </span>
            </>
          )}
        </motion.button>
      </motion.div>

      {/* ── Pix option (BRL only) ────────────────────────────────────────────── */}
      {isBRL && (
        <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
          {/* "ou" divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>ou</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          </div>

          {/* PIX card */}
          <div style={{
            background: "rgba(50,188,173,0.07)",
            border: "1px solid rgba(50,188,173,0.22)",
            borderRadius: 18,
            padding: "14px 16px",
          }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/pix-payment")}
              style={{
                width: "100%", height: 48, borderRadius: 12,
                background: "rgba(50,188,173,0.12)",
                border: "1px solid rgba(50,188,173,0.3)",
                color: "rgba(255,255,255,0.88)",
                fontWeight: 700, fontSize: 13.5,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 17 }}>📲</span>
              {t("upgrade.ctaPix")}
            </motion.button>
            <p style={{ textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 10, lineHeight: 1.5 }}>
              {t("upgrade.pixComingSoon")}
            </p>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TRUST BADGES
      ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          alignItems: "stretch",
          marginBottom: 16,
        }}>
          {TRUST.map(({ icon, label, sub }) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 16,
                padding: "14px 8px 12px",
                textAlign: "center",
                boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
              }}
            >
              <p style={{ fontSize: 21, marginBottom: 8, lineHeight: 1 }}>{icon}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.82)", lineHeight: 1.35, marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.42)", lineHeight: 1.4 }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Security line */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0 4px" }}>
          <Shield size={12} color="rgba(255,255,255,0.32)" />
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", textAlign: "center" }}>
            {t("upgrade.security")}
          </p>
        </div>
      </motion.div>

    </motion.div>
  );
}
