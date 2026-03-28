import { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input, Label } from "@/components/ui";
import { Mail, Lock, User, ArrowRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/lib/i18n";

// ─── AUTH FORM ────────────────────────────────────────────────────────────────
function AuthForm({ defaultMode }: { defaultMode: "login" | "register" }) {
  const { t } = useT();
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [errorMsg, setErrorMsg] = useState("");
  const queryClient = useQueryClient();
  const loginMutation    = useLogin();
  const registerMutation = useRegister();

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
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
      onError:   (err: any) => { setErrorMsg(err?.response?.data?.error || t("auth.loginError")); },
    });
  });

  const onRegister = registerForm.handleSubmit((data) => {
    setErrorMsg("");
    registerMutation.mutate({ data }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
      onError:   (err: any) => { setErrorMsg(err?.response?.data?.error || t("auth.registerError")); },
    });
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block",
  };

  return (
    <div style={{ width: "100%" }}>
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
    </div>
  );
}

// ─── MAIN AUTH SCREEN ─────────────────────────────────────────────────────────
export default function AuthScreen() {
  const { t } = useT();
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"login" | "register">("register");

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


      <AnimatePresence mode="wait">
        {!showForm ? (
          /* ── Landing ── */
          <motion.div
            key="landing"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "0 28px", textAlign: "center", position: "relative", zIndex: 2,
            }}
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ marginBottom: 32, position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: 20, overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                position: "relative", zIndex: 1,
              }}>
                <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="Lucro Driver"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{ fontSize: "clamp(32px, 10vw, 46px)", fontWeight: 900, lineHeight: 1.1, color: "#f9fafb", letterSpacing: "-0.025em", marginBottom: 14, wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "100%" }}
            >
              {t("auth.tagline").split(" ").slice(0, -1).join(" ")}<br />
              <span style={{ color: "#00ff88" }}>
                {t("auth.tagline").split(" ").slice(-1)[0]}
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.65, color: "rgba(255,255,255,0.52)", marginBottom: 24, maxWidth: 320 }}
            >
              {t("auth.subtitle")}
            </motion.p>

            {/* Proof line */}
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.36, duration: 0.4 }}
              style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500, letterSpacing: "0.01em", marginBottom: 36 }}
            >
              7 dias grátis · Sem cartão necessário
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.44, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: "100%", maxWidth: 340 }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setFormMode("register"); setShowForm(true); }}
                style={{
                  width: "100%", height: 58, borderRadius: 18, border: "none",
                  background: "#00ff88", color: "#000",
                  fontWeight: 900, fontSize: 17, letterSpacing: "-0.02em",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  boxShadow: "0 4px 20px rgba(0,255,136,0.2)",
                  fontFamily: "inherit",
                }}
              >
                {t("auth.cta")}
                <ArrowRight size={20} strokeWidth={2.5} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setFormMode("login"); setShowForm(true); }}
                style={{
                  marginTop: 12, width: "100%", height: 50, borderRadius: 14,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: 15,
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em",
                }}
              >
                {t("auth.alreadyHaveAccount")}
              </motion.button>
            </motion.div>

            {/* Trust */}
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              style={{ marginTop: 28, fontSize: 11, color: "rgba(255,255,255,0.28)", letterSpacing: "0.03em" }}
            >
              {t("auth.trustLine")}
            </motion.p>
          </motion.div>

        ) : (

          /* ── Form panel ── */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
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
            <div style={{
              width: "100%", maxWidth: 380,
              background: "#111111",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 24, padding: "28px 24px 24px",
            }}>
              <AuthForm defaultMode={formMode} />
            </div>

            {/* Back link */}
            <button
              onClick={() => setShowForm(false)}
              style={{
                marginTop: 20, background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              }}
            >
              <ChevronDown size={13} />
              {t("auth.goBack")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
