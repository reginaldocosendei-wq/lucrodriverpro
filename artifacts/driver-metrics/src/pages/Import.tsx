import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  Camera, Upload, CheckCircle, ChevronLeft, Edit3, Lock,
  Zap, Star, Image as ImageIcon, AlertCircle, X
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLATFORMS = ["Uber", "99", "InDrive", "Outro"];

type Step = "entry" | "instructions" | "upload" | "processing" | "result" | "confirm" | "success" | "locked";

interface Extracted {
  earnings: number | null;
  trips: number | null;
  platform: string | null;
}

const PROCESSING_MESSAGES = [
  "Lendo seus ganhos...",
  "Identificando valor total...",
  "Contando as corridas...",
  "Quase pronto...",
];

const FEATURES = [
  "✓ Importe resultados em 10 segundos",
  "✓ Leitura inteligente de screenshots",
  "✓ Suporte a Uber, 99 e InDrive",
  "✓ Histórico completo de importações",
  "✓ Relatórios de lucro real",
  "✓ Simulador de metas",
];

function platformColor(p: string | null) {
  if (!p) return "#6b7280";
  const lower = p.toLowerCase();
  if (lower.includes("uber")) return "#00b4d8";
  if (lower.includes("99")) return "#fbbf24";
  if (lower.includes("indriver")) return "#22c55e";
  return "#a78bfa";
}

export default function ImportPage() {
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const isPro = me?.plan === "pro";

  const [step, setStep] = useState<Step>(isPro ? "entry" : "locked");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<Extracted>({ earnings: null, trips: null, platform: null });
  const [editEarnings, setEditEarnings] = useState("");
  const [editTrips, setEditTrips] = useState("");
  const [editPlatform, setEditPlatform] = useState("Uber");
  const [isEditing, setIsEditing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("Por favor, envie uma imagem (JPG, PNG, WebP)");
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
    setStep("processing");
    startProcessing(selectedFile);
  }, []);

  const startProcessing = async (f: File) => {
    setProcessingMsg(0);
    let idx = 0;
    msgIntervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, PROCESSING_MESSAGES.length - 1);
      setProcessingMsg(idx);
    }, 900);

    try {
      const formData = new FormData();
      formData.append("screenshot", f);

      const response = await fetch(`${BASE}/api/import/analyze`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao analisar imagem");
        setStep("upload");
        return;
      }

      const data: Extracted = await response.json();
      setExtracted(data);
      setEditEarnings(data.earnings?.toFixed(2) ?? "");
      setEditTrips(data.trips?.toString() ?? "");
      setEditPlatform(data.platform || "Uber");
      setStep("result");
    } catch {
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
      setError("Erro de conexão. Tente novamente.");
      setStep("upload");
    }
  };

  const handleConfirm = async () => {
    setStep("confirm");
    try {
      const response = await fetch(`${BASE}/api/import/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          earnings: parseFloat(editEarnings),
          trips: parseInt(editTrips),
          platform: editPlatform,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Erro ao salvar");
        setStep("result");
        return;
      }

      setStep("success");
    } catch {
      setError("Erro de conexão. Tente novamente.");
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
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <ChevronLeft size={22} />
        </button>
        <span style={{ color: "#f9fafb", fontWeight: 600, fontSize: 17 }}>Importar resultados</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 100px" }}>
        <AnimatePresence mode="wait">

          {/* LOCKED */}
          {step === "locked" && (
            <motion.div key="locked" {...slide}>
              <LockedView onUpgrade={() => navigate("/upgrade")} />
            </motion.div>
          )}

          {/* ENTRY */}
          {step === "entry" && (
            <motion.div key="entry" {...slide}>
              <EntryView onStart={() => setStep("instructions")} />
            </motion.div>
          )}

          {/* INSTRUCTIONS */}
          {step === "instructions" && (
            <motion.div key="instructions" {...slide}>
              <InstructionsView onUpload={() => setStep("upload")} />
            </motion.div>
          )}

          {/* UPLOAD */}
          {step === "upload" && (
            <motion.div key="upload" {...slide}>
              <div>
                <h2 style={{ color: "#f9fafb", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Enviar screenshot</h2>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>
                  Selecione a imagem do resumo de ganhos do seu aplicativo
                </p>

                {error && (
                  <div style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 16,
                    color: "#f87171",
                    fontSize: 14,
                  }}>
                    <AlertCircle size={16} />
                    {error}
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
                    borderRadius: 20,
                    padding: "48px 24px",
                    textAlign: "center",
                    cursor: "pointer",
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
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%",
                    marginTop: 20,
                    padding: "16px",
                    borderRadius: 16,
                    border: "none",
                    background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                    color: "#0a0a0a",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Camera size={20} />
                  Enviar screenshot
                </button>
              </div>
            </motion.div>
          )}

          {/* PROCESSING */}
          {step === "processing" && (
            <motion.div key="processing" {...slide}>
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
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Zap size={24} color="#00ff88" />
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.p
                    key={processingMsg}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    style={{ color: "#f9fafb", fontSize: 18, fontWeight: 600 }}
                  >
                    {PROCESSING_MESSAGES[processingMsg]}
                  </motion.p>
                </AnimatePresence>

                <p style={{ color: "#6b7280", fontSize: 14, marginTop: 8 }}>
                  Nossa IA está analisando sua screenshot
                </p>

                <div style={{ marginTop: 32, display: "flex", gap: 6, justifyContent: "center" }}>
                  {PROCESSING_MESSAGES.map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: i <= processingMsg ? 1 : 0.2, scale: i === processingMsg ? 1.2 : 1 }}
                      style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: i <= processingMsg ? "#00ff88" : "#374151",
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* RESULT */}
          {step === "result" && (
            <motion.div key="result" {...slide}>
              <div>
                <div style={{
                  background: "rgba(0,255,136,0.06)",
                  border: "1px solid rgba(0,255,136,0.2)",
                  borderRadius: 4,
                  padding: "4px 10px",
                  display: "inline-block",
                  marginBottom: 16,
                }}>
                  <span style={{ color: "#00ff88", fontSize: 12, fontWeight: 600 }}>✓ ENCONTRAMOS SEUS RESULTADOS</span>
                </div>

                <h2 style={{ color: "#f9fafb", fontWeight: 700, fontSize: 22, marginBottom: 24 }}>
                  Confira os dados
                </h2>

                {error && (
                  <div style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 12, padding: "12px 16px", marginBottom: 16,
                    color: "#f87171", fontSize: 14, display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                {!isEditing ? (
                  <div style={{
                    background: "#1a1a1a",
                    borderRadius: 20,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 20,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <div style={{
                        background: platformColor(editPlatform),
                        borderRadius: 8,
                        padding: "4px 12px",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                      }}>
                        {editPlatform}
                      </div>
                      <button
                        onClick={() => setIsEditing(true)}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 12px",
                          color: "#9ca3af",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                        }}
                      >
                        <Edit3 size={13} />
                        Editar
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div style={{
                        background: "rgba(0,255,136,0.04)",
                        borderRadius: 16,
                        padding: 20,
                        border: "1px solid rgba(0,255,136,0.12)",
                      }}>
                        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>💰 Ganhos</p>
                        <p style={{ color: "#00ff88", fontSize: 24, fontWeight: 800 }}>
                          R${parseFloat(editEarnings || "0").toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      <div style={{
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 16,
                        padding: 20,
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>🚗 Corridas</p>
                        <p style={{ color: "#f9fafb", fontSize: 24, fontWeight: 800 }}>{editTrips}</p>
                      </div>
                    </div>

                    {previewUrl && (
                      <div style={{
                        marginTop: 16,
                        borderRadius: 12,
                        overflow: "hidden",
                        maxHeight: 120,
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <img src={previewUrl} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: "#1a1a1a",
                    borderRadius: 20,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 20,
                  }}>
                    <h3 style={{ color: "#f9fafb", fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Editar valores</h3>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>
                        Ganhos totais (R$)
                      </label>
                      <input
                        type="number"
                        value={editEarnings}
                        onChange={(e) => setEditEarnings(e.target.value)}
                        style={{
                          width: "100%", padding: "12px 16px", background: "#111",
                          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                          color: "#f9fafb", fontSize: 16, outline: "none",
                          boxSizing: "border-box",
                        }}
                        placeholder="0,00"
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 6 }}>
                        Número de corridas
                      </label>
                      <input
                        type="number"
                        value={editTrips}
                        onChange={(e) => setEditTrips(e.target.value)}
                        style={{
                          width: "100%", padding: "12px 16px", background: "#111",
                          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                          color: "#f9fafb", fontSize: 16, outline: "none",
                          boxSizing: "border-box",
                        }}
                        placeholder="0"
                      />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={{ color: "#9ca3af", fontSize: 13, display: "block", marginBottom: 8 }}>
                        Plataforma
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {PLATFORMS.map((p) => (
                          <button
                            key={p}
                            onClick={() => setEditPlatform(p)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: 10,
                              border: "1px solid",
                              borderColor: editPlatform === p ? "#00ff88" : "rgba(255,255,255,0.1)",
                              background: editPlatform === p ? "rgba(0,255,136,0.1)" : "transparent",
                              color: editPlatform === p ? "#00ff88" : "#9ca3af",
                              cursor: "pointer",
                              fontSize: 14,
                              fontWeight: 500,
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        width: "100%", padding: "12px", borderRadius: 12, border: "none",
                        background: "rgba(0,255,136,0.1)", color: "#00ff88",
                        fontWeight: 600, fontSize: 15, cursor: "pointer",
                      }}
                    >
                      Confirmar edição
                    </button>
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
                    Confirmar e salvar
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* CONFIRM (loading) */}
          {step === "confirm" && (
            <motion.div key="confirm" {...slide}>
              <div style={{ textAlign: "center", paddingTop: 60 }}>
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{
                    width: 80, height: 80,
                    background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 24px",
                  }}
                >
                  <CheckCircle size={36} color="#0a0a0a" />
                </motion.div>
                <p style={{ color: "#f9fafb", fontSize: 18, fontWeight: 600 }}>Salvando seu dia...</p>
              </div>
            </motion.div>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <motion.div key="success" {...slide}>
              <div style={{ textAlign: "center", paddingTop: 32 }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200 }}
                  style={{
                    width: 96, height: 96,
                    background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 24px",
                    boxShadow: "0 0 60px rgba(0,255,136,0.4)",
                  }}
                >
                  <CheckCircle size={44} color="#0a0a0a" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 style={{ color: "#f9fafb", fontWeight: 800, fontSize: 26, marginBottom: 10 }}>
                    Pronto!
                  </h2>
                  <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 8 }}>
                    Seu dia foi registrado com sucesso.
                  </p>
                  <p style={{ color: "#00ff88", fontSize: 15, fontWeight: 600, marginBottom: 32 }}>
                    Agora você sabe seu lucro real de hoje.
                  </p>

                  <div style={{
                    background: "#1a1a1a",
                    borderRadius: 20,
                    padding: 24,
                    border: "1px solid rgba(0,255,136,0.12)",
                    marginBottom: 32,
                    textAlign: "left",
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                      <Star size={18} color="#fbbf24" fill="#fbbf24" />
                      <span style={{ color: "#f9fafb", fontWeight: 600 }}>Você está mais perto da sua meta</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ background: "rgba(0,255,136,0.06)", borderRadius: 12, padding: 16 }}>
                        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>Ganhos</p>
                        <p style={{ color: "#00ff88", fontWeight: 700, fontSize: 18 }}>
                          R${parseFloat(editEarnings || "0").toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16 }}>
                        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>Corridas</p>
                        <p style={{ color: "#f9fafb", fontWeight: 700, fontSize: 18 }}>{editTrips}</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                      onClick={() => navigate("/")}
                      style={{
                        width: "100%", padding: "16px", borderRadius: 16, border: "none",
                        background: "linear-gradient(135deg,#00ff88,#00cc6a)",
                        color: "#0a0a0a", fontWeight: 700, fontSize: 16, cursor: "pointer",
                      }}
                    >
                      Ver meu dashboard
                    </button>
                    <button
                      onClick={() => {
                        setStep("entry");
                        setFile(null);
                        setPreviewUrl(null);
                        setExtracted({ earnings: null, trips: null, platform: null });
                        setEditEarnings("");
                        setEditTrips("");
                        setEditPlatform("Uber");
                        setIsEditing(false);
                        setError(null);
                      }}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "transparent", color: "#9ca3af",
                        fontWeight: 600, fontSize: 15, cursor: "pointer",
                      }}
                    >
                      Importar outro dia
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

function EntryView({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 20 }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        style={{
          width: 100, height: 100,
          background: "linear-gradient(135deg,#00ff88,#00cc6a)",
          borderRadius: "28px",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          boxShadow: "0 0 60px rgba(0,255,136,0.3)",
        }}
      >
        <Camera size={44} color="#0a0a0a" />
      </motion.div>

      <h2 style={{ color: "#f9fafb", fontWeight: 800, fontSize: 26, marginBottom: 12 }}>
        Importe seus resultados
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 36, lineHeight: 1.6 }}>
        Fotografe ou envie o resumo de ganhos do seu aplicativo e registre seu dia em 10 segundos.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
        {[
          { icon: "📸", text: "Tire uma screenshot do seu app" },
          { icon: "🧠", text: "Nossa IA lê os valores automaticamente" },
          { icon: "✅", text: "Confirme e seu dia está salvo" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 + 0.2 }}
            style={{
              background: "#1a1a1a",
              borderRadius: 14,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <span style={{ color: "#d1d5db", fontSize: 15 }}>{item.text}</span>
          </motion.div>
        ))}
      </div>

      <button
        onClick={onStart}
        style={{
          width: "100%", padding: "18px", borderRadius: 18, border: "none",
          background: "linear-gradient(135deg,#00ff88,#00cc6a)",
          color: "#0a0a0a", fontWeight: 700, fontSize: 17,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,255,136,0.25)",
        }}
      >
        <Camera size={22} />
        Importar resultados do dia
      </button>
    </div>
  );
}

function InstructionsView({ onUpload }: { onUpload: () => void }) {
  return (
    <div>
      <h2 style={{ color: "#f9fafb", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
        Como fazer a screenshot
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Tire uma screenshot da tela de resumo de ganhos do seu aplicativo. O total de ganhos e o número de corridas precisam estar visíveis.
      </p>

      {/* Mock example image */}
      <div style={{
        background: "linear-gradient(135deg,#1a1a2e,#16213e)",
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        border: "1px solid rgba(255,255,255,0.08)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "rgba(0,255,136,0.06)",
          borderRadius: "0 20px 0 60px",
          width: 80, height: 80,
        }} />

        <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 16, letterSpacing: 1 }}>
          EXEMPLO DE SCREENSHOT
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{
            background: "#00b4d8", borderRadius: 8, padding: "4px 10px",
            color: "#fff", fontSize: 13, fontWeight: 700,
          }}>Uber</div>
          <span style={{ color: "#6b7280", fontSize: 13, alignSelf: "center" }}>Resumo do dia</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{
            background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 6 }}>Total ganho</p>
            <p style={{
              color: "#f9fafb", fontSize: 22, fontWeight: 800,
              background: "linear-gradient(90deg,#00ff88,#00cc6a)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>R$ 187,50</p>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 6 }}>Corridas</p>
            <p style={{ color: "#f9fafb", fontSize: 22, fontWeight: 800 }}>12</p>
          </div>
        </div>

        <div style={{
          position: "absolute", bottom: 8, right: 12,
          color: "#00ff88", fontSize: 10, fontWeight: 600,
        }}>
          ← certifique-se que esses valores aparecem
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <p style={{ color: "#9ca3af", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Dicas importantes:</p>
        {[
          "Certifique-se que o valor total de ganhos está visível",
          "O número de corridas deve aparecer na tela",
          "Evite screenshots cortadas ou borradas",
          "Funciona com Uber, 99, InDrive e outros",
        ].map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1,
            }}>
              <span style={{ color: "#00ff88", fontSize: 10 }}>✓</span>
            </div>
            <span style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.5 }}>{tip}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onUpload}
        style={{
          width: "100%", padding: "18px", borderRadius: 18, border: "none",
          background: "linear-gradient(135deg,#00ff88,#00cc6a)",
          color: "#0a0a0a", fontWeight: 700, fontSize: 17, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,255,136,0.25)",
        }}
      >
        <Upload size={22} />
        Enviar screenshot
      </button>
    </div>
  );
}

function LockedView({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 20 }}>
      <div style={{
        width: 96, height: 96,
        background: "rgba(234,179,8,0.1)",
        borderRadius: "28px",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 28px",
        border: "2px solid rgba(234,179,8,0.2)",
        position: "relative",
      }}>
        <div style={{
          filter: "blur(4px)",
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Camera size={44} color="#00ff88" />
        </div>
        <div style={{
          position: "absolute",
          background: "#eab308",
          borderRadius: "50%",
          width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          bottom: -8, right: -8,
        }}>
          <Lock size={16} color="#0a0a0a" />
        </div>
      </div>

      <div style={{
        background: "rgba(234,179,8,0.1)",
        border: "1px solid rgba(234,179,8,0.2)",
        borderRadius: 8,
        padding: "6px 14px",
        display: "inline-block",
        marginBottom: 16,
      }}>
        <span style={{ color: "#eab308", fontSize: 13, fontWeight: 700 }}>✦ RECURSO PRO</span>
      </div>

      <h2 style={{ color: "#f9fafb", fontWeight: 800, fontSize: 24, marginBottom: 10 }}>
        Economize tempo, importe resultados
      </h2>
      <p style={{ color: "#9ca3af", fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
        Com o PRO, você importa seus ganhos diários em 10 segundos. Tire uma screenshot e nossa IA faz o resto.
      </p>

      <div style={{ textAlign: "left", marginBottom: 32 }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{
            padding: "10px 0",
            borderBottom: i < FEATURES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            color: "#d1d5db",
            fontSize: 14,
          }}>
            <span style={{ color: "#eab308" }}>{f.split(" ")[0]}</span>
            {" " + f.split(" ").slice(1).join(" ")}
          </div>
        ))}
      </div>

      <button
        onClick={onUpgrade}
        style={{
          width: "100%", padding: "18px", borderRadius: 18, border: "none",
          background: "linear-gradient(135deg,#eab308,#ca8a04)",
          color: "#0a0a0a", fontWeight: 700, fontSize: 17, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(234,179,8,0.3)",
        }}
      >
        <Zap size={22} />
        Desbloquear PRO
      </button>

      <p style={{ color: "#6b7280", fontSize: 12, marginTop: 12 }}>
        A partir de R$19,90/mês • Cancele quando quiser
      </p>
    </div>
  );
}
