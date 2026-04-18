import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Zap, History, Settings2, Volume2, VolumeX,
  CheckCircle, XCircle, AlertCircle, Clock, MapPin,
  Navigation, DollarSign, RotateCcw, Edit3, Fuel,
  ImageIcon, TrendingUp, ArrowLeft, ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { getApiBase, authFetch } from "@/lib/api";
import { getCameraService, getGalleryService, type CaptureResult } from "@/services/offerCaptureService";

const BASE = getApiBase();

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfferAnalysis {
  price: number | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  pickup: string | null;
  destination: string | null;
  platform: string;
  confidence: string;
  profitPerKm: number | null;
  profitPerHour: number | null;
  netProfit: number | null;
  verdict: "green" | "yellow" | "red";
  costPerKm: number;
  fixedCostPerHour: number;
}

interface SavedOffer {
  id: number;
  capturedAt: string;
  price: number | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  pickup: string | null;
  destination: string | null;
  platform: string | null;
  profitPerKm: number | null;
  profitPerHour: number | null;
  netProfit: number | null;
  verdict: string | null;
  decision: string | null;
}

interface DriverCosts {
  costPerKm: number;
  fixedCostPerHour: number;
}

type PageState =
  | { kind: "idle" }
  | { kind: "previewing"; capture: CaptureResult }
  | { kind: "analyzing"; capture: CaptureResult }
  | { kind: "result"; result: OfferAnalysis; capture: CaptureResult }
  | { kind: "correcting"; result: OfferAnalysis; capture: CaptureResult };

type Tab = "capture" | "history";

// ─── Config ───────────────────────────────────────────────────────────────────

const VERDICT_CFG = {
  green: {
    label: "CORRIDA BOA",
    sublabel: "Vale a pena aceitar",
    bg: "rgba(0,255,136,0.12)",
    border: "rgba(0,255,136,0.3)",
    color: "#00ff88",
    glow: "0 0 48px rgba(0,255,136,0.25)",
    speech: "Corrida boa! Vale a pena aceitar.",
    icon: CheckCircle,
  },
  yellow: {
    label: "ATENÇÃO",
    sublabel: "Analise antes de aceitar",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.3)",
    color: "#f59e0b",
    glow: "0 0 48px rgba(245,158,11,0.18)",
    speech: "Atenção. Avalie bem antes de aceitar.",
    icon: AlertCircle,
  },
  red: {
    label: "CORRIDA RUIM",
    sublabel: "Não compensa aceitar",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.3)",
    color: "#ef4444",
    glow: "0 0 48px rgba(239,68,68,0.18)",
    speech: "Corrida ruim. Não vale a pena.",
    icon: XCircle,
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, dec = 2): string =>
  n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtBRL = (n: number | null | undefined): string =>
  n == null ? "—" : `R$ ${fmt(n)}`;

const COSTS_KEY = "assistant_driver_costs_v2";

function loadCosts(): DriverCosts {
  try {
    const raw = localStorage.getItem(COSTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { costPerKm: 0.55, fixedCostPerHour: 5.0 };
}

function persistCosts(c: DriverCosts) {
  localStorage.setItem(COSTS_KEY, JSON.stringify(c));
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "pt-BR";
  utt.rate = 1.0;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  window.speechSynthesis.speak(utt);
}

// ─── Cost Settings Sheet ──────────────────────────────────────────────────────

function CostSettingsSheet({ costs, onSave, onClose }: {
  costs: DriverCosts;
  onSave: (c: DriverCosts) => void;
  onClose: () => void;
}) {
  const [cpk, setCpk] = useState(String(costs.costPerKm).replace(".", ","));
  const [fph, setFph] = useState(String(costs.fixedCostPerHour).replace(".", ","));

  const handleSave = () => {
    onSave({
      costPerKm: parseFloat(cpk.replace(",", ".")) || 0.55,
      fixedCostPerHour: parseFloat(fph.replace(",", ".")) || 5.0,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 360 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "#141414", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,0.08)", padding: "8px 24px 48px" }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "12px auto 28px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Fuel size={18} color="#00ff88" />
          <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Perfil de Custos</span>
        </div>

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24, lineHeight: 1.6 }}>
          Configure seus custos reais para que o assistente calcule o lucro verdadeiro de cada corrida.
        </p>

        <CostField
          label="CUSTO VARIÁVEL POR KM"
          hint="Combustível + desgaste do veículo. Referência: R$ 0,40–0,70/km"
          value={cpk}
          onChange={setCpk}
        />
        <div style={{ height: 16 }} />
        <CostField
          label="CUSTO FIXO POR HORA"
          hint="Parcela do carro, seguro, rastreador rateado pelas horas. Referência: R$ 3–8/hora"
          value={fph}
          onChange={setFph}
        />

        <div style={{ height: 28 }} />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          style={{ width: "100%", background: "linear-gradient(135deg,#00ff88,#00cc6a)", border: "none", borderRadius: 16, padding: "17px", fontSize: 15, fontWeight: 800, color: "#000", cursor: "pointer", fontFamily: "inherit" }}
        >
          Salvar e Aplicar
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function CostField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>R$</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px 14px 44px", fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>{hint}</p>
    </div>
  );
}

// ─── Capture Screen ───────────────────────────────────────────────────────────

function CaptureScreen({ onCapture, todayStats }: {
  onCapture: (capture: CaptureResult) => void;
  todayStats: { total: number; accepted: number; avgProfitPerKm: number | null } | null;
}) {
  const [capturing, setCapturing] = useState(false);

  const doCapture = async (mode: "camera" | "gallery") => {
    if (capturing) return;
    setCapturing(true);
    try {
      const service = mode === "camera" ? getCameraService() : getGalleryService();
      const result = await service.capture();
      onCapture(result);
    } catch (e: any) {
      if (e.message !== "Captura cancelada") {
        console.warn("[capture]", e.message);
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

      {/* Today stats strip */}
      {todayStats && todayStats.total > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatPill label="Hoje" value={String(todayStats.total)} sub="capturas" />
          <StatPill label="Aceitas" value={String(todayStats.accepted)} sub="corridas" accent />
          {todayStats.avgProfitPerKm !== null && (
            <StatPill label="Média" value={`R$${fmt(todayStats.avgProfitPerKm, 2)}`} sub="por km" />
          )}
        </div>
      )}

      {/* Main camera button */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: todayStats?.total ? 8 : 40 }}>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => doCapture("camera")}
          disabled={capturing}
          style={{
            width: 160, height: 160, borderRadius: "50%",
            background: capturing ? "rgba(0,255,136,0.06)" : "linear-gradient(145deg,#00ff88,#00d46a)",
            border: capturing ? "2px solid rgba(0,255,136,0.3)" : "none",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: capturing ? "not-allowed" : "pointer",
            boxShadow: capturing ? "none" : "0 0 48px rgba(0,255,136,0.35), 0 12px 40px rgba(0,0,0,0.5)",
            fontFamily: "inherit", transition: "box-shadow 0.3s ease",
          }}
        >
          {capturing ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{ width: 44, height: 44, border: "3px solid rgba(0,255,136,0.2)", borderTop: "3px solid #00ff88", borderRadius: "50%" }} />
          ) : (
            <>
              <Camera size={44} color="#000" strokeWidth={2.5} />
              <span style={{ fontSize: 13, fontWeight: 900, color: "#000", letterSpacing: "0.06em" }}>FOTOGRAFAR</span>
            </>
          )}
        </motion.button>

        <p style={{ marginTop: 18, fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", maxWidth: 240, lineHeight: 1.5 }}>
          Quando aparecer uma corrida, fotografe a tela do app
        </p>

        {/* Gallery option */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => doCapture("gallery")}
          disabled={capturing}
          style={{ marginTop: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 20px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}
        >
          <ImageIcon size={14} />
          Ou escolher da galeria
        </motion.button>
      </div>

      {/* How it works */}
      <div style={{ marginTop: 40 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", marginBottom: 14, textAlign: "center" }}>SISTEMA DE SEMÁFORO</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { color: "#00ff88", dot: "rgba(0,255,136,0.15)", border: "rgba(0,255,136,0.15)", label: "VERDE", desc: "Acima de R$ 1,80/km — aceite" },
            { color: "#f59e0b", dot: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.15)", label: "AMARELO", desc: "R$ 1,00–1,80/km — avalie" },
            { color: "#ef4444", dot: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.15)", label: "VERMELHO", desc: "Abaixo de R$ 1,00/km — rejeite" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, background: item.dot, border: `1px solid ${item.border}`, borderRadius: 12, padding: "11px 14px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, boxShadow: `0 0 6px ${item.color}`, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: item.color, minWidth: 70 }}>{item.label}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StatPill({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: accent ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${accent ? "rgba(0,255,136,0.14)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: accent ? "#00ff88" : "#fff" }}>{value}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

// ─── Preview Screen ───────────────────────────────────────────────────────────

function PreviewScreen({ capture, onConfirm, onRetake, analyzing }: {
  capture: CaptureResult;
  onConfirm: () => void;
  onRetake: () => void;
  analyzing: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onRetake} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "inherit", padding: "4px 0" }}>
          <ArrowLeft size={16} />
          Nova foto
        </button>
      </div>

      {/* Image preview */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
        <img
          src={capture.previewUrl}
          alt="Captura da oferta"
          style={{ width: "100%", display: "block", maxHeight: 380, objectFit: "contain", background: "#0a0a0a" }}
        />
        {analyzing && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{ width: 48, height: 48, border: "3px solid rgba(0,255,136,0.2)", borderTop: "3px solid #00ff88", borderRadius: "50%" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Analisando oferta...</p>
              <AnalysisSteps />
            </div>
          </div>
        )}
      </div>

      {!analyzing && (
        <>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: 18 }}>
            A imagem ficou nítida? Verifique se o valor e a distância estão legíveis.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onRetake}
              style={{ padding: "16px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <RotateCcw size={16} />
              Refazer
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onConfirm}
              style={{ padding: "16px", borderRadius: 16, background: "linear-gradient(135deg,#00ff88,#00cc6a)", border: "none", fontSize: 14, fontWeight: 800, color: "#000", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Zap size={16} />
              Analisar
            </motion.button>
          </div>
        </>
      )}
    </motion.div>
  );
}

function AnalysisSteps() {
  const steps = ["Lendo imagem...", "Extraindo dados...", "Calculando lucro..."];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      {steps.map((s, i) => (
        <motion.div
          key={s}
          animate={{ opacity: i <= step ? 1 : 0.25 }}
          style={{ fontSize: 11, color: i === step ? "#00ff88" : "rgba(255,255,255,0.4)", fontWeight: i === step ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}
        >
          {i < step && <CheckCircle size={10} color="#00ff88" />}
          {i === step && (
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88" }} />
          )}
          {i > step && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />}
          {s}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Result Screen ────────────────────────────────────────────────────────────

function ResultScreen({ result, capture, onSave, onNewCapture, onCorrect }: {
  result: OfferAnalysis;
  capture: CaptureResult;
  onSave: (decision: "accepted" | "ignored") => void;
  onNewCapture: () => void;
  onCorrect: () => void;
}) {
  const cfg = VERDICT_CFG[result.verdict];
  const Icon = cfg.icon;
  const [showImage, setShowImage] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }}>

      {/* Traffic light */}
      <motion.div
        animate={{ boxShadow: cfg.glow }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: 24, padding: "28px 20px 22px", marginBottom: 14, textAlign: "center" }}
      >
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.5 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 10 }}
        >
          <Icon size={38} color={cfg.color} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 10px ${cfg.color}80)` }} />
          <span style={{ fontSize: 34, fontWeight: 900, color: cfg.color, letterSpacing: "-0.03em", textShadow: `0 0 24px ${cfg.color}50` }}>
            {cfg.label}
          </span>
        </motion.div>
        <p style={{ fontSize: 13, color: cfg.color, opacity: 0.65, fontWeight: 600 }}>{cfg.sublabel}</p>

        {result.confidence === "low" && (
          <div style={{ marginTop: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "8px 12px" }}>
            <p style={{ fontSize: 11, color: "#f59e0b", textAlign: "center" }}>
              ⚠️ Dados extraídos com baixa confiança. Verifique os valores abaixo.
            </p>
          </div>
        )}
      </motion.div>

      {/* Profit metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <MetricBox label="LUCRO/KM" value={result.profitPerKm !== null ? `R$${fmt(result.profitPerKm)}` : "—"} sub="por quilômetro" />
        <MetricBox label="LUCRO LÍQUIDO" value={fmtBRL(result.netProfit)} sub="estimado" accent />
        <MetricBox label="LUCRO/HORA" value={result.profitPerHour !== null ? `R$${fmt(result.profitPerHour)}` : "—"} sub="por hora" />
      </div>

      {/* Ride data */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px 18px", marginBottom: 14 }}>
        <DataRow icon={<DollarSign size={14} color="#00ff88" />} label="Valor" value={fmtBRL(result.price)} />
        <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "10px 0" }} />
        <DataRow icon={<Navigation size={14} color="rgba(255,255,255,0.4)" />} label="Distância" value={result.distanceKm !== null ? `${fmt(result.distanceKm, 1)} km` : "—"} />
        <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "10px 0" }} />
        <DataRow icon={<Clock size={14} color="rgba(255,255,255,0.4)" />} label="Duração" value={result.estimatedMinutes !== null ? `${result.estimatedMinutes} min` : "—"} />
        {result.pickup && <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "10px 0" }} />
          <DataRow icon={<MapPin size={14} color="rgba(255,255,255,0.4)" />} label="Embarque" value={result.pickup} />
        </>}
        {result.destination && <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "10px 0" }} />
          <DataRow icon={<MapPin size={14} color="#f59e0b" />} label="Destino" value={result.destination} />
        </>}
        <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "10px 0" }} />
        <DataRow icon={<Zap size={14} color="rgba(255,255,255,0.4)" />} label="Plataforma" value={result.platform} />
      </div>

      {/* Cost basis */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "8px 12px", fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
          Custo: <strong style={{ color: "rgba(255,255,255,0.5)" }}>R${fmt(result.costPerKm, 2)}/km</strong>
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "8px 12px", fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
          Fixo: <strong style={{ color: "rgba(255,255,255,0.5)" }}>R${fmt(result.fixedCostPerHour, 2)}/hora</strong>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSave("accepted")}
          style={{ padding: "17px", borderRadius: 16, background: "rgba(0,255,136,0.1)", border: "1.5px solid rgba(0,255,136,0.3)", fontSize: 15, fontWeight: 800, color: "#00ff88", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <CheckCircle size={18} />
          Aceitei
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSave("ignored")}
          style={{ padding: "17px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.09)", fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <XCircle size={18} />
          Ignorei
        </motion.button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onCorrect}
          style={{ flex: 1, padding: "12px", borderRadius: 13, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          <Edit3 size={13} />
          Corrigir dados
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowImage(!showImage)}
          style={{ flex: 1, padding: "12px", borderRadius: 13, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          <ImageIcon size={13} />
          {showImage ? "Ocultar" : "Ver foto"}
        </motion.button>
      </div>

      <AnimatePresence>
        {showImage && (
          <motion.img
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            src={capture.previewUrl}
            alt="Oferta capturada"
            style={{ width: "100%", borderRadius: 16, marginTop: 12, objectFit: "contain", maxHeight: 300, background: "#0a0a0a" }}
          />
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onNewCapture}
        style={{ width: "100%", marginTop: 12, background: "none", border: "none", fontSize: 13, color: "rgba(255,255,255,0.25)", cursor: "pointer", fontFamily: "inherit", padding: "8px" }}
      >
        Nova captura
      </motion.button>
    </motion.div>
  );
}

function MetricBox({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? "rgba(0,255,136,0.05)" : "rgba(255,255,255,0.025)", border: `1px solid ${accent ? "rgba(0,255,136,0.13)" : "rgba(255,255,255,0.05)"}`, borderRadius: 14, padding: "13px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: accent ? "#00ff88" : "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function DataRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", minWidth: 68 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#f9fafb", flex: 1, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

// ─── Correction Screen ────────────────────────────────────────────────────────

function CorrectionScreen({ result, costs, onApply, onBack }: {
  result: OfferAnalysis;
  costs: DriverCosts;
  onApply: (corrected: OfferAnalysis) => void;
  onBack: () => void;
}) {
  const [price, setPrice] = useState(result.price !== null ? String(result.price).replace(".", ",") : "");
  const [dist, setDist] = useState(result.distanceKm !== null ? String(result.distanceKm).replace(".", ",") : "");
  const [mins, setMins] = useState(result.estimatedMinutes !== null ? String(result.estimatedMinutes) : "");
  const [calculating, setCalculating] = useState(false);

  const handleApply = async () => {
    setCalculating(true);
    try {
      const priceN = parseFloat(price.replace(",", ".")) || null;
      const distN = parseFloat(dist.replace(",", ".")) || null;
      const minsN = parseInt(mins) || null;

      const res = await authFetch(`${BASE}/api/assistant/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ price: priceN, distanceKm: distN, estimatedMinutes: minsN, costPerKm: costs.costPerKm, fixedCostPerHour: costs.fixedCostPerHour }),
      });

      if (res.ok) {
        const calc = await res.json();
        onApply({ ...result, price: priceN, distanceKm: distN, estimatedMinutes: minsN, confidence: "high", ...calc });
      }
    } catch { /* ignore */ }
    finally { setCalculating(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "inherit" }}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Corrigir Dados Extraídos</span>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24, lineHeight: 1.6 }}>
        Se a IA leu algum valor incorretamente, corrija abaixo. O lucro será recalculado automaticamente.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <EditField label="VALOR DA CORRIDA (R$)" value={price} onChange={setPrice} prefix="R$" placeholder="Ex: 12,50" />
        <EditField label="DISTÂNCIA (km)" value={dist} onChange={setDist} prefix="km" placeholder="Ex: 4,2" suffix />
        <EditField label="DURAÇÃO (minutos)" value={mins} onChange={setMins} prefix="min" placeholder="Ex: 18" suffix />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleApply}
        disabled={calculating}
        style={{ width: "100%", marginTop: 28, background: "linear-gradient(135deg,#00ff88,#00cc6a)", border: "none", borderRadius: 16, padding: "17px", fontSize: 15, fontWeight: 800, color: "#000", cursor: "pointer", fontFamily: "inherit", opacity: calculating ? 0.7 : 1 }}
      >
        {calculating ? "Recalculando..." : "Aplicar Correção"}
      </motion.button>
    </motion.div>
  );
}

function EditField({ label, value, onChange, prefix, placeholder, suffix }: { label: string; value: string; onChange: (v: string) => void; prefix: string; placeholder: string; suffix?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>{label}</label>
      <div style={{ position: "relative" }}>
        {!suffix && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder={placeholder}
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: suffix ? "13px 46px 13px 14px" : "13px 14px 13px 42px", fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
        {suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{prefix}</span>}
      </div>
    </div>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────

function HistoryScreen({ offers }: { offers: SavedOffer[] }) {
  const [filter, setFilter] = useState<"all" | "today">("today");

  const now = new Date();
  const todayStr = now.toDateString();

  const filtered = filter === "today"
    ? offers.filter((o) => new Date(o.capturedAt).toDateString() === todayStr)
    : offers;

  const totalEarnings = filtered.filter((o) => o.decision === "accepted" && o.price).reduce((s, o) => s + (o.price ?? 0), 0);
  const totalNet = filtered.filter((o) => o.decision === "accepted" && o.netProfit).reduce((s, o) => s + (o.netProfit ?? 0), 0);

  if (offers.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "60px 24px" }}>
        <History size={44} color="rgba(255,255,255,0.1)" style={{ marginBottom: 18 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Histórico vazio</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
          Capture e salve corridas para ver o histórico aqui
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Filter tabs */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 3, marginBottom: 18 }}>
        {(["today", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", background: filter === f ? "rgba(255,255,255,0.08)" : "transparent", fontSize: 12, fontWeight: filter === f ? 700 : 500, color: filter === f ? "#fff" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
          >
            {f === "today" ? "Hoje" : "Tudo"}
          </button>
        ))}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
          <StatPill label="Capturas" value={String(filtered.length)} sub="ofertas" />
          <StatPill label="Aceitas" value={String(filtered.filter((o) => o.decision === "accepted").length)} sub="corridas" accent />
          <StatPill label="Lucro Líq." value={totalNet > 0 ? `R$${fmt(totalNet, 0)}` : "—"} sub="estimado" />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.3)", padding: "32px 0" }}>
          Nenhuma oferta capturada hoje ainda
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((o) => {
            const cfg = VERDICT_CFG[(o.verdict as keyof typeof VERDICT_CFG) ?? "yellow"] ?? VERDICT_CFG.yellow;
            const time = new Date(o.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            return (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${cfg.border}20`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{fmtBRL(o.price)}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      {o.distanceKm !== null ? `${fmt(o.distanceKm, 1)} km` : ""}
                      {o.estimatedMinutes ? ` · ${o.estimatedMinutes}min` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {o.profitPerKm !== null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>
                        R${fmt(o.profitPerKm)}/km
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{time} · {o.platform ?? "—"}</span>
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, borderRadius: 7, padding: "4px 8px", marginBottom: 4 }}>
                    {cfg.label.split(" ")[0]}
                  </div>
                  {o.decision && (
                    <div style={{ fontSize: 9, color: o.decision === "accepted" ? "#00ff88" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>
                      {o.decision === "accepted" ? "✓ Aceitei" : "✗ Ignorei"}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("capture");
  const [pageState, setPageState] = useState<PageState>({ kind: "idle" });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [costs, setCosts] = useState<DriverCosts>(loadCosts);
  const [history, setHistory] = useState<SavedOffer[]>([]);
  const [todayStats, setTodayStats] = useState<{ total: number; accepted: number; avgProfitPerKm: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await authFetch(`${BASE}/api/assistant/history?limit=100`, { credentials: "include" });
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadTodayStats = useCallback(async () => {
    try {
      const res = await authFetch(`${BASE}/api/assistant/stats/today`, { credentials: "include" });
      if (res.ok) setTodayStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadHistory();
    loadTodayStats();
  }, [loadHistory, loadTodayStats]);

  // Cleanup preview URLs on state change
  useEffect(() => {
    return () => {
      if (pageState.kind !== "idle") {
        const capture = (pageState as any).capture as CaptureResult | undefined;
        if (capture?.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(capture.previewUrl);
        }
      }
    };
  }, []);

  const handleCapture = (capture: CaptureResult) => {
    setError(null);
    setPageState({ kind: "previewing", capture });
  };

  const handleAnalyze = useCallback(async () => {
    if (pageState.kind !== "previewing") return;
    const { capture } = pageState;
    setPageState({ kind: "analyzing", capture });

    const formData = new FormData();
    formData.append("screenshot", capture.file);
    formData.append("costPerKm", String(costs.costPerKm));
    formData.append("fixedCostPerHour", String(costs.fixedCostPerHour));

    try {
      const res = await authFetch(`${BASE}/api/assistant/analyze`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if ((err as any).code === "NOT_RIDE_OFFER") {
          setError("Imagem não reconhecida como oferta de corrida. Tente fotografar novamente quando a corrida aparecer.");
        } else {
          setError((err as any).error ?? "Erro ao analisar. Tente novamente.");
        }
        setPageState({ kind: "previewing", capture });
        return;
      }

      const result: OfferAnalysis = await res.json();
      setPageState({ kind: "result", result, capture });

      if (voiceEnabled) {
        const cfg = VERDICT_CFG[result.verdict];
        const profitStr = result.profitPerKm !== null
          ? ` ${result.profitPerKm.toFixed(2).replace(".", ",")} reais por quilômetro.`
          : "";
        speak(cfg.speech + profitStr);
      }
    } catch {
      setError("Sem conexão. Verifique a internet e tente novamente.");
      setPageState({ kind: "previewing", capture });
    }
  }, [pageState, costs, voiceEnabled]);

  const handleSave = useCallback(async (decision: "accepted" | "ignored") => {
    if (pageState.kind !== "result") return;
    const { result, capture } = pageState;

    try {
      await authFetch(`${BASE}/api/assistant/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...result, decision }),
      });
    } catch { /* silent */ }

    // Cleanup and reset
    if (capture.previewUrl.startsWith("blob:")) URL.revokeObjectURL(capture.previewUrl);
    setPageState({ kind: "idle" });
    await loadHistory();
    await loadTodayStats();
  }, [pageState, loadHistory, loadTodayStats]);

  const handleSaveCosts = (c: DriverCosts) => {
    persistCosts(c);
    setCosts(c);
  };

  const resetToIdle = () => {
    if (pageState.kind !== "idle") {
      const capture = (pageState as any).capture as CaptureResult | undefined;
      if (capture?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(capture.previewUrl);
    }
    setPageState({ kind: "idle" });
    setError(null);
  };

  return (
    <div style={{ minHeight: "100%", background: "#080808", color: "#fff", fontFamily: "inherit" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(8,8,8,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>

        {pageState.kind !== "idle" ? (
          <motion.button whileTap={{ scale: 0.9 }} onClick={resetToIdle}
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={17} color="rgba(255,255,255,0.6)" />
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/")}
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={17} color="rgba(255,255,255,0.6)" />
          </motion.button>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={15} color="#00ff88" style={{ filter: "drop-shadow(0 0 5px rgba(0,255,136,0.6))" }} />
            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>Assistente Ao Vivo</span>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 6px rgba(0,255,136,0.8)" }}
            />
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
            {costs.costPerKm ? `Custo R$${fmt(costs.costPerKm)}/km · R$${fmt(costs.fixedCostPerHour)}/h` : "Configure seus custos"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setVoiceEnabled((v) => !v)}
            title={voiceEnabled ? "Silenciar voz" : "Ativar voz"}
            style={{ width: 36, height: 36, borderRadius: 10, background: voiceEnabled ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${voiceEnabled ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {voiceEnabled ? <Volume2 size={16} color="#00ff88" /> : <VolumeX size={16} color="rgba(255,255,255,0.4)" />}
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowSettings(true)}
            title="Configurar custos"
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Settings2 size={16} color="rgba(255,255,255,0.45)" />
          </motion.button>
        </div>
      </div>

      {/* ── Tab bar (only when idle) ─────────────────────────────────────────── */}
      {pageState.kind === "idle" && (
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {(["capture", "history"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: "13px 8px", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#00ff88" : "transparent"}`, fontSize: 12, fontWeight: tab === t ? 800 : 600, color: tab === t ? "#00ff88" : "rgba(255,255,255,0.35)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all 0.18s" }}>
              {t === "capture" ? <><Camera size={14} />Capturar</> : <><History size={14} />Histórico {history.length > 0 ? `(${history.length})` : ""}</>}
            </button>
          ))}
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)", padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}
          >
            <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#ef4444", flex: 1 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px 100px" }}>
        <AnimatePresence mode="wait">

          {pageState.kind === "idle" && tab === "capture" && (
            <CaptureScreen key="idle" onCapture={handleCapture} todayStats={todayStats} />
          )}

          {pageState.kind === "idle" && tab === "history" && (
            <HistoryScreen key="history" offers={history} />
          )}

          {pageState.kind === "previewing" && (
            <PreviewScreen
              key="preview"
              capture={pageState.capture}
              onConfirm={handleAnalyze}
              onRetake={resetToIdle}
              analyzing={false}
            />
          )}

          {pageState.kind === "analyzing" && (
            <PreviewScreen
              key="analyzing"
              capture={pageState.capture}
              onConfirm={() => {}}
              onRetake={resetToIdle}
              analyzing={true}
            />
          )}

          {pageState.kind === "result" && (
            <ResultScreen
              key="result"
              result={pageState.result}
              capture={pageState.capture}
              onSave={handleSave}
              onNewCapture={resetToIdle}
              onCorrect={() => setPageState({ kind: "correcting", result: pageState.result, capture: pageState.capture })}
            />
          )}

          {pageState.kind === "correcting" && (
            <CorrectionScreen
              key="correcting"
              result={pageState.result}
              costs={costs}
              onApply={(corrected) => setPageState({ kind: "result", result: corrected, capture: pageState.capture })}
              onBack={() => setPageState({ kind: "result", result: pageState.result, capture: pageState.capture })}
            />
          )}

        </AnimatePresence>
      </div>

      {/* ── Cost settings sheet ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <CostSettingsSheet costs={costs} onSave={handleSaveCosts} onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
