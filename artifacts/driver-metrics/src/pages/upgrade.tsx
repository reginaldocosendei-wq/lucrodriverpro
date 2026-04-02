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
  const [location, navigate]       = useLocation();
  const [selected, setSelected]    = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading]  = useState(false);
  const [error, setError]          = useState<string | null>(null);
  const { t, currency }            = useT();

  // Clear error on every navigation to this page — handles both fresh mounts
  // and SPA re-visits where the component may have stayed in the tree.
  useEffect(() => { setError(null); }, [location]);

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

  // ── Simple checkout — fixed monthly price via /api/create-checkout ───────────
  const handleCheckout = async () => {
    if (!user) {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      return;
    }

    if (DEV_SKIP_STRIPE_CHECKOUT) {
      setIsLoading(true);
      setError(null);
      try {
        const r = await fetch(`${BASE}/api/dev/simulate-upgrade`, {
          method: "POST",
          credentials: "include",
        });
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
    console.log("[handleCheckout] start — userId:", (user as any)?.id, "currency:", currency);

    // Confirmed Stripe price IDs for the monthly plan
    const PRICE_BRL = "price_1TEbgtDnebKxBIG0kxMNHyH5";
    const priceId   = PRICE_BRL; // use BRL price; for USD Stripe will handle conversion

    // Dynamic success/cancel URLs — use the current origin so they work in
    // both the Replit dev environment and the production domain.
    const basePath   = import.meta.env.BASE_URL.replace(/\/$/, "");
    const origin     = window.location.origin;
    const successUrl = `${origin}${basePath}/checkout/success`;
    const cancelUrl  = `${origin}${basePath}/checkout/cancel`;

    try {
      const res = await fetch(`${BASE}/api/create-checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, successUrl, cancelUrl }),
      });

      if (res.status === 401) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/login");
        return;
      }

      const data = await res.json();
      console.log("[handleCheckout] response:", res.status, data?.code ?? "(ok)");

      if (!res.ok || !data.url) {
        // Any Stripe configuration/auth error → redirect silently to PIX.
        // Never expose technical error messages to the user.
        if (
          data.code === "stripe_auth" ||
          data.code === "stripe_invalid" ||
          data.code === "stripe_error"
        ) {
          navigate("/pix-auto");
          return;
        }
        setError("Não foi possível processar o pagamento. Tente via PIX abaixo.");
        return;
      }

      console.log("[handleCheckout] → redirecting to Stripe checkout");
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[handleCheckout] fetch error:", msg);
      setError(t("upgrade.errorGeneral"));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Full dynamic checkout — fetches prices from Stripe (keeps existing logic) ─
  const handleUpgrade = async () => {
    if (!user) {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      return;
    }

    // ── Dev-only bypass: skips Stripe and activates PRO instantly ────────────
    // Controlled by DEV_SKIP_STRIPE_CHECKOUT in dev-flags.ts — must be false in prod.
    if (DEV_SKIP_STRIPE_CHECKOUT) {
      setIsLoading(true);
      setError(null);
      try {
        const r = await fetch(`${BASE}/api/dev/simulate-upgrade`, {
          method: "POST",
          credentials: "include",
        });
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

    // ── Production path: real Stripe Checkout ─────────────────────────────────
    setIsLoading(true);
    setError(null);
    console.log("[upgrade] start — plan:", selected, "userId:", (user as any)?.id);

    try {
      // Step 1: load products + prices from backend
      const productsRes = await fetch(`${BASE}/api/stripe/products-with-prices`, {
        credentials: "include",
      });
      if (!productsRes.ok) {
        const errBody = await productsRes.json().catch(() => ({}));
        if (
          errBody?.code === "stripe_auth" ||
          errBody?.code === "stripe_invalid" ||
          errBody?.code === "stripe_error"
        ) {
          navigate("/pix-auto");
          return;
        }
        setError("Não foi possível processar o pagamento. Tente via PIX abaixo.");
        return;
      }
      const { data: products } = await productsRes.json() as { data: any[] };
      if (!Array.isArray(products) || products.length === 0) {
        setError(t("upgrade.errorNoPlans"));
        return;
      }

      // Step 2: match price to selected plan + user currency
      const product     = products[0];
      const interval    = selected === "monthly" ? "month" : "year";
      const targetCurr  = PLANS.find((p) => p.id === selected)?.stripeCurrency ?? (isBRL ? "brl" : "usd");
      const price =
        product.prices?.find((p: any) => p.recurring?.interval === interval && p.currency === targetCurr) ??
        product.prices?.find((p: any) => p.recurring?.interval === interval);
      if (!price) {
        setError(t("upgrade.errorNoPlan"));
        return;
      }
      console.log("[upgrade] resolved price:", price.id, "interval:", interval, "currency:", targetCurr);

      // Step 3: create Stripe Checkout session
      const origin     = window.location.origin;
      const basePath   = import.meta.env.BASE_URL.replace(/\/$/, "");
      const checkoutRes = await fetch(`${BASE}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceId:    price.id,
          successUrl: `${origin}${basePath}/checkout/success`,
          cancelUrl:  `${origin}${basePath}/checkout/cancel`,
        }),
      });

      if (checkoutRes.status === 401) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        navigate("/login");
        return;
      }

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.url) {
        if (
          checkoutData.code === "stripe_auth" ||
          checkoutData.code === "stripe_invalid" ||
          checkoutData.code === "stripe_error"
        ) {
          navigate("/pix-auto");
          return;
        }
        setError("Não foi possível processar o pagamento. Tente via PIX abaixo.");
        return;
      }

      // Step 4: hand off to Stripe-hosted checkout
      console.log("[upgrade] → redirecting to Stripe checkout");
      window.location.href = checkoutData.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[upgrade] error:", msg);
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
          CTA BLOCK — error · primary button · PIX
      ══════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        style={{
          marginBottom: 28,
          maxWidth: isDesktop ? 680 : undefined,
          marginLeft: isDesktop ? "auto" : undefined,
          marginRight: isDesktop ? "auto" : undefined,
          width: "100%",
        }}
      >
        {/* Card shell */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: isDesktop ? "28px 28px 22px" : "22px 18px 18px",
        }}>

          {/* Error — injected above button only after a real failure */}
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
                <div style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 12, padding: "11px 14px",
                  fontSize: 13, color: "#f87171", textAlign: "center", lineHeight: 1.5,
                }}>
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Primary button ─────────────────────────────────────────── */}
          {/* Monthly plan → handleCheckout (fixed price, fast path)      */}
          {/* Yearly plan  → handleUpgrade  (dynamic price lookup)         */}
          <motion.button
            whileTap={{ scale: 0.985 }}
            onClick={selected === "monthly" ? handleCheckout : handleUpgrade}
            disabled={isLoading}
            style={{
              display: "block",
              width: "100%",
              height: 66,
              borderRadius: 18,
              border: "none",
              background: isLoading
                ? "rgba(0,255,136,0.4)"
                : "linear-gradient(135deg,#00ff88 0%,#00d974 100%)",
              color: "#000",
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: "-0.01em",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              position: "relative",
              overflow: "hidden",
              boxShadow: isLoading
                ? "none"
                : "0 10px 36px rgba(0,255,136,0.4), 0 2px 10px rgba(0,0,0,0.4)",
              transition: "opacity 0.2s, box-shadow 0.2s",
            }}
          >
            {/* Shine sweep */}
            {!isLoading && (
              <motion.span
                aria-hidden
                animate={{ x: ["-110%", "210%"] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 2.2 }}
                style={{
                  position: "absolute", inset: 0, width: "38%",
                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",
                  pointerEvents: "none",
                }}
              />
            )}

            {isLoading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                  style={{
                    display: "block", width: 22, height: 22, borderRadius: "50%",
                    border: "2.5px solid rgba(0,0,0,0.18)", borderTopColor: "#000",
                  }}
                />
              </span>
            ) : (
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 10, position: "relative",
              }}>
                <Zap size={20} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                {t("upgrade.cta")}
                <ChevronRight size={20} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              </span>
            )}
          </motion.button>

          {/* Reassurance row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            flexWrap: "wrap", gap: "6px 14px",
            marginTop: 14,
          }}>
            {["✓ 7 dias grátis", "✓ Sem cobrança agora", "✓ Cancele quando quiser"].map((txt) => (
              <span key={txt} style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", whiteSpace: "nowrap" }}>
                {txt}
              </span>
            ))}
          </div>

          {/* ── PIX — secondary (BRL only) ─────────────────────────────── */}
          {isBRL && (
            <>
              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
                }}>ou</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
              </div>

              {/* PIX link — text-level, not a competing CTA */}
              <button
                onClick={() => navigate("/pix-auto")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  width: "100%", background: "none", border: "none", padding: "4px 0",
                  color: "rgba(255,255,255,0.5)", fontSize: 13.5, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 15 }}>📲</span>
                {t("upgrade.ctaPix")}
              </button>
            </>
          )}

        </div>{/* /card shell */}
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          TRUST BADGES — supporting, not competing
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
