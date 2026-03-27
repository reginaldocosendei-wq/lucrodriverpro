import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  Camera, Upload, CheckCircle, ChevronLeft, Edit3, Lock,
  Zap, Star, AlertCircle, X, Clock, MapPin, Navigation
} from "lucide-react";
import { analyzeScreenshot, confirmImport, type ExtractedData } from "@/services/importService";

const PLATFORMS = ["Uber", "99", "InDrive", "Outro"];

type Step = "entry" | "instructions" | "upload" | "processing" | "result" | "confirm" | "success" | "locked";

const PROCESSING_MESSAGES = [
  "Lendo seus ganhos...",
  "Identificando corridas...",
  "Buscando km e horas...",
  "Verificando avaliação...",
  "Quase pronto...",
];

const FEATURES = [
  "✓ Importe resultados em 10 segundos",
  "✓ Leitura inteligente de screenshots",
  "✓ Extrai ganhos, km, horas e avaliação",
  "✓ Suporte a Uber, 99 e InDrive",
  "✓ Histórico completo de importações",
  "✓ Relatórios de lucro real",
];

function platformColor(p: string | null) {
  if (!p) return "#6b7280";
  const lower = p.toLowerCase();
  if (lower.includes("uber")) return "#00b4d8";
  if (lower.includes("99")) return "#fbbf24";
  if (lower.includes("indriver")) return "#22c55e";
  return "#a78bfa";
}

function inputStyle(focused?: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 16px",
    background: "#111",
    border: `1px solid ${focused ? "rgba(0,255,136,0.5)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 12,
    color: "#f9fafb",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  };
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "number",
  optional,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: "#9ca3af", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {icon}
        {label}
        {optional && <span style={{ color: "#4b5563", fontSize: 11 }}>(opcional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle(focused)}
        placeholder={placeholder}
        step="any"
      />
    </div>
  );
}

export default function ImportPage() {
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const isPro = me?.plan === "pro";

  const [step, setStep] = useState<Step>("locked");

  useEffect(() => {
    if (isPro && step === "locked") setStep("entry");
  }, [isPro, step]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData>({
    earnings: null, trips: null, platform: null,
    kmDriven: null, hoursWorked: null, rating: null,
  });

  const [editEarnings, setEditEarnings] = useState("");
  const [editTrips, setEditTrips] = useState("");
  const [editPlatform, setEditPlatform] = useState("Uber");
  const [editKm, setEditKm] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editRating, setEditRating] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function applyExtracted(data: ExtractedData) {
    setExtracted(data);
    setEditEarnings(data.earnings?.toFixed(2) ?? "");
    setEditTrips(data.trips?.toString() ?? "");
    setEditPlatform(data.platform || "Uber");
    setEditKm(data.kmDriven?.toFixed(1) ?? "");
    setEditHours(data.hoursWorked?.toFixed(1) ?? "");
    setEditRating(data.rating?.toFixed(1) ?? "");
  }

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("Por favor, envie uma imagem (JPG, PNG, WebP)");
      return;
    }
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
    setStep("processing");

    setProcessingMsg(0);
    let idx = 0;
    msgIntervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, PROCESSING_MESSAGES.length - 1);
      setProcessingMsg(idx);
    }, 900);

    analyzeScreenshot(selectedFile)
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
      await confirmImport({
        earnings: parseFloat(editEarnings),
        trips: parseInt(editTrips),
        platform: editPlatform,
        kmDriven: editKm ? parseFloat(editKm) : null,
        hoursWorked: editHours ? parseFloat(editHours) : null,
        rating: editRating ? parseFloat(editRating) : null,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/daily-summaries"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Não foi possível salvar. Tente novamente.");
      setStep("result");
    }
  };

  const slide = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
    transition: { duration: 0.25, ease: "easeOut" },
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky",
        top: 0,
        background: "#0a0a0a",
        zIndex: 10,
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <ChevronLeft size={22} />
        </button>
        <span style={{ color: "#f9fafb", fontWeight: 600, fontSize: 17 }}>Importar resultados do dia</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 100px" }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide}>

          {/* ── LOCKED ─────────────────────────────────────────────────────── */}
          {step === "locked" && <LockedView onUpgrade={() => navigate("/upgrade")} />}

          {/* ── ENTRY ──────────────────────────────────────────────────────── */}
          {step === "entry" && <EntryView onStart={() => setStep("instructions")} />}

          {/* ── INSTRUCTIONS ───────────────────────────────────────────────── */}
          {step === "instructions" && <InstructionsView onUpload={() => setStep("upload")} />}

          {/* ── UPLOAD ─────────────────────────────────────────────────────── */}
          {step === "upload" && (
            <div>
              <h2 style={{ color: "#f9fafb", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Enviar screenshot</h2>
              <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>
                Selecione o resumo de ganhos do seu aplicativo. Nossa IA extrai ganhos, corridas, km, horas e avaliação automaticamente.
              </p>

              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center",
                  gap: 10, marginBottom: 16, color: "#f87171", fontSize: 14,
                }}>
                  <AlertCircle size={16} /> {error}
                  <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileSelect(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "#00ff88" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 20, padding: "48px 24px", textAlign: "center", cursor: "pointer",
                  background: dragOver ? "rgba(0,255,136,0.04)" : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s",
                }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <Upload size={28} color="#0a0a0a" />
                </div>
                <p style={{ color: "#f9fafb", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Toque para selecionar</p>
                <p style={{ color: "#6b7280", fontSize: 13 }}>ou arraste sua screenshot aqui</p>
                <p style={{ color: "#4b5563", fontSize: 12, marginTop: 12 }}>JPG, PNG, WebP • máx 10MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%", marginTop: 20, padding: "16px", borderRadius: 16, border: "none",
                  background: "linear-gradient(135deg,#00ff88,#00cc6a)", color: "#0a0a0a",
                  fontWeight: 700, fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                <Camera size={20} /> Enviar screenshot
              </button>
            </div>
          )}

          {/* ── PROCESSING ─────────────────────────────────────────────────── */}
          {step === "processing" && (
            <div style={{ textAlign: "center", paddingTop: 40 }}>
              {previewUrl && (
                <div style={{
                  width: 160, height: 120, borderRadius: 16, overflow: "hidden",
                  margin: "0 auto 32px", border: "2px solid rgba(0,255,136,0.2)",
                }}>
                  <img src={previewUrl} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 24px" }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  style={{
                    width: 80, height: 80, borderRadius: "50%",
                    border: "3px solid rgba(0,255,136,0.15)",
                    borderTopColor: "#00ff88",
                    position: "absolute",
                  }}
                />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={24} color="#00ff88" />
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={processingMsg}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  style={{ color: "#f9fafb", fontSize: 18, fontWeight: 600 }}
                >
                  {PROCESSING_MESSAGES[processingMsg]}
                </motion.p>
              </AnimatePresence>
              <p style={{ color: "#6b7280", fontSize: 14, marginTop: 8 }}>Nossa IA está analisando sua screenshot</p>
              <div style={{ marginTop: 32, display: "flex", gap: 6, justifyContent: "center" }}>
                {PROCESSING_MESSAGES.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: i <= processingMsg ? 1 : 0.2, scale: i === processingMsg ? 1.2 : 1 }}
                    style={{ width: 8, height: 8, borderRadius: "50%", background: i <= processingMsg ? "#00ff88" : "#374151" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULT ─────────────────────────────────────────────────────── */}
          {step === "result" && (
            <div>
              <div style={{
                background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: 4, padding: "4px 10px", display: "inline-block", marginBottom: 16,
              }}>
                <span style={{ color: "#00ff88", fontSize: 12, fontWeight: 600 }}>✓ DADOS EXTRAÍDOS DA SCREENSHOT</span>
              </div>
              <h2 style={{ color: "#f9fafb", fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Confira os dados</h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>
                Complete ou corrija os campos que a IA não conseguiu identificar.
              </p>

              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 12, padding: "12px 16px", marginBottom: 16,
                  color: "#f87171", fontSize: 14, display: "flex", alignItems: "center", gap: 10,
                }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {/* Platform selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 8 }}>Plataforma</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditPlatform(p)}
                      style={{
                        padding: "8px 16px", borderRadius: 10, border: "1px solid",
                        borderColor: editPlatform === p ? "#00ff88" : "rgba(255,255,255,0.1)",
                        background: editPlatform === p ? "rgba(0,255,136,0.1)" : "transparent",
                        color: editPlatform === p ? "#00ff88" : "#9ca3af",
                        cursor: "pointer", fontSize: 14, fontWeight: 500,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div style={{ background: "#1a1a1a", borderRadius: 20, padding: 20, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ color: "#f9fafb", fontWeight: 600, fontSize: 15 }}>Dados do dia</p>
                  <div style={{
                    background: platformColor(editPlatform),
                    borderRadius: 6, padding: "3px 10px",
                    color: "#fff", fontSize: 12, fontWeight: 600,
                  }}>{editPlatform}</div>
                </div>

                <Field
                  label="Ganhos totais (R$)"
                  icon={<span style={{ fontSize: 14 }}>💰</span>}
                  value={editEarnings}
                  onChange={setEditEarnings}
                  placeholder="0,00"
                />
                <Field
                  label="Número de corridas"
                  icon={<span style={{ fontSize: 14 }}>🚗</span>}
                  value={editTrips}
                  onChange={setEditTrips}
                  placeholder="0"
                />
                <Field
                  label="Km rodados"
                  icon={<Navigation size={14} color="#9ca3af" />}
                  value={editKm}
                  onChange={setEditKm}
                  placeholder="0.0"
                  optional
                />
                <Field
                  label="Horas trabalhadas"
                  icon={<Clock size={14} color="#9ca3af" />}
                  value={editHours}
                  onChange={setEditHours}
                  placeholder="0.0"
                  optional
                />
                <div style={{ marginBottom: 0 }}>
                  <label style={{ color: "#9ca3af", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Star size={14} color="#eab308" />
                    Avaliação média
                    <span style={{ color: "#4b5563", fontSize: 11 }}>(opcional)</span>
                  </label>
                  <input
                    type="number"
                    value={editRating}
                    onChange={(e) => setEditRating(e.target.value)}
                    style={inputStyle()}
                    placeholder="0.0 a 5.0"
                    step="0.1"
                    min="0"
                    max="5"
                  />
                </div>
              </div>

              {previewUrl && (
                <div style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden", maxHeight: 100, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <img src={previewUrl} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => { setStep("upload"); setError(null); }}
                  style={{
                    flex: 1, padding: "14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: "#9ca3af", fontWeight: 600, fontSize: 15, cursor: "pointer",
                  }}
                >
                  Refazer
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!editEarnings || !editTrips}
                  style={{
                    flex: 2, padding: "14px", borderRadius: 14, border: "none",
                    background: (!editEarnings || !editTrips) ? "#374151" : "linear-gradient(135deg,#00ff88,#00cc6a)",
                    color: (!editEarnings || !editTrips) ? "#6b7280" : "#0a0a0a",
                    fontWeight: 700, fontSize: 15, cursor: (!editEarnings || !editTrips) ? "not-allowed" : "pointer",
                  }}
                >
                  Salvar resumo do dia
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRM (saving) ─────────────────────────────────────────────── */}
          {step === "confirm" && (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  border: "3px solid rgba(0,255,136,0.15)",
                  borderTopColor: "#00ff88",
                  margin: "0 auto 24px",
                }}
              />
              <p style={{ color: "#f9fafb", fontSize: 18, fontWeight: 600 }}>Salvando resumo do dia...</p>
            </div>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────────────────── */}
          {step === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: "center", paddingTop: 40 }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
                boxShadow: "0 0 40px rgba(0,255,136,0.4)",
              }}>
                <CheckCircle size={40} color="#0a0a0a" />
              </div>
              <h2 style={{ color: "#f9fafb", fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Resumo salvo!</h2>
              <p style={{ color: "#9ca3af", fontSize: 15, marginBottom: 12 }}>
                Seus dados do dia foram importados com sucesso.
              </p>
              {editKm && (
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
                  📍 {parseFloat(editKm).toFixed(1)} km rodados
                </p>
              )}
              {editHours && (
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
                  ⏱ {parseFloat(editHours).toFixed(1)} horas trabalhadas
                </p>
              )}
              {editRating && (
                <p style={{ color: "#eab308", fontSize: 13, marginBottom: 4 }}>
                  ⭐ Avaliação: {parseFloat(editRating).toFixed(1)}
                </p>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
                <button
                  onClick={() => { setStep("entry"); setPreviewUrl(null); setEditEarnings(""); setEditTrips(""); setEditKm(""); setEditHours(""); setEditRating(""); }}
                  style={{
                    flex: 1, padding: "14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: "#9ca3af", fontWeight: 600, fontSize: 15, cursor: "pointer",
                  }}
                >
                  Importar outro
                </button>
                <button
                  onClick={() => navigate("/")}
                  style={{
                    flex: 2, padding: "14px", borderRadius: 14, border: "none",
                    background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                    color: "#0a0a0a", fontWeight: 700, fontSize: 15, cursor: "pointer",
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

// ── Sub-components ──────────────────────────────────────────────────────────

function LockedView({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 20 }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: "rgba(234,179,8,0.1)", border: "2px solid rgba(234,179,8,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px",
      }}>
        <Lock size={32} color="#eab308" />
      </div>
      <h2 style={{ color: "#f9fafb", fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Recurso PRO</h2>
      <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
        Importe seus resultados por screenshot e calcule automaticamente R$/km, R$/hora e sua avaliação.
      </p>
      <div style={{ background: "#1a1a1a", borderRadius: 20, padding: 24, marginBottom: 32, textAlign: "left" }}>
        {FEATURES.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#eab308", flexShrink: 0 }} />
            <p style={{ color: "#d1d5db", fontSize: 14 }}>{f}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onUpgrade}
        style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none",
          background: "linear-gradient(135deg,#eab308,#ca8a04)",
          color: "#0a0a0a", fontWeight: 700, fontSize: 16, cursor: "pointer",
        }}
      >
        ✦ Fazer upgrade para PRO
      </button>
    </div>
  );
}

function EntryView({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: "linear-gradient(135deg,#00ff88,#00cc6a)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px",
        boxShadow: "0 0 40px rgba(0,255,136,0.3)",
      }}>
        <Camera size={36} color="#0a0a0a" />
      </div>
      <h2 style={{ color: "#f9fafb", fontWeight: 800, fontSize: 26, marginBottom: 8 }}>Importar resultado do dia</h2>
      <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
        Tire uma screenshot do seu app (Uber, 99 ou InDrive) e nossa IA extrai ganhos, km, horas e avaliação automaticamente.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
        {[
          { icon: "💰", label: "Ganhos" },
          { icon: "🗺️", label: "Km" },
          { icon: "⏱", label: "Horas" },
          { icon: "🚗", label: "Corridas" },
          { icon: "⭐", label: "Avaliação" },
          { icon: "📊", label: "Métricas" },
        ].map((item) => (
          <div key={item.label} style={{
            background: "#1a1a1a", borderRadius: 14, padding: "16px 12px",
            border: "1px solid rgba(255,255,255,0.05)", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
            <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 500 }}>{item.label}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onStart}
        style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none",
          background: "linear-gradient(135deg,#00ff88,#00cc6a)",
          color: "#0a0a0a", fontWeight: 700, fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
      >
        <Camera size={20} /> Começar importação
      </button>
    </div>
  );
}

function InstructionsView({ onUpload }: { onUpload: () => void }) {
  const steps = [
    { n: "1", title: "Abra seu app", desc: "Uber, 99, InDrive — vá até a tela de resumo de ganhos do dia." },
    { n: "2", title: "Tire o print", desc: "Capture a tela com total de ganhos, corridas, km e horas rodados." },
    { n: "3", title: "Envie aqui", desc: "Nossa IA lê todos os dados automaticamente. O que faltar você preenche." },
  ];
  return (
    <div>
      <h2 style={{ color: "#f9fafb", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Como funciona</h2>
      <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 28 }}>3 passos simples para importar seu dia.</p>
      {steps.map((s) => (
        <div key={s.n} style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#00ff88,#00cc6a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#0a0a0a", fontWeight: 800, fontSize: 16,
          }}>{s.n}</div>
          <div>
            <p style={{ color: "#f9fafb", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{s.title}</p>
            <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.5 }}>{s.desc}</p>
          </div>
        </div>
      ))}
      <div style={{
        background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)",
        borderRadius: 16, padding: 16, marginBottom: 28,
      }}>
        <p style={{ color: "#00ff88", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>💡 Dica</p>
        <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5 }}>
          Prints com mais informações visíveis (km, horas, avaliação) geram métricas mais completas. Mas ganhos e corridas são o mínimo necessário.
        </p>
      </div>
      <button
        onClick={onUpload}
        style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none",
          background: "linear-gradient(135deg,#00ff88,#00cc6a)",
          color: "#0a0a0a", fontWeight: 700, fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
      >
        <Upload size={20} /> Selecionar screenshot
      </button>
    </div>
  );
}
