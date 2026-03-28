import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  Camera, Upload, CheckCircle, ChevronLeft, Lock,
  AlertCircle, X, Clock, Navigation, Star, RotateCcw,
} from "lucide-react";
import { analyzeScreenshot, confirmImport, type ExtractedData } from "@/services/importService";
import { formatBRL } from "@/lib/utils";
import { DEV_DISABLE_AUTH_FETCH } from "@/lib/dev-flags";
import { ExtraEarningsSection } from "@/components/ExtraEarningsSection";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PLATFORMS = ["Uber", "99", "InDrive", "Outro"];

const PROCESSING_MESSAGES = [
  "Lendo seus ganhos...",
  "Identificando corridas...",
  "Buscando km e horas...",
  "Quase pronto...",
];

type Step = "locked" | "upload" | "processing" | "result" | "confirm" | "success";

function platformColor(p: string) {
  const l = p.toLowerCase();
  if (l.includes("uber")) return "#1dbeff";
  if (l.includes("99")) return "#fbbf24";
  if (l.includes("indriver")) return "#22c55e";
  return "#a78bfa";
}

// ─── SCAN ANIMATION ───────────────────────────────────────────────────────────
function ScanPreview({ src }: { src: string }) {
  return (
    <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: "2px solid rgba(0,255,136,0.25)", boxShadow: "0 0 40px rgba(0,255,136,0.12)" }}>
      <img src={src} alt="screenshot" style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} />

      {/* dark overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", pointerEvents: "none" }} />

      {/* scan line */}
      <motion.div
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute", left: 0, right: 0, height: 3, pointerEvents: "none",
          background: "linear-gradient(90deg, transparent 0%, #00ff88 40%, #00ff88 60%, transparent 100%)",
          boxShadow: "0 0 18px 4px rgba(0,255,136,0.55)",
        }}
      />

      {/* corner brackets */}
      {[
        { top: 12, left: 12, borderTop: "2px solid #00ff88", borderLeft: "2px solid #00ff88" },
        { top: 12, right: 12, borderTop: "2px solid #00ff88", borderRight: "2px solid #00ff88" },
        { bottom: 12, left: 12, borderBottom: "2px solid #00ff88", borderLeft: "2px solid #00ff88" },
        { bottom: 12, right: 12, borderBottom: "2px solid #00ff88", borderRight: "2px solid #00ff88" },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: 20, height: 20, borderRadius: 2, pointerEvents: "none", ...s }} />
      ))}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ImportPage() {
  const [, navigate] = useLocation();
  const { data: me, isPending: authPending } = useGetMe();
  const queryClient = useQueryClient();
  const isPro = me?.plan === "pro";

  const [step, setStep] = useState<Step>(
    DEV_DISABLE_AUTH_FETCH ? "upload" : "locked"
  );
  useEffect(() => {
    if (DEV_DISABLE_AUTH_FETCH) return;
    if (authPending) return;
    if (me && step === "locked") setStep("upload");
  }, [me, authPending, step]);

  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [processingMsg, setProcessingMsg] = useState(0);
  const [wasMerged, setWasMerged]     = useState<boolean>(false);

  // Extracted + editable fields
  const [editEarnings, setEditEarnings] = useState("");
  const [editTrips, setEditTrips]       = useState("");
  const [editPlatform, setEditPlatform] = useState("Uber");
  const [editKm, setEditKm]             = useState("");
  const [editHours, setEditHours]       = useState("");
  const [editRating, setEditRating]     = useState("");
  const [showExtras, setShowExtras]     = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const msgIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  function applyExtracted(data: ExtractedData) {
    setEditEarnings(data.earnings?.toFixed(2) ?? "");
    setEditTrips(data.trips?.toString() ?? "");
    setEditPlatform(data.platform || "Uber");
    setEditKm(data.km?.toFixed(1) ?? "");
    setEditHours(data.hours?.toFixed(1) ?? "");
    setEditRating(data.rating?.toFixed(1) ?? "");
    setShowExtras(!!(data.km || data.hours || data.rating));
  }

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Por favor, envie uma imagem (JPG, PNG, WebP)");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setStep("processing");
    setProcessingMsg(0);
    let idx = 0;
    msgIntervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, PROCESSING_MESSAGES.length - 1);
      setProcessingMsg(idx);
    }, 900);

    analyzeScreenshot(file)
      .then((data) => {
        if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
        applyExtracted(data);
        setStep("result");
      })
      .catch((err) => {
        if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
        setError(err.message || "Não foi possível ler o print. Tente outra imagem.");
        setStep("upload");
      });
  }, []);

  const handleConfirm = async () => {
    setStep("confirm");
    setError(null);
    try {
      const result = await confirmImport({
        earnings: parseFloat(editEarnings),
        trips: parseInt(editTrips),
        platform: editPlatform,
        km: editKm ? parseFloat(editKm) : null,
        hours: editHours ? parseFloat(editHours) : null,
        rating: editRating ? parseFloat(editRating) : null,
      });
      setWasMerged(result.merged);
      await queryClient.invalidateQueries({ queryKey: ["/api/daily-summaries"] });
      await queryClient.invalidateQueries({ queryKey: ["daily-summaries-history"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Não foi possível salvar. Tente novamente.");
      setStep("result");
    }
  };

  function reset() {
    setPreviewUrl(null);
    setEditEarnings(""); setEditTrips(""); setEditKm(""); setEditHours(""); setEditRating("");
    setError(null);
    setStep("upload");
  }

  // ── Shared slide animation ─────────────────────────────────────────────────
  const slide = {
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -14 },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#080808", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "#080808", position: "sticky", top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate("/")}
          style={{
            width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
          }}
        >
          <ChevronLeft size={20} color="rgba(255,255,255,0.6)" />
        </button>
        <span style={{ color: "#f9fafb", fontWeight: 700, fontSize: 16 }}>Importar meu dia</span>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 100px" }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide}>

            {/* ══════════════════════════════════════════════════════════════
                LOCKED / LOADING AUTH
            ══════════════════════════════════════════════════════════════ */}
            {step === "locked" && (
              authPending ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(0,255,136,0.15)", borderTopColor: "#00ff88" }}
                  />
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Carregando...</p>
                </div>
              ) : (
                <LockedView
                  isAuthed={!!me}
                  onUpgrade={() => navigate("/upgrade")}
                  onSignUp={() => navigate("/login")}
                />
              )
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 1 — UPLOAD
            ══════════════════════════════════════════════════════════════ */}
            {step === "upload" && (
              <div>
                {/* Error banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
                      padding: "13px 16px", borderRadius: 14,
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: 13, color: "#fca5a5", flex: 1, lineHeight: 1.5 }}>{error}</p>
                    <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", padding: 0 }}>
                      <X size={14} />
                    </button>
                  </motion.div>
                )}

                {/* Hero upload zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    borderRadius: 28, padding: "52px 24px",
                    textAlign: "center", cursor: "pointer",
                    border: `2px dashed ${dragOver ? "#00ff88" : "rgba(255,255,255,0.09)"}`,
                    background: dragOver ? "rgba(0,255,136,0.04)" : "rgba(255,255,255,0.015)",
                    transition: "all 0.2s ease",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  {/* Ambient glow */}
                  <div style={{
                    position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
                    width: 300, height: 200, pointerEvents: "none",
                    background: "radial-gradient(ellipse, rgba(0,255,136,0.09) 0%, transparent 70%)",
                  }} />

                  {/* Camera icon with pulse */}
                  <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 24px" }}>
                    <motion.div
                      animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.1, 0.25] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      style={{
                        position: "absolute", inset: -10, borderRadius: "50%",
                        background: "rgba(0,255,136,0.15)", pointerEvents: "none",
                      }}
                    />
                    <div style={{
                      width: 80, height: 80, borderRadius: "50%",
                      background: "linear-gradient(135deg, #00ff88, #00cc6a)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 12px 36px rgba(0,255,136,0.3)",
                      position: "relative",
                    }}>
                      <Camera size={34} color="#000" strokeWidth={1.8} />
                    </div>
                  </div>

                  <p style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", marginBottom: 8, letterSpacing: "-0.01em" }}>
                    Selecionar screenshot
                  </p>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, maxWidth: 240, margin: "0 auto" }}>
                    do Uber, 99 ou InDrive com o resumo do seu dia
                  </p>

                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 20 }}>
                    JPG, PNG, WebP · toque ou arraste
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/*"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />

                {/* CTA button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%", height: 58, marginTop: 16, borderRadius: 18, border: "none",
                    background: "#00ff88", color: "#000",
                    fontWeight: 900, fontSize: 17, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    boxShadow: "0 10px 32px rgba(0,255,136,0.32)",
                    fontFamily: "inherit",
                  }}
                >
                  <Upload size={20} strokeWidth={2.5} />
                  Enviar screenshot
                </motion.button>

                {/* Tip */}
                <div style={{
                  marginTop: 20, borderRadius: 16,
                  background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)",
                  padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                    Abra o Uber, 99 ou InDrive, vá até o <strong style={{ color: "rgba(255,255,255,0.5)" }}>resumo de ganhos do dia</strong> e tire uma captura de tela.
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 2 — PROCESSING
            ══════════════════════════════════════════════════════════════ */}
            {step === "processing" && (
              <div style={{ paddingTop: 12 }}>
                {/* Screenshot with scan animation */}
                {previewUrl && (
                  <div style={{ marginBottom: 32 }}>
                    <ScanPreview src={previewUrl} />
                  </div>
                )}

                {/* Spinner + message */}
                <div style={{ textAlign: "center" }}>
                  {/* Orbital spinner */}
                  <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 24px" }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                      style={{
                        position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
                        border: "2.5px solid rgba(0,255,136,0.12)",
                        borderTopColor: "#00ff88",
                      }}
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{
                        position: "absolute", inset: 8, borderRadius: "50%", pointerEvents: "none",
                        border: "2px solid rgba(0,255,136,0.07)",
                        borderBottomColor: "rgba(0,255,136,0.5)",
                      }}
                    />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <span style={{ fontSize: 20 }}>🔍</span>
                    </div>
                  </div>

                  {/* Cycling message */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={processingMsg}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.01em", marginBottom: 6 }}
                    >
                      {PROCESSING_MESSAGES[processingMsg]}
                    </motion.p>
                  </AnimatePresence>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>
                    Nossa IA está analisando sua screenshot
                  </p>

                  {/* Progress dots */}
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    {PROCESSING_MESSAGES.map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          opacity: i <= processingMsg ? 1 : 0.2,
                          scale: i === processingMsg ? 1.25 : 1,
                          background: i <= processingMsg ? "#00ff88" : "#374151",
                        }}
                        transition={{ duration: 0.3 }}
                        style={{ width: 8, height: 8, borderRadius: "50%", background: "#374151" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 3 — RESULT
            ══════════════════════════════════════════════════════════════ */}
            {step === "result" && (
              <div>
                {/* Error banner */}
                {error && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
                    padding: "13px 16px", borderRadius: 14,
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  }}>
                    <AlertCircle size={15} color="#f87171" />
                    <p style={{ fontSize: 13, color: "#fca5a5", flex: 1 }}>{error}</p>
                  </div>
                )}

                {/* Success chip */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, gap: 8 }}
                >
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.22)",
                    borderRadius: 20, padding: "6px 14px",
                  }}>
                    <CheckCircle size={13} color="#00ff88" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#00ff88", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Leitura concluída
                    </span>
                  </div>
                </motion.div>

                {/* Platform selector */}
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 10 }}>
                    Plataforma
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {PLATFORMS.map((p) => {
                      const active = editPlatform === p;
                      const c = platformColor(p);
                      return (
                        <button
                          key={p}
                          onClick={() => setEditPlatform(p)}
                          style={{
                            flex: 1, padding: "9px 6px", borderRadius: 12, border: "1px solid",
                            borderColor: active ? c : "rgba(255,255,255,0.08)",
                            background: active ? `${c}15` : "rgba(255,255,255,0.02)",
                            color: active ? c : "rgba(255,255,255,0.35)",
                            cursor: "pointer", fontSize: 12, fontWeight: 700,
                            transition: "all 0.18s ease", fontFamily: "inherit",
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── RESULT CARD ──────────────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    background: "#0e0e0e",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 24, overflow: "hidden",
                    marginBottom: 16, position: "relative",
                  }}
                >
                  {/* Top glow */}
                  <div style={{
                    position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
                    width: 260, height: 120, pointerEvents: "none",
                    background: "radial-gradient(ellipse, rgba(0,255,136,0.1) 0%, transparent 70%)",
                  }} />

                  {/* Screenshot thumbnail strip */}
                  {previewUrl && (
                    <div style={{ height: 72, overflow: "hidden", position: "relative" }}>
                      <img src={previewUrl} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(14,14,14,0) 0%, #0e0e0e 100%)", pointerEvents: "none" }} />
                    </div>
                  )}

                  <div style={{ padding: "20px 20px 24px", position: "relative", zIndex: 2 }}>
                    {/* Two main stats side by side */}
                    <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>

                      {/* Earnings */}
                      <div style={{
                        flex: 1, background: "rgba(0,255,136,0.05)",
                        border: "1px solid rgba(0,255,136,0.15)",
                        borderRadius: 18, padding: "18px 16px",
                        position: "relative",
                      }}>
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 6 }}>
                          Ganhos
                        </p>
                        {editEarnings ? (
                          <p style={{ fontSize: 30, fontWeight: 900, color: "#00ff88", fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em", textShadow: "0 0 24px rgba(0,255,136,0.4)" }}>
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(editEarnings))}
                          </p>
                        ) : (
                          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Não detectado</p>
                        )}
                        {/* Inline edit */}
                        <input
                          type="number"
                          value={editEarnings}
                          onChange={(e) => setEditEarnings(e.target.value)}
                          step="0.01"
                          placeholder="0.00"
                          style={{
                            marginTop: 10, width: "100%", padding: "7px 10px", borderRadius: 9,
                            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.6)", fontSize: 12, outline: "none",
                            boxSizing: "border-box" as const, fontFamily: "inherit",
                          }}
                        />
                      </div>

                      {/* Trips */}
                      <div style={{
                        flex: 1, background: "rgba(96,165,250,0.05)",
                        border: "1px solid rgba(96,165,250,0.15)",
                        borderRadius: 18, padding: "18px 16px",
                      }}>
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 6 }}>
                          Corridas
                        </p>
                        {editTrips ? (
                          <p style={{ fontSize: 30, fontWeight: 900, color: "#60a5fa", fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>
                            {editTrips}
                          </p>
                        ) : (
                          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Não detectado</p>
                        )}
                        <input
                          type="number"
                          value={editTrips}
                          onChange={(e) => setEditTrips(e.target.value)}
                          placeholder="0"
                          style={{
                            marginTop: 10, width: "100%", padding: "7px 10px", borderRadius: 9,
                            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.6)", fontSize: 12, outline: "none",
                            boxSizing: "border-box" as const, fontFamily: "inherit",
                          }}
                        />
                      </div>
                    </div>

                    {/* R$/corrida derived stat */}
                    {editEarnings && editTrips && parseFloat(editTrips) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 14px",
                          border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Média por corrida</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", fontVariantNumeric: "tabular-nums" }}>
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(editEarnings) / parseFloat(editTrips))}
                        </span>
                      </motion.div>
                    )}

                    {/* Optional fields toggle */}
                    <button
                      onClick={() => setShowExtras((v) => !v)}
                      style={{
                        width: "100%", padding: "10px 0", background: "transparent", border: "none",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 6, color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600,
                        fontFamily: "inherit",
                      }}
                    >
                      <span>{showExtras ? "▲" : "▼"}</span>
                      {showExtras ? "Ocultar" : "Editar"} km · horas · avaliação
                    </button>

                    <AnimatePresence>
                      {showExtras && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                              { label: "Km rodados", icon: <Navigation size={13} />, value: editKm, set: setEditKm, placeholder: "0.0" },
                              { label: "Horas trabalhadas", icon: <Clock size={13} />, value: editHours, set: setEditHours, placeholder: "0.0" },
                              { label: "Avaliação (0–5)", icon: <Star size={13} color="#eab308" />, value: editRating, set: setEditRating, placeholder: "0.0" },
                            ].map(({ label, icon, value, set, placeholder }) => (
                              <div key={label}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginBottom: 6 }}>
                                  {icon}{label} <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>opcional</span>
                                </label>
                                <input
                                  type="number"
                                  value={value}
                                  onChange={(e) => set(e.target.value)}
                                  placeholder={placeholder}
                                  step="0.1"
                                  style={{
                                    width: "100%", padding: "10px 14px", borderRadius: 11,
                                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)",
                                    color: "#f9fafb", fontSize: 14, outline: "none",
                                    boxSizing: "border-box" as const, fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={reset}
                    style={{
                      width: 52, height: 52, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <RotateCcw size={18} color="rgba(255,255,255,0.4)" />
                  </button>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleConfirm}
                    disabled={!editEarnings || !editTrips}
                    style={{
                      flex: 1, height: 52, borderRadius: 16, border: "none",
                      background: (!editEarnings || !editTrips) ? "rgba(255,255,255,0.06)" : "#00ff88",
                      color: (!editEarnings || !editTrips) ? "rgba(255,255,255,0.3)" : "#000",
                      fontWeight: 900, fontSize: 16, cursor: (!editEarnings || !editTrips) ? "not-allowed" : "pointer",
                      boxShadow: (!editEarnings || !editTrips) ? "none" : "0 8px 28px rgba(0,255,136,0.3)",
                      transition: "all 0.2s ease",
                      fontFamily: "inherit",
                    }}
                  >
                    Confirmar
                  </motion.button>
                </div>

                {(!editEarnings || !editTrips) && (
                  <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>
                    Preencha ganhos e corridas para confirmar
                  </p>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                CONFIRM (saving)
            ══════════════════════════════════════════════════════════════ */}
            {step === "confirm" && (
              <div style={{ textAlign: "center", paddingTop: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <div style={{ position: "relative", width: 64, height: 64 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                    style={{
                      position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
                      border: "3px solid rgba(0,255,136,0.15)", borderTopColor: "#00ff88",
                    }}
                  />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <span style={{ fontSize: 22 }}>💾</span>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb", marginBottom: 4 }}>Salvando resumo...</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Aguarde um momento</p>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SUCCESS
            ══════════════════════════════════════════════════════════════ */}
            {step === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{ textAlign: "center", paddingTop: 32 }}
              >
                {/* Success icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 12, stiffness: 200 }}
                  style={{
                    width: 88, height: 88, borderRadius: "50%",
                    background: "linear-gradient(135deg, #00ff88, #00cc6a)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 28px",
                    boxShadow: "0 0 60px rgba(0,255,136,0.4)",
                  }}
                >
                  <CheckCircle size={44} color="#000" strokeWidth={2} />
                </motion.div>

                <p style={{ fontSize: 28, fontWeight: 900, color: "#f9fafb", marginBottom: 8, letterSpacing: "-0.02em" }}>
                  {wasMerged ? "Somado com sucesso!" : "Resumo salvo!"}
                </p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: wasMerged ? 12 : 32, lineHeight: 1.55 }}>
                  {wasMerged
                    ? "Os valores foram somados ao registro existente deste dia."
                    : "Seus dados do dia foram importados com sucesso."
                  }
                </p>
                {wasMerged && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.14)",
                    borderRadius: 12, padding: "9px 14px", marginBottom: 24,
                  }}>
                    <span style={{ fontSize: 13 }}>➕</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#eab308" }}>
                      Ganhos e corridas somados ao dia
                    </span>
                  </div>
                )}

                {/* Mini recap */}
                <div style={{
                  background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20, padding: "18px 20px", marginBottom: 28,
                  display: "flex", justifyContent: "center", gap: 32,
                }}>
                  <div>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Ganhos</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: "#00ff88", fontVariantNumeric: "tabular-nums" }}>
                      {editEarnings ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(editEarnings)) : "—"}
                    </p>
                  </div>
                  <div style={{ width: 1, background: "rgba(255,255,255,0.07)" }} />
                  <div>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Corridas</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>
                      {editTrips || "—"}
                    </p>
                  </div>
                </div>

                {/* Extra earnings */}
                <ExtraEarningsSection
                  date={new Date().toISOString().slice(0, 10)}
                  appEarnings={parseFloat(editEarnings) || 0}
                />

                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button
                    onClick={reset}
                    style={{
                      flex: 1, height: 52, borderRadius: 16, border: "1px solid rgba(255,255,255,0.09)",
                      background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.55)",
                      fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Importar outro
                  </button>
                  <button
                    onClick={() => navigate("/")}
                    style={{
                      flex: 2, height: 52, borderRadius: 16, border: "none",
                      background: "#00ff88", color: "#000",
                      fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
                      boxShadow: "0 8px 24px rgba(0,255,136,0.28)",
                    }}
                  >
                    Ver painel
                  </button>
                </div>
              </motion.div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── LOCKED VIEW ──────────────────────────────────────────────────────────────
const FEATURES = [
  "Importe resultados em 10 segundos",
  "IA extrai ganhos, km, horas e avaliação",
  "Suporte a Uber, 99 e InDrive",
  "Histórico completo de importações",
];

function LockedView({
  isAuthed,
  onUpgrade,
  onSignUp,
}: {
  isAuthed: boolean;
  onUpgrade: () => void;
  onSignUp: () => void;
}) {
  return (
    <div style={{ textAlign: "center", paddingTop: 16 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: isAuthed ? "rgba(234,179,8,0.1)" : "rgba(0,255,136,0.08)",
        border: `1px solid ${isAuthed ? "rgba(234,179,8,0.25)" : "rgba(0,255,136,0.2)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px",
        boxShadow: isAuthed ? "0 0 32px rgba(234,179,8,0.12)" : "0 0 32px rgba(0,255,136,0.08)",
      }}>
        <Lock size={30} color={isAuthed ? "#eab308" : "#00ff88"} />
      </div>

      <p style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb", marginBottom: 8, letterSpacing: "-0.01em" }}>
        {isAuthed ? "Recurso PRO" : "Importe seus ganhos"}
      </p>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 28, maxWidth: 280, margin: "0 auto 28px" }}>
        {isAuthed
          ? "Importe screenshots do Uber, 99 e InDrive. Nossa IA extrai todos os dados automaticamente."
          : "Crie sua conta grátis e teste por 7 dias. Nossa IA lê seu print e preenche tudo automaticamente."}
      </p>

      <div style={{
        background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "20px 20px", marginBottom: 24, textAlign: "left",
      }}>
        {FEATURES.map((f, i) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < FEATURES.length - 1 ? 14 : 0 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 7,
              background: isAuthed ? "rgba(234,179,8,0.12)" : "rgba(0,255,136,0.08)",
              border: `1px solid ${isAuthed ? "rgba(234,179,8,0.2)" : "rgba(0,255,136,0.15)"}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 11 }}>✓</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>{f}</p>
          </div>
        ))}
      </div>

      {isAuthed ? (
        <button
          onClick={onUpgrade}
          style={{
            width: "100%", height: 56, borderRadius: 18, border: "none",
            background: "linear-gradient(135deg, #eab308, #ca8a04)",
            color: "#000", fontWeight: 900, fontSize: 16, cursor: "pointer",
            boxShadow: "0 10px 32px rgba(234,179,8,0.28)", fontFamily: "inherit",
          }}
        >
          ✦ Fazer upgrade para PRO
        </button>
      ) : (
        <button
          onClick={onSignUp}
          style={{
            width: "100%", height: 56, borderRadius: 18, border: "none",
            background: "#00ff88",
            color: "#000", fontWeight: 900, fontSize: 16, cursor: "pointer",
            boxShadow: "0 10px 32px rgba(0,255,136,0.25)", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          Criar conta grátis
        </button>
      )}

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 14 }}>
        7 dias grátis · Cancele quando quiser
      </p>
    </div>
  );
}
