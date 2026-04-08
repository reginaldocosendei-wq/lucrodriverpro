import { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GoogleLogin } from "@react-oauth/google";
import { Input, Label } from "@/components/ui";
import { Mail, Lock, User, ArrowRight, ChevronLeft, Zap, Check, TrendingDown, BarChart3, Clock, Fuel, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/lib/i18n";
import { useLocation } from "wouter";

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const VITE_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

// ─── AUTH FORM ────────────────────────────────────────────────────────────────
function AuthForm({
  defaultMode,
  onSuccess,
  onBack,
}: {
  defaultMode: "login" | "register";
  onSuccess?: () => void;
  onBack?: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [errorMsg, setErrorMsg] = useState("");
  const queryClient = useQueryClient();
  const loginMutation    = useLogin();
  const registerMutation = useRegister();

  const googleMutation = useMutation({
    mutationFn: async (credential: string) => {
      const res = await fetch(`${VITE_API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t("auth.googleError"));
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      onSuccess?.();
    },
    onError: (err: any) => {
      setErrorMsg(err.message ?? t("auth.googleError"));
    },
  });

  const loginSchema = z.object({
    email:    z.string().email(t("auth.invalidEmail")),
    password: z.string().min(6, t("auth.passwordTooShort")),
  });
  const registerSchema = loginSchema.extend({
    name: z.string().min(2, t("auth.nameRequired")),
  });

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onLogin = loginForm.handleSubmit((data) => {
    setErrorMsg("");
    loginMutation.mutate({ data }, {
      onSuccess: async () => {
        // refetchQueries (not resetQueries) waits for the network round-trip
        // to complete before resolving. That guarantees the user object is in
        // the React Query cache BEFORE navigate("/") fires, so HomeRoute sees
        // an authenticated user immediately and never flashes the landing page.
        await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
        onSuccess?.();
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.response?.data?.error || t("auth.loginError");
        console.debug("[AuthForm] login error:", msg);
        setErrorMsg(msg);
      },
    });
  });

  const onRegister = registerForm.handleSubmit((data) => {
    setErrorMsg("");
    console.debug("[AuthForm] submitting register", { email: data.email });
    registerMutation.mutate({ data }, {
      onSuccess: async () => {
        await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
        onSuccess?.();
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.response?.data?.error || t("auth.registerError");
        console.debug("[AuthForm] register error:", msg);
        setErrorMsg(msg);
      },
    });
  });

  const isPending = loginMutation.isPending || registerMutation.isPending || googleMutation.isPending;

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block",
  };

  return (
    <div style={{ width: "100%" }}>

      {/* Google login button — only shown when VITE_GOOGLE_CLIENT_ID is configured */}
      {VITE_GOOGLE_CLIENT_ID && (
        <>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <GoogleLogin
              theme="filled_black"
              size="large"
              shape="rectangular"
              width={330}
              text="continue_with"
              onSuccess={(response) => {
                if (response.credential) {
                  setErrorMsg("");
                  googleMutation.mutate(response.credential);
                }
              }}
              onError={() => setErrorMsg(t("auth.googleError"))}
            />
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "0.04em" }}>
              {t("auth.orDivider")}
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>
        </>
      )}

      {/* Tab switcher */}
      <div style={{
        display: "flex", background: "rgba(255,255,255,0.04)",
        borderRadius: 14, padding: 4, marginBottom: 24,
        border: "1px solid rgba(255,255,255,0.07)",
      }}>
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setErrorMsg(""); }}
            style={{
              flex: 1, padding: "11px 0", fontSize: 13, fontWeight: 700,
              borderRadius: 11, border: "none", cursor: "pointer",
              transition: "all 0.2s ease",
              background: mode === m ? "#00ff88" : "transparent",
              color: mode === m ? "#000" : "rgba(255,255,255,0.4)",
              boxShadow: "none",
              fontFamily: "inherit",
            }}
          >
            {m === "login" ? t("auth.tabLogin") : t("auth.tabRegister")}
          </button>
        ))}
      </div>

      {/* Error */}
      {errorMsg && (
        <div style={{
          marginBottom: 18, padding: "12px 14px", borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 13, color: "#fca5a5", fontWeight: 500, textAlign: "center",
        }}>
          {errorMsg}
        </div>
      )}

      {/* Forms */}
      <AnimatePresence mode="wait">
        {mode === "login" ? (
          <motion.form
            key="login"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={onLogin}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <Label style={labelStyle}>{t("auth.labelEmail")}</Label>
              <Input type="email" icon={<Mail size={17} />} placeholder={t("auth.placeholderEmail")} {...loginForm.register("email")} />
              {loginForm.formState.errors.email && (
                <p style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>{loginForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label style={labelStyle}>{t("auth.labelPassword")}</Label>
              <Input type="password" icon={<Lock size={17} />} placeholder="••••••" {...loginForm.register("password")} />
            </div>
            <button
              type="submit" disabled={isPending}
              style={{
                marginTop: 6, width: "100%", height: 52, borderRadius: 14, border: "none",
                background: "#00ff88", color: "#000", fontWeight: 800, fontSize: 15,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 28px rgba(0,255,136,0.3)", transition: "opacity 0.2s",
                fontFamily: "inherit",
              }}
            >
              {isPending ? t("auth.btnLoginLoading") : t("auth.btnLogin")}
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="register"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={onRegister}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <Label style={labelStyle}>{t("auth.labelName")}</Label>
              <Input type="text" icon={<User size={17} />} placeholder={t("auth.placeholderName")} {...registerForm.register("name")} />
              {registerForm.formState.errors.name && (
                <p style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>{registerForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <Label style={labelStyle}>{t("auth.labelEmail")}</Label>
              <Input type="email" icon={<Mail size={17} />} placeholder={t("auth.placeholderEmail")} {...registerForm.register("email")} />
              {registerForm.formState.errors.email && (
                <p style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>{registerForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label style={labelStyle}>{t("auth.labelPassword")}</Label>
              <Input type="password" icon={<Lock size={17} />} placeholder={t("auth.placeholderPassword")} {...registerForm.register("password")} />
              {registerForm.formState.errors.password && (
                <p style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>{registerForm.formState.errors.password.message}</p>
              )}
            </div>
            <button
              type="submit" disabled={isPending}
              style={{
                marginTop: 6, width: "100%", height: 52, borderRadius: 14, border: "none",
                background: "#00ff88", color: "#000", fontWeight: 800, fontSize: 15,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 28px rgba(0,255,136,0.3)", transition: "opacity 0.2s",
                fontFamily: "inherit",
              }}
            >
              {isPending ? t("auth.btnRegisterLoading") : t("auth.btnRegister")}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Trial note */}
      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 18, lineHeight: 1.6 }}>
        {t("auth.trialNote")}
      </p>

      {/* Back link */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            marginTop: 20, background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
            color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            width: "100%", justifyContent: "center",
          }}
        >
          <ChevronLeft size={13} />
          {t("auth.goBack")}
        </button>
      )}
    </div>
  );
}

// ─── MAIN AUTH SCREEN ─────────────────────────────────────────────────────────
// Props:
//   startWithForm — when true (e.g. on the /login route), skip the landing and
//                   show the login/register form immediately.
//   onSuccess     — called after a successful login or registration so the
//                   caller can navigate away (e.g. LoginRoute → navigate("/")).
export default function AuthScreen({
  startWithForm = false,
  onSuccess,
}: {
  startWithForm?: boolean;
  onSuccess?: () => void;
}) {
  const { t } = useT();
  const [, navigate] = useLocation();


  if (startWithForm) {
    // ── Form-only view (used on /login route) ───────────────────────────────
    return (
      <div style={{
        minHeight: "100dvh", background: "#080808",
        display: "flex", flexDirection: "column",
        position: "relative",
      }}>
        {/* Top glow */}
        <div style={{
          position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
          width: 500, height: 400, pointerEvents: "none",
          background: "radial-gradient(ellipse, rgba(0,255,136,0.07) 0%, transparent 65%)",
        }} />

        <div
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center",
            position: "relative", zIndex: 2,
            padding: "32px 24px calc(32px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Logo + brand */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            style={{ textAlign: "center", marginBottom: 24 }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 13, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 24px rgba(0,255,136,0.15)", margin: "0 auto 12px" }}>
              <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="Lucro Driver" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
            </div>
            <p style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb", letterSpacing: "-0.02em", margin: 0 }}>
              Lucro <span style={{ color: "#00ff88" }}>Driver</span>
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontWeight: 500, marginTop: 4 }}>
              {t("auth.appSubtitle")}
            </p>
          </motion.div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: "100%", maxWidth: 380,
              background: "#111111",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 24, padding: "28px 24px 24px",
            }}
          >
            <AuthForm
              defaultMode="login"
              onSuccess={onSuccess}
              onBack={() => navigate("/")}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Landing view (used on "/" when unauthenticated) ─────────────────────────
  return (
    <div style={{ background: "#060808", color: "#f9fafb", fontFamily: "inherit", overflowX: "hidden" }}>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        minHeight: "100dvh", position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "env(safe-area-inset-top, 24px) 24px 48px",
        textAlign: "center",
      }}>
        {/* Ambient glows */}
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 600, height: 420, background: "radial-gradient(ellipse, rgba(0,255,136,0.1) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, right: -100, width: 400, height: 320, background: "radial-gradient(ellipse, rgba(0,100,60,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 480 }}>

          {/* Logo + brand name */}
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}
          >
            <motion.div
              animate={{ boxShadow: ["0 0 0 0 rgba(0,255,136,0)", "0 0 32px 8px rgba(0,255,136,0.22)", "0 0 0 0 rgba(0,255,136,0)"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 68, height: 68, borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 14 }}
            >
              <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="Lucro Driver" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
            </motion.div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Lucro <span style={{ color: "#00ff88" }}>Driver</span>
            </p>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: "clamp(28px, 8.5vw, 48px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 18, color: "#f9fafb" }}
          >
            Quanto dinheiro você está{" "}
            <span style={{ color: "#00ff88", textShadow: "0 0 24px rgba(0,255,136,0.4)" }}>perdendo</span>{" "}
            por dia como motorista?
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: "clamp(14px, 4vw, 17px)", fontWeight: 500, lineHeight: 1.65, color: "rgba(255,255,255,0.48)", marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}
          >
            A maioria dos motoristas acha que lucra…{" "}
            <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>mas perde até 30% sem perceber.</span>
          </motion.p>

          {/* Social proof counter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.34, duration: 0.4 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 30 }}
          >
            <div style={{ display: "flex" }}>
              {[0,1,2,3,4].map((i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: `hsl(${140 + i * 8},70%,45%)`, border: "2px solid #060808", marginLeft: i > 0 ? -7 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.4)" }} />
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.01em" }}>
              +3.000 motoristas já aumentaram seus lucros
            </span>
          </motion.div>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: "100%", maxWidth: 380, margin: "0 auto" }}
          >
            <motion.button
              whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}
              onClick={() => navigate("/import")}
              animate={{ boxShadow: ["0 4px 20px rgba(0,255,136,0.32)", "0 8px 40px rgba(0,255,136,0.52)", "0 4px 20px rgba(0,255,136,0.32)"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: "100%", height: 62, borderRadius: 20, border: "none",
                background: "linear-gradient(135deg, #00ff88 0%, #00d974 100%)",
                color: "#000", fontWeight: 900, fontSize: 17, letterSpacing: "-0.02em",
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              <Zap size={19} strokeWidth={2.5} />
              Ver meu lucro real agora
              <ArrowRight size={19} strokeWidth={2.5} />
            </motion.button>

            <button
              onClick={() => navigate("/login")}
              style={{
                marginTop: 12, width: "100%", height: 50, borderRadius: 14,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 15,
                cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em",
              }}
            >
              Já tenho uma conta — Entrar
            </button>

            {/* Micro trust */}
            <p style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: "0.04em", textAlign: "center" }}>
              7 dias grátis · Sem cartão de crédito · Cancele quando quiser
            </p>
          </motion.div>

        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 24, height: 38, borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 6 }}
          >
            <div style={{ width: 3, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.25)" }} />
          </motion.div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — PROBLEM
          ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: "72px 24px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 400, background: "radial-gradient(ellipse, rgba(239,68,68,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Section eyebrow */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <div style={{ width: 24, height: 1.5, background: "rgba(239,68,68,0.5)" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(239,68,68,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>O Problema</span>
              <div style={{ width: 24, height: 1.5, background: "rgba(239,68,68,0.5)" }} />
            </div>

            <h2 style={{ fontSize: "clamp(22px, 6vw, 32px)", fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.025em", marginBottom: 12, color: "#f9fafb" }}>
              Você está trabalhando…<br />
              <span style={{ color: "#fca5a5" }}>mas realmente lucrando?</span>
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 36 }}>
              A maioria dos motoristas opera no escuro — sem saber quanto realmente fica no bolso no final do dia.
            </p>
          </motion.div>

          {/* Pain point cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { icon: <Fuel size={18} color="#f87171" />, title: "Custo do combustível oculto", desc: "Você sabe quanto cada km realmente custa? Sem calcular, você está aceitando corridas que dão prejuízo." },
              { icon: <Clock size={18} color="#fb923c" />, title: "Tempo desperdiçado ignorado", desc: "Horas em trânsito, esperas longas, horários errados — tudo reduz seu lucro por hora sem você perceber." },
              { icon: <TrendingDown size={18} color="#fca5a5" />, title: "Corridas ruins aceitas", desc: "Sem dados, você não sabe quais corridas valem a pena. O resultado: trabalho duro que não se converte em lucro." },
            ].map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14, textAlign: "left",
                  background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)",
                  borderLeft: "3px solid rgba(239,68,68,0.4)",
                  borderRadius: 16, padding: "16px 18px",
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {p.icon}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb", marginBottom: 4, letterSpacing: "-0.01em" }}>{p.title}</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — SOLUTION
          ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: "72px 24px", position: "relative" }}>
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(0,255,136,0.07) 0%, transparent 68%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: "center", marginBottom: 36 }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <div style={{ width: 24, height: 1.5, background: "rgba(0,255,136,0.5)" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(0,255,136,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>A Solução</span>
              <div style={{ width: 24, height: 1.5, background: "rgba(0,255,136,0.5)" }} />
            </div>
            <h2 style={{ fontSize: "clamp(22px, 6vw, 32px)", fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.025em", marginBottom: 12, color: "#f9fafb" }}>
              O Lucro Driver mostra seu lucro{" "}
              <span style={{ color: "#00ff88", textShadow: "0 0 20px rgba(0,255,136,0.35)" }}>REAL</span>{" "}
              em segundos
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>
              Pare de operar no escuro. Tome decisões baseadas em dados reais, não em suposições.
            </p>
          </motion.div>

          {/* Benefit cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
            {[
              { icon: <BarChart3 size={18} color="#00ff88" />, title: "Cálculo de lucro real", desc: "Veja exatamente quanto sobrou depois de combustível, tempo e custos. O número que realmente importa.", highlight: true },
              { icon: <Target size={18} color="#00ff88" />, title: "Decisões mais inteligentes", desc: "Saiba quais corridas e horários são mais lucrativos. Trabalhe menos e ganhe mais." },
              { icon: <TrendingDown size={18} color="#00ff88" style={{ transform: "rotate(180deg)" }} />, title: "Acompanhe seu desempenho diário", desc: "Histórico completo de evolução. Compare semanas, identifique tendências, bata suas metas." },
            ].map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14, textAlign: "left",
                  background: b.highlight ? "rgba(0,255,136,0.05)" : "rgba(0,255,136,0.03)",
                  border: b.highlight ? "1px solid rgba(0,255,136,0.18)" : "1px solid rgba(0,255,136,0.08)",
                  borderLeft: "3px solid rgba(0,255,136,0.4)",
                  borderRadius: 16, padding: "16px 18px",
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {b.icon}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                    <Check size={12} color="#00ff88" strokeWidth={3} />
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.01em" }}>{b.title}</p>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Inline CTA after solution */}
          <motion.button
            initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.45 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/import")}
            style={{
              width: "100%", height: 58, borderRadius: 18, border: "none",
              background: "linear-gradient(135deg, #00ff88 0%, #00d974 100%)",
              color: "#000", fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 6px 28px rgba(0,255,136,0.3)",
            }}
          >
            <Zap size={17} strokeWidth={2.5} />
            Ver meu lucro real agora
          </motion.button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — SOCIAL PROOF / TESTIMONIALS
          ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: "72px 0 72px", position: "relative" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            style={{ textAlign: "center", marginBottom: 28, padding: "0 24px" }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <div style={{ width: 24, height: 1.5, background: "rgba(234,179,8,0.5)" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(234,179,8,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Resultados Reais</span>
              <div style={{ width: 24, height: 1.5, background: "rgba(234,179,8,0.5)" }} />
            </div>
            <h2 style={{ fontSize: "clamp(20px, 5.5vw, 28px)", fontWeight: 900, lineHeight: 1.2, letterSpacing: "-0.02em", color: "#f9fafb" }}>
              Motoristas já usando o Lucro Driver
            </h2>
          </motion.div>

          <div style={{
            display: "flex", gap: 14, overflowX: "auto", padding: "4px 24px 16px",
            scrollSnapType: "x mandatory", msOverflowStyle: "none", scrollbarWidth: "none",
          }}>
            {[
              {
                quote: "Parei de pegar corridas ruins e aumentei meu lucro.",
                full: "Sempre achei que trabalhar mais horas era a solução. O Lucro Driver me mostrou que estava errado — o problema era quais corridas eu aceitava.",
                author: "Carlos M.", role: "Motorista Uber há 3 anos",
              },
              {
                quote: "Achava que ganhava bem… estava errado.",
                full: "Quando vi meu lucro real pela primeira vez, fiquei em choque. Gastava mais com combustível do que imaginava. Em 2 semanas mudei minha rotina.",
                author: "Rafael S.", role: "Motorista 99 e Uber",
              },
              {
                quote: "Esse app mudou como trabalho todo dia.",
                full: "Agora sei exatamente quais horários e regiões me dão mais retorno. Trabalho menos horas e ganho mais. Simples assim.",
                author: "André P.", role: "Motorista App há 2 anos",
              },
            ].map(({ quote, full, author, role }) => (
              <motion.div
                key={author}
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ duration: 0.4 }}
                style={{
                  flexShrink: 0, width: 260, scrollSnapAlign: "center",
                  background: "linear-gradient(160deg, #0e1410 0%, #080808 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 22, padding: "20px 18px 18px",
                  textAlign: "left", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                {/* Stars */}
                <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
                  {[0,1,2,3,4].map((i) => (
                    <svg key={i} width="13" height="13" viewBox="0 0 12 12" fill="#eab308">
                      <path d="M6 1l1.3 2.6L10 4l-2 1.9.5 2.7L6 7.3 3.5 8.6 4 5.9 2 4l2.7-.4z"/>
                    </svg>
                  ))}
                </div>
                {/* Pull-quote */}
                <p style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", lineHeight: 1.3, marginBottom: 10, letterSpacing: "-0.015em" }}>
                  "{quote}"
                </p>
                {/* Full quote */}
                <p style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,0.42)", fontWeight: 400, marginBottom: 16, fontStyle: "italic" }}>
                  {full}
                </p>
                {/* Author */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,100,60,0.15))", border: "1px solid rgba(0,255,136,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#00ff88" }}>{author[0]}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.01em" }}>{author}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Rating summary */}
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.45 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20, padding: "0 24px" }}
          >
            <div style={{ display: "flex", gap: 3 }}>
              {[0,1,2,3,4].map((i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 12 12" fill="#eab308">
                  <path d="M6 1l1.3 2.6L10 4l-2 1.9.5 2.7L6 7.3 3.5 8.6 4 5.9 2 4l2.7-.4z"/>
                </svg>
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
              4.9 · Mais de 3.000 motoristas satisfeitos
            </span>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — URGENCY + FINAL CTA
          ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: "72px 24px calc(72px + env(safe-area-inset-bottom, 0px))", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 500, background: "radial-gradient(ellipse, rgba(0,255,136,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 420, margin: "0 auto", position: "relative", zIndex: 1 }}>

          {/* Urgency badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.45 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24 }}
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88" }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(0,255,136,0.7)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Cada dia sem rastrear = dinheiro perdido
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.55 }}
            style={{ fontSize: "clamp(26px, 7vw, 38px)", fontWeight: 900, lineHeight: 1.12, letterSpacing: "-0.028em", marginBottom: 16, color: "#f9fafb" }}
          >
            Comece hoje.{" "}
            <span style={{ color: "#00ff88", textShadow: "0 0 20px rgba(0,255,136,0.35)" }}>Cada dia sem rastrear</span>{" "}
            é dinheiro perdido.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.1 }}
            style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 36 }}
          >
            Motoristas que rastreiam seus dados ganham em média{" "}
            <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>27% mais</span>{" "}
            do que os que operam no escuro.
          </motion.p>

          {/* Final CTA block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            <motion.button
              whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}
              onClick={() => navigate("/import")}
              style={{
                width: "100%", height: 64, borderRadius: 22, border: "none",
                background: "linear-gradient(135deg, #00ff88 0%, #00d974 100%)",
                color: "#000", fontWeight: 900, fontSize: 18, letterSpacing: "-0.025em",
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: "0 8px 40px rgba(0,255,136,0.38)",
                marginBottom: 14,
              }}
            >
              <Zap size={20} strokeWidth={2.5} />
              Começar grátis agora
            </motion.button>

            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: "0.01em", marginBottom: 32 }}>
              7 dias grátis · Sem cartão de crédito
            </p>

            {/* Trust row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
              {["Cancele quando quiser", "Acesso imediato", "Feito para motoristas"].map((label) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Check size={11} color="rgba(0,255,136,0.5)" strokeWidth={3} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Already have account */}
          <button
            onClick={() => navigate("/login")}
            style={{
              marginTop: 24, background: "none", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, color: "rgba(255,255,255,0.28)",
              textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.15)",
              padding: "6px 0",
            }}
          >
            Já tenho uma conta
          </button>
        </div>
      </div>

    </div>
  );
}
