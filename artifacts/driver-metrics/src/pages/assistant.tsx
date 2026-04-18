import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Zap, History, Settings2, Volume2, VolumeX, ChevronLeft, CheckCircle, XCircle, AlertCircle, Clock, MapPin, Navigation, DollarSign, TrendingUp, Fuel } from "lucide-react";
import { useLocation } from "wouter";
import { getApiBase, authFetch } from "@/lib/api";

const BASE = getApiBase();

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface OfferAnalysis {
  price: number | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  pickup: string | null;
  destination: string | null;
  platform: string;
  profitPerKm: number | null;
  profitPerHour: number | null;
  netProfit: number | null;
  verdict: "green" | "yellow" | "red";
}

interface SavedOffer extends OfferAnalysis {
  id: number;
  capturedAt: string;
  decision: string | null;
}

interface DriverCosts {
  costPerKm: number;
  fixedCostPerHour: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null, dec = 2): string =>
  n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtBRL = (n: number | null): string =>
  n === null ? "—" : `R$ ${fmt(n)}`;

const VERDICT_CFG = {
  green: {
    label: "CORRIDA BOA",
    sublabel: "Vale a pena aceitar",
    bg: "rgba(0,255,136,0.12)",
    border: "rgba(0,255,136,0.35)",
    color: "#00ff88",
    glow: "0 0 40px rgba(0,255,136,0.3)",
    dot: "#00ff88",
    speech: "Corrida boa! Vale a pena.",
    icon: CheckCircle,
  },
  yellow: {
    label: "ATENÇÃO",
    sublabel: "Analise antes de aceitar",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.35)",
    color: "#f59e0b",
    glow: "0 0 40px rgba(245,158,11,0.2)",
    dot: "#f59e0b",
    speech: "Atenção. Analise a corrida.",
    icon: AlertCircle,
  },
  red: {
    label: "CORRIDA RUIM",
    sublabel: "Não vale a pena",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.35)",
    color: "#ef4444",
    glow: "0 0 40px rgba(239,68,68,0.2)",
    dot: "#ef4444",
    speech: "Corrida ruim. Rejeite.",
    icon: XCircle,
  },
} as const;

// ─── VOICE ALERT ──────────────────────────────────────────────────────────────
function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "pt-BR";
  utt.rate = 0.95;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  window.speechSynthesis.speak(utt);
}

// ─── COSTS STORAGE ────────────────────────────────────────────────────────────
const COSTS_KEY = "assistant_driver_costs";

function loadCosts(): DriverCosts {
  try {
    const raw = localStorage.getItem(COSTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { costPerKm: 0.55, fixedCostPerHour: 5.0 };
}

function saveCosts(c: DriverCosts) {
  localStorage.setItem(COSTS_KEY, JSON.stringify(c));
}

// ─── COST SETTINGS MODAL ──────────────────────────────────────────────────────
function CostSettingsModal({ costs, onSave, onClose }: { costs: DriverCosts; onSave: (c: DriverCosts) => void; onClose: () => void }) {
  const [cpk, setCpk] = useState(String(costs.costPerKm));
  const [fph, setFph] = useState(String(costs.fixedCostPerHour));

  const handleSave = () => {
    const c: DriverCosts = {
      costPerKm: parseFloat(cpk.replace(",", ".")) || 0.55,
      fixedCostPerHour: parseFloat(fph.replace(",", ".")) || 5.0,
    };
    onSave(c);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 env(safe-area-inset-bottom,0px)",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "#111", borderRadius: "24px 24px 0 0",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "28px 24px 40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Fuel size={20} color="#00ff88" />
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Custos do Motorista</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              CUSTO POR KM (R$)
            </label>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
              Inclui combustível + depreciação. Média: R$ 0,55/km
            </p>
            <input
              value={cpk}
              onChange={(e) => setCpk(e.target.value)}
              inputMode="decimal"
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "14px 16px",
                fontSize: 20, fontWeight: 700, color: "#fff",
                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              CUSTO FIXO POR HORA (R$)
            </label>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
              Parcela do carro, seguro, rastreador. Média: R$ 5,00/hora
            </p>
            <input
              value={fph}
              onChange={(e) => setFph(e.target.value)}
              inputMode="decimal"
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "14px 16px",
                fontSize: 20, fontWeight: 700, color: "#fff",
                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          style={{
            width: "100%", marginTop: 28,
            background: "linear-gradient(135deg, #00ff88, #00cc6a)",
            border: "none", borderRadius: 16, padding: "16px",
            fontSize: 16, fontWeight: 800, color: "#000",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Salvar Configurações
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── ANALYSIS RESULT CARD ─────────────────────────────────────────────────────
function AnalysisCard({ result, onSave, onDiscard }: {
  result: OfferAnalysis;
  onSave: (decision: "accepted" | "ignored") => void;
  onDiscard: () => void;
}) {
  const cfg = VERDICT_CFG[result.verdict];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -10 }}
      transition={{ type: "spring", damping: 24, stiffness: 320 }}
      style={{ width: "100%" }}
    >
      {/* Traffic light verdict */}
      <motion.div
        animate={{ boxShadow: cfg.glow }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          background: cfg.bg,
          border: `2px solid ${cfg.border}`,
          borderRadius: 24,
          padding: "28px 24px 24px",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}
        >
          <Icon size={36} color={cfg.color} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 8px ${cfg.color})` }} />
          <span style={{
            fontSize: 32, fontWeight: 900, color: cfg.color,
            letterSpacing: "-0.02em",
            textShadow: `0 0 20px ${cfg.color}60`,
          }}>
            {cfg.label}
          </span>
        </motion.div>
        <p style={{ fontSize: 14, color: cfg.color, opacity: 0.7, fontWeight: 600 }}>{cfg.sublabel}</p>
      </motion.div>

      {/* Metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <MetricBox label="R$/km" value={result.profitPerKm !== null ? `R$ ${fmt(result.profitPerKm)}` : "—"} sub="Lucro/km" />
        <MetricBox label="Lucro" value={fmtBRL(result.netProfit)} sub="Estimado" accent />
        <MetricBox label="R$/hora" value={result.profitPerHour !== null ? `R$ ${fmt(result.profitPerHour)}` : "—"} sub="Rentabilidade" />
      </div>

      {/* Ride details */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18, padding: "18px 18px",
        display: "flex", flexDirection: "column", gap: 14, marginBottom: 16,
      }}>
        <DetailRow icon={<DollarSign size={15} color="#00ff88" />} label="Valor" value={fmtBRL(result.price)} />
        <DetailRow icon={<Navigation size={15} color="rgba(255,255,255,0.5)" />} label="Distância" value={result.distanceKm !== null ? `${fmt(result.distanceKm, 1)} km` : "—"} />
        <DetailRow icon={<Clock size={15} color="rgba(255,255,255,0.5)" />} label="Duração" value={result.estimatedMinutes !== null ? `${result.estimatedMinutes} min` : "—"} />
        {result.pickup && <DetailRow icon={<MapPin size={15} color="rgba(255,255,255,0.5)" />} label="Embarque" value={result.pickup} />}
        {result.destination && <DetailRow icon={<MapPin size={15} color="#f59e0b" />} label="Destino" value={result.destination} />}
        <DetailRow icon={<Zap size={15} color="rgba(255,255,255,0.5)" />} label="Plataforma" value={result.platform} />
      </div>

      {/* Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onSave("accepted")}
          style={{
            padding: "16px", borderRadius: 16,
            background: "rgba(0,255,136,0.12)", border: "1.5px solid rgba(0,255,136,0.35)",
            fontSize: 15, fontWeight: 800, color: "#00ff88",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <CheckCircle size={18} />
          Aceitei
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onSave("ignored")}
          style={{
            padding: "16px", borderRadius: 16,
            background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)",
            fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.5)",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <XCircle size={18} />
          Ignorei
        </motion.button>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onDiscard}
        style={{
          width: "100%", marginTop: 10,
          background: "transparent", border: "none",
          fontSize: 13, color: "rgba(255,255,255,0.3)",
          cursor: "pointer", fontFamily: "inherit", padding: "8px",
        }}
      >
        Descartar resultado
      </motion.button>
    </motion.div>
  );
}

function MetricBox({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? "rgba(0,255,136,0.05)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${accent ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 14, padding: "14px 10px", textAlign: "center",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: accent ? "#00ff88" : "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {icon}
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", minWidth: 72, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", flex: 1, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

// ─── HISTORY VIEW ─────────────────────────────────────────────────────────────
function HistoryView({ offers }: { offers: SavedOffer[] }) {
  if (offers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <History size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 16 }} />
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>Nenhuma oferta capturada ainda</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {offers.map((o) => {
        const cfg = VERDICT_CFG[o.verdict as keyof typeof VERDICT_CFG] ?? VERDICT_CFG.yellow;
        const date = new Date(o.capturedAt);
        return (
          <div key={o.id} style={{
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${cfg.border}`,
            borderRadius: 16, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: cfg.color, flexShrink: 0,
              boxShadow: `0 0 8px ${cfg.color}80`,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{fmtBRL(o.price)}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {o.distanceKm !== null ? `${fmt(o.distanceKm, 1)} km` : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                {o.profitPerKm !== null && (
                  <span style={{ fontSize: 11, color: cfg.color, fontWeight: 700 }}>
                    R${fmt(o.profitPerKm)}/km
                  </span>
                )}
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                  {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {o.platform}
                </span>
              </div>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
              color: cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 8, padding: "4px 8px", flexShrink: 0,
            }}>
              {o.decision === "accepted" ? "ACEITEI" : o.decision === "ignored" ? "IGNOREI" : cfg.label.split(" ")[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CAPTURE BUTTON ───────────────────────────────────────────────────────────
function CaptureButton({ onCapture, loading }: { onCapture: (file: File) => void; loading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    e.target.value = "";
  };

  return (
    <div style={{ textAlign: "center" }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => !loading && inputRef.current?.click()}
        style={{
          width: 140, height: 140, borderRadius: "50%",
          background: loading ? "rgba(0,255,136,0.05)" : "linear-gradient(135deg, #00ff88, #00cc6a)",
          border: loading ? "2px solid rgba(0,255,136,0.3)" : "none",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: loading ? "none" : "0 0 40px rgba(0,255,136,0.4), 0 8px 32px rgba(0,0,0,0.4)",
          transition: "all 0.3s ease",
          fontFamily: "inherit",
        }}
      >
        {loading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            style={{
              width: 40, height: 40,
              border: "3px solid rgba(0,255,136,0.2)",
              borderTop: "3px solid #00ff88",
              borderRadius: "50%",
            }}
          />
        ) : (
          <>
            <Camera size={40} color="#000" strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#000", letterSpacing: "0.04em" }}>CAPTURAR</span>
          </>
        )}
      </motion.button>
      <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
        {loading ? "Analisando oferta..." : "Tire uma foto da oferta de corrida"}
      </p>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
type Tab = "capture" | "history";

export default function AssistantPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("capture");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OfferAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [costs, setCosts] = useState<DriverCosts>(loadCosts);
  const [history, setHistory] = useState<SavedOffer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await authFetch(`${BASE}/api/assistant/history?limit=50`, { credentials: "include" });
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleCapture = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("screenshot", file);
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
        throw new Error(err.error ?? "Erro ao analisar");
      }

      const data: OfferAnalysis = await res.json();
      setResult(data);

      if (voiceEnabled) {
        const cfg = VERDICT_CFG[data.verdict];
        const profitStr = data.profitPerKm !== null
          ? `. ${fmt(data.profitPerKm).replace(".", ",")} reais por quilômetro.`
          : "";
        speak(cfg.speech + profitStr);
      }
    } catch (e: any) {
      setError(e.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [costs, voiceEnabled]);

  const handleSave = useCallback(async (decision: "accepted" | "ignored") => {
    if (!result) return;
    try {
      const payload = { ...result, decision };
      const res = await authFetch(`${BASE}/api/assistant/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (res.ok) {
        setResult(null);
        await loadHistory();
      }
    } catch { /* ignore */ }
  }, [result, loadHistory]);

  const handleSaveCosts = (c: DriverCosts) => {
    saveCosts(c);
    setCosts(c);
  };

  return (
    <div style={{ minHeight: "100%", background: "#080808", color: "#fff", fontFamily: "inherit" }}>

      {/* ── Header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,8,8,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/")}
          style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <ChevronLeft size={18} color="rgba(255,255,255,0.6)" />
        </motion.button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={16} color="#00ff88" style={{ filter: "drop-shadow(0 0 6px rgba(0,255,136,0.6))" }} />
            <span style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>Assistente</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.25)", color: "#00ff88", padding: "2px 7px", borderRadius: 6, letterSpacing: "0.06em" }}>
              LIVE
            </span>
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>Análise de oferta em tempo real</p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setVoiceEnabled((v) => !v)}
            style={{ width: 36, height: 36, borderRadius: 10, background: voiceEnabled ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${voiceEnabled ? "rgba(0,255,136,0.25)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            title={voiceEnabled ? "Silenciar" : "Ativar voz"}
          >
            {voiceEnabled ? <Volume2 size={16} color="#00ff88" /> : <VolumeX size={16} color="rgba(255,255,255,0.4)" />}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettings(true)}
            style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            title="Configurar custos"
          >
            <Settings2 size={16} color="rgba(255,255,255,0.5)" />
          </motion.button>
        </div>
      </div>

      {/* ── Cost info strip ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "8px 16px", display: "flex", gap: 20, alignItems: "center",
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>Custo/km:</span> R$ {fmt(costs.costPerKm)}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>Fixo/hora:</span> R$ {fmt(costs.fixedCostPerHour)}
        </span>
        <button
          onClick={() => setShowSettings(true)}
          style={{ marginLeft: "auto", fontSize: 10, color: "#00ff88", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
        >
          Editar
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {(["capture", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "13px 8px",
              background: "none", border: "none",
              borderBottom: `2px solid ${tab === t ? "#00ff88" : "transparent"}`,
              fontSize: 12, fontWeight: tab === t ? 800 : 600,
              color: tab === t ? "#00ff88" : "rgba(255,255,255,0.4)",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s",
            }}
          >
            {t === "capture" ? <><Camera size={14} />Capturar</> : <><History size={14} />Histórico ({history.length})</>}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: "24px 16px 100px" }}>
        <AnimatePresence mode="wait">

          {tab === "capture" && (
            <motion.div
              key="capture"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
            >
              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 14, padding: "14px 16px", marginBottom: 20,
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}
                >
                  <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 2 }}>Erro ao analisar</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Result or capture button */}
              <AnimatePresence mode="wait">
                {result ? (
                  <AnalysisCard
                    key="result"
                    result={result}
                    onSave={handleSave}
                    onDiscard={() => setResult(null)}
                  />
                ) : (
                  <motion.div
                    key="capture-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, paddingTop: 40 }}
                  >
                    <CaptureButton onCapture={handleCapture} loading={loading} />

                    {/* Info cards */}
                    {!loading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        style={{ width: "100%", marginTop: 40 }}
                      >
                        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 14, textAlign: "center" }}>
                          COMO FUNCIONA
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {[
                            { color: "#00ff88", label: "VERDE", desc: "R$/km acima de R$ 1,80 — aceite sem pensar" },
                            { color: "#f59e0b", label: "AMARELO", desc: "R$ 1,00–1,80/km — avalie o destino e tráfego" },
                            { color: "#ef4444", label: "VERMELHO", desc: "Abaixo de R$ 1,00/km — provavelmente não vale" },
                          ].map((item) => (
                            <div key={item.label} style={{
                              display: "flex", alignItems: "center", gap: 12,
                              background: "rgba(255,255,255,0.02)", borderRadius: 12,
                              padding: "12px 14px", border: "1px solid rgba(255,255,255,0.05)",
                            }}>
                              <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, boxShadow: `0 0 8px ${item.color}80`, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 800, color: item.color, minWidth: 64 }}>{item.label}</span>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.desc}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {tab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
              {historyLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    style={{ width: 28, height: 28, border: "2px solid rgba(0,255,136,0.2)", borderTop: "2px solid #00ff88", borderRadius: "50%" }}
                  />
                </div>
              ) : (
                <>
                  {history.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                      <SummaryBadge label="Total" value={String(history.length)} sub="corridas" />
                      <SummaryBadge label="Aceitas" value={String(history.filter(h => h.decision === "accepted").length)} sub="corridas" accent />
                      <SummaryBadge label="Ignoradas" value={String(history.filter(h => h.decision === "ignored").length)} sub="corridas" />
                    </div>
                  )}
                  <HistoryView offers={history} />
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Settings modal ── */}
      <AnimatePresence>
        {showSettings && (
          <CostSettingsModal
            costs={costs}
            onSave={handleSaveCosts}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryBadge({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? "rgba(0,255,136,0.05)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${accent ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 14, padding: "14px 10px", textAlign: "center",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent ? "#00ff88" : "#fff" }}>{value}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
