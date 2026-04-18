import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Zap, History, Settings2, Volume2, VolumeX,
  CheckCircle, XCircle, AlertCircle, Clock, Navigation,
  MapPin, DollarSign, Edit3, Fuel, ArrowLeft, ImageIcon,
  Radio, Activity, TrendingUp, TrendingDown, Minus, Lock, Smartphone,
} from "lucide-react";
import { REAL_PROVIDER, ACTIVE_PROVIDER } from "@/services/rideProvider";
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

interface FeedItem {
  uid: number;
  ride: OfferAnalysis;
  decision: "accepted" | "ignored" | null;
  detectedAt: Date;
}

type PageState =
  | { kind: "idle" }
  | { kind: "analyzing"; previewUrl: string }
  | { kind: "result"; result: OfferAnalysis; previewUrl: string }
  | { kind: "correcting"; result: OfferAnalysis; previewUrl: string };

type Tab = "capture" | "history";

// ─── Verdict config ───────────────────────────────────────────────────────────

const V = {
  green: {
    label: "CORRIDA BOA",
    short: "BOA",
    sub: "Vale a pena aceitar",
    decision: "ESSA CORRIDA PAGA SEU TEMPO — ACEITE",
    bg: "#001a0e",
    accent: "#00ff88",
    border: "rgba(0,255,136,0.25)",
    glow: "0 0 80px rgba(0,255,136,0.3)",
    speech: "Corrida boa! Essa corrida paga seu tempo. Aceite!",
    Icon: CheckCircle,
  },
  yellow: {
    label: "ATENÇÃO",
    short: "ATENÇÃO",
    sub: "Avalie antes de aceitar",
    decision: "SÓ ACEITE SE ESTIVER PARADO",
    bg: "#1a1200",
    accent: "#f59e0b",
    border: "rgba(245,158,11,0.25)",
    glow: "0 0 80px rgba(245,158,11,0.22)",
    speech: "Atenção. Só aceite se estiver parado.",
    Icon: AlertCircle,
  },
  red: {
    label: "CORRIDA RUIM",
    short: "RUIM",
    sub: "Não compensa aceitar",
    decision: "VOCÊ VAI PERDER DINHEIRO NESSA CORRIDA",
    bg: "#1a0003",
    accent: "#ef4444",
    border: "rgba(239,68,68,0.25)",
    glow: "0 0 80px rgba(239,68,68,0.22)",
    speech: "Cuidado! Você vai perder dinheiro nessa corrida.",
    Icon: XCircle,
  },
} as const;

const IDEAL_KM = 1.8;
const AUTO_DISMISS_SECS = 14;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, dec = 2) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${fmt(n)}`;

const COSTS_KEY = "assistant_driver_costs_v2";
const loadCosts = (): DriverCosts => {
  try { const r = localStorage.getItem(COSTS_KEY); if (r) return JSON.parse(r); } catch { /* */ }
  return { costPerKm: 0.55, fixedCostPerHour: 5.0 };
};
const saveCosts = (c: DriverCosts) => localStorage.setItem(COSTS_KEY, JSON.stringify(c));

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR"; u.rate = 1.05; u.volume = 1.0;
  window.speechSynthesis.speak(u);
}

// ─── Sound Engine ─────────────────────────────────────────────────────────────
// Uses Web Audio API for non-speech feedback tones.
// Green = ascending pleasant ding, Yellow = neutral double beep, Red = descending alert.

function playTone(verdict: "green" | "yellow" | "red") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const makeBeep = (freq: number, startTime: number, duration: number, vol: number, endFreq?: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = verdict === "red" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + startTime + duration);
      gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration + 0.05);
    };

    if (verdict === "green") {
      // Triple ascending ding — celebratory reward signal
      makeBeep(660, 0,    0.11, 0.25, 740);
      makeBeep(800, 0.14, 0.11, 0.28, 920);
      makeBeep(980, 0.29, 0.22, 0.32);
    } else if (verdict === "yellow") {
      makeBeep(520, 0, 0.1, 0.2);
      makeBeep(520, 0.18, 0.1, 0.16);
    } else {
      makeBeep(380, 0, 0.22, 0.35, 240);
      makeBeep(300, 0.28, 0.28, 0.28, 200);
      if ("vibrate" in navigator) navigator.vibrate([180, 80, 260]);
    }

    // Close context after sounds finish
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch { /* audio blocked by browser policy */ }
}

// ─── Mock Ride Generator ──────────────────────────────────────────────────────
// Generates realistic Brazilian ride offer data for AUTO MODE simulation.
// Architecture note: Replace this generator with real AccessibilityService
// data feed when building the Android APK. The rest of the pipeline is identical.

const NEIGHBORHOODS = [
  "Vila Madalena", "Pinheiros", "Moema", "Itaim Bibi", "Jardins",
  "Brooklin", "Santo André", "Guarulhos", "Osasco", "Santana",
  "Lapa", "Butantã", "Campo Belo", "Morumbi", "Consolação",
  "República", "Brás", "Tatuapé", "Mooca", "Liberdade",
  "Barra Funda", "Vila Prudente", "Penha", "Jabaquara", "Saúde",
];
const PLATFORMS = ["Uber", "99", "InDrive", "Cabify"] as const;

let _uid = Date.now();
function nextUid() { return ++_uid; }

function calcProfit(price: number, dist: number, mins: number, costs: DriverCosts) {
  const varCost = costs.costPerKm * dist;
  const profitPerKm = (price - varCost) / dist;
  const netProfit = price - varCost;
  const hours = mins / 60;
  const profitPerHour = (price - varCost - costs.fixedCostPerHour * hours) / hours;
  const verdict: "green" | "yellow" | "red" =
    profitPerKm >= 1.8 ? "green" : profitPerKm >= 1.0 ? "yellow" : "red";
  return { profitPerKm, profitPerHour, netProfit, verdict };
}

function generateMockRide(costs: DriverCosts): FeedItem {
  const r = Math.random();
  let price: number, dist: number, mins: number;

  if (r < 0.38) {
    // Good — above R$1.80/km after costs
    dist = parseFloat((Math.random() * 9 + 3).toFixed(1));
    price = parseFloat((dist * (costs.costPerKm + 1.85 + Math.random() * 1.1)).toFixed(2));
    mins = Math.round(dist * 3.2 + Math.random() * 9);
  } else if (r < 0.72) {
    // Yellow — R$1.00–1.80/km
    dist = parseFloat((Math.random() * 7 + 2).toFixed(1));
    price = parseFloat((dist * (costs.costPerKm + 1.05 + Math.random() * 0.7)).toFixed(2));
    mins = Math.round(dist * 4.2 + Math.random() * 12);
  } else {
    // Red — below R$1.00/km
    dist = parseFloat((Math.random() * 4 + 1.5).toFixed(1));
    price = parseFloat((dist * (costs.costPerKm + 0.25 + Math.random() * 0.65)).toFixed(2));
    mins = Math.round(dist * 5.5 + Math.random() * 16);
  }

  const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
  // InDrive rides tend to be lower (passenger proposes price)
  if (platform === "InDrive") price = parseFloat((price * 0.83).toFixed(2));

  const pickupIdx = Math.floor(Math.random() * NEIGHBORHOODS.length);
  let destIdx = Math.floor(Math.random() * NEIGHBORHOODS.length);
  while (destIdx === pickupIdx) destIdx = Math.floor(Math.random() * NEIGHBORHOODS.length);

  const pickup = NEIGHBORHOODS[pickupIdx];
  const destination = Math.random() > 0.38 ? NEIGHBORHOODS[destIdx] : null;

  const { profitPerKm, profitPerHour, netProfit, verdict } = calcProfit(price, dist, mins, costs);

  const ride: OfferAnalysis = {
    price, distanceKm: dist, estimatedMinutes: mins,
    pickup, destination, platform,
    confidence: "high",
    profitPerKm, profitPerHour, netProfit, verdict,
    costPerKm: costs.costPerKm,
    fixedCostPerHour: costs.fixedCostPerHour,
  };

  return { uid: nextUid(), ride, decision: null, detectedAt: new Date() };
}

/**
 * fetchNextFeedItem — Provider bridge
 *
 * Routes through ACTIVE_PROVIDER (mock or real).  Reuses the local calcProfit
 * business logic so there is no duplication.  Returns null when the real
 * provider has no data yet (e.g. browser mode), which callers handle by
 * simply rescheduling the next check.
 */
async function fetchNextFeedItem(costs: DriverCosts): Promise<FeedItem | null> {
  const raw = await ACTIVE_PROVIDER.nextRide(costs);
  if (!raw) return null;
  const { profitPerKm, profitPerHour, netProfit, verdict } = calcProfit(
    raw.price, raw.distanceKm, raw.estimatedMinutes, costs
  );
  const ride: OfferAnalysis = {
    price: raw.price,
    distanceKm: raw.distanceKm,
    estimatedMinutes: raw.estimatedMinutes,
    pickup: raw.pickup ?? null,
    destination: raw.destination ?? null,
    platform: raw.platform as OfferAnalysis["platform"],
    confidence: "high",
    profitPerKm,
    profitPerHour,
    netProfit,
    verdict,
    costPerKm: costs.costPerKm,
    fixedCostPerHour: costs.fixedCostPerHour,
  };
  return { uid: nextUid(), ride, decision: null, detectedAt: new Date() };
}

// ─── Cost Settings ────────────────────────────────────────────────────────────

function CostSheet({ costs, onSave, onClose }: { costs: DriverCosts; onSave: (c: DriverCosts) => void; onClose: () => void }) {
  const [cpk, setCpk] = useState(String(costs.costPerKm).replace(".", ","));
  const [fph, setFph] = useState(String(costs.fixedCostPerHour).replace(".", ","));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
        transition={{ type: "spring", damping: 32, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", background: "#141414", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,0.08)", padding: "8px 24px 52px" }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)", margin: "12px auto 28px" }} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
          <Fuel size={18} color="#00ff88" />
          <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Perfil de Custos</span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 22, lineHeight: 1.7 }}>
          Configure seus custos reais para calcular o lucro verdadeiro de cada corrida.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CostInput label="CUSTO VARIÁVEL / KM" hint="Combustível + desgaste. Ex: R$ 0,55" prefix="R$" value={cpk} onChange={setCpk} />
          <CostInput label="CUSTO FIXO / HORA" hint="Parcela, seguro, rastreador. Ex: R$ 5,00" prefix="R$" value={fph} onChange={setFph} />
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }} onClick={() => { onSave({ costPerKm: parseFloat(cpk.replace(",", ".")) || 0.55, fixedCostPerHour: parseFloat(fph.replace(",", ".")) || 5.0 }); onClose(); }}
          style={{ width: "100%", marginTop: 28, background: "linear-gradient(135deg,#00ff88,#00cc6a)", border: "none", borderRadius: 16, padding: "18px", fontSize: 16, fontWeight: 800, color: "#000", cursor: "pointer", fontFamily: "inherit" }}
        >Salvar</motion.button>
      </motion.div>
    </motion.div>
  );
}

function CostInput({ label, hint, prefix, value, onChange }: { label: string; hint: string; prefix: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 7 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>{prefix}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal"
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px 14px 46px", fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 6 }}>{hint}</div>
    </div>
  );
}

// ─── IDLE / MANUAL CAPTURE SCREEN ─────────────────────────────────────────────

function IdleScreen({ onCapture, todayStats }: {
  onCapture: (r: CaptureResult) => void;
  todayStats: { total: number; accepted: number; avgProfitPerKm: number | null } | null;
}) {
  const [busy, setBusy] = useState(false);

  const doCapture = async (mode: "camera" | "gallery") => {
    if (busy) return;
    setBusy(true);
    try {
      const svc = mode === "camera" ? getCameraService() : getGalleryService();
      onCapture(await svc.capture());
    } catch (e: any) {
      if (e.message !== "Captura cancelada") console.warn("[capture]", e.message);
    } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16 }}>

      {todayStats && todayStats.total > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 32, width: "100%" }}>
          <TodayPill label="Capturas" value={String(todayStats.total)} />
          <TodayPill label="Aceitas" value={String(todayStats.accepted)} accent />
          {todayStats.avgProfitPerKm !== null && <TodayPill label="Média/km" value={`R$${fmt(todayStats.avgProfitPerKm)}`} />}
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.93 }} onClick={() => doCapture("camera")} disabled={busy}
        style={{ width: 172, height: 172, borderRadius: "50%", background: busy ? "rgba(0,255,136,0.06)" : "linear-gradient(150deg, #00ff88, #00d46a)", border: busy ? "2px solid rgba(0,255,136,0.25)" : "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: busy ? "not-allowed" : "pointer", boxShadow: busy ? "none" : "0 0 60px rgba(0,255,136,0.4), 0 16px 48px rgba(0,0,0,0.5)", fontFamily: "inherit", transition: "all 0.25s ease" }}
      >
        {busy
          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }} style={{ width: 48, height: 48, border: "3px solid rgba(0,255,136,0.2)", borderTop: "3px solid #00ff88", borderRadius: "50%" }} />
          : <><Camera size={46} color="#000" strokeWidth={2.5} /><span style={{ fontSize: 13, fontWeight: 900, color: "#000", letterSpacing: "0.06em" }}>CAPTURAR</span></>}
      </motion.button>

      <p style={{ marginTop: 20, fontSize: 14, color: "rgba(255,255,255,0.38)", textAlign: "center", maxWidth: 220, lineHeight: 1.6 }}>
        Fotografe a tela quando uma corrida aparecer
      </p>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => doCapture("gallery")} disabled={busy}
        style={{ marginTop: 14, background: "none", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "10px 22px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.38)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
        <ImageIcon size={14} /> Usar da galeria
      </motion.button>

      <div style={{ marginTop: 44, width: "100%" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.09em", textAlign: "center", marginBottom: 12 }}>SISTEMA DE SEMÁFORO</div>
        {([{ c: "#00ff88", l: "VERDE", d: "≥ R$1,80/km — aceite" }, { c: "#f59e0b", l: "AMARELO", d: "R$1,00–1,80/km — avalie" }, { c: "#ef4444", l: "VERMELHO", d: "< R$1,00/km — rejeite" }] as const).map(({ c, l, d }) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 6, background: `${c}08`, border: `1px solid ${c}16`, borderRadius: 12 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}`, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: c, minWidth: 70 }}>{l}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.36)" }}>{d}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── MONITORING SCREEN ────────────────────────────────────────────────────────
// Shown when AUTO MODE is ON. Replaces the camera button with a live feed UI.

function MonitoringScreen({ feed, onToggleOff }: {
  feed: FeedItem[];
  onToggleOff: () => void;
}) {
  const last3 = feed.slice(-3).reverse();

  // Daily counter: rides avoided = red/yellow rides that were ignored
  const todayStr = new Date().toDateString();
  const todayFeed = feed.filter((f) => f.detectedAt.toDateString() === todayStr);
  const ruinsEvitadas = todayFeed.filter(
    (f) => (f.ride.verdict === "red" || f.ride.verdict === "yellow") && f.decision === "ignored"
  );
  const prejuizoEvitado = ruinsEvitadas.reduce((sum, f) => {
    // Loss avoided = absolute loss for red rides, or deficit vs ideal for yellow
    const lossPerKm = f.ride.profitPerKm !== null ? Math.max(0, IDEAL_KM - f.ride.profitPerKm) : 0;
    const dist = f.ride.distanceKm ?? 0;
    return sum + lossPerKm * dist;
  }, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

      {/* Status card */}
      <div style={{ background: "rgba(0,255,136,0.05)", border: "1.5px solid rgba(0,255,136,0.18)", borderRadius: 24, padding: "22px 20px 18px", marginBottom: 16, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ width: 12, height: 12, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 14px rgba(0,255,136,0.95)" }}
          />
          <span style={{ fontSize: 15, fontWeight: 900, color: "#00ff88", letterSpacing: "0.05em" }}>
            PROTEGENDO SEU LUCRO EM TEMPO REAL
          </span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 0 }}>
          Novas corridas serão analisadas automaticamente
        </p>
      </div>

      {/* Daily counter */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 16, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(239,68,68,0.7)", letterSpacing: "0.07em", marginBottom: 6 }}>RUINS EVITADAS HOJE</div>
          <motion.div
            key={ruinsEvitadas.length}
            initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}
            style={{ fontSize: 34, fontWeight: 900, color: "#ef4444", lineHeight: 1 }}
          >
            {ruinsEvitadas.length}
          </motion.div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>corridas</div>
        </div>
        <div style={{ background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.16)", borderRadius: 16, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,255,136,0.6)", letterSpacing: "0.07em", marginBottom: 6 }}>PREJUÍZO EVITADO</div>
          <motion.div
            key={Math.round(prejuizoEvitado * 100)}
            initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}
            style={{ fontSize: 28, fontWeight: 900, color: "#00ff88", lineHeight: 1 }}
          >
            {prejuizoEvitado > 0 ? `R$${fmt(prejuizoEvitado, 0)}` : "R$ 0"}
          </motion.div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>economizados</div>
        </div>
      </div>

      {/* Last 3 rides feed */}
      {last3.length > 0 ? (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.09em", marginBottom: 12 }}>
            ÚLTIMAS CORRIDAS DETECTADAS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {last3.map((item, i) => (
              <FeedCard key={item.uid} item={item} isLatest={i === 0} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "36px 20px" }}>
          <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }}>
            <Radio size={36} color="rgba(0,255,136,0.3)" style={{ marginBottom: 14 }} />
          </motion.div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
            Aguardando a próxima corrida...
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 6 }}>
            Uma nova oferta aparecerá em breve
          </p>
        </div>
      )}
    </motion.div>
  );
}

function FeedCard({ item, isLatest }: { item: FeedItem; isLatest: boolean }) {
  const cfg = V[item.ride.verdict];
  const time = item.detectedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const TrendIcon = item.ride.verdict === "green" ? TrendingUp : item.ride.verdict === "red" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      style={{ background: isLatest ? cfg.bg : "rgba(255,255,255,0.025)", border: `1px solid ${isLatest ? cfg.border : "rgba(255,255,255,0.06)"}`, borderLeft: `3px solid ${cfg.accent}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}
    >
      <TrendIcon size={20} color={cfg.accent} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: cfg.accent }}>
            {item.ride.profitPerKm !== null ? `R$${fmt(item.ride.profitPerKm)}/km` : "—"}
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: cfg.accent, opacity: 0.65 }}>
            {cfg.short}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          {fmtBRL(item.ride.price)} · {item.ride.distanceKm !== null ? `${fmt(item.ride.distanceKm, 1)} km` : ""}
          {item.ride.estimatedMinutes ? ` · ${item.ride.estimatedMinutes}min` : ""} · {item.ride.platform}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{time}</div>
        {item.decision && (
          <div style={{ fontSize: 10, fontWeight: 700, color: item.decision === "accepted" ? "#00ff88" : "rgba(255,255,255,0.3)", marginTop: 4 }}>
            {item.decision === "accepted" ? "✓ Aceitei" : "✗ Ignorei"}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── FLOATING WIDGET ──────────────────────────────────────────────────────────
// Mini status badge shown at top of content when auto mode is on.

function FloatingWidget({ item }: { item: FeedItem }) {
  const cfg = V[item.ride.verdict];
  return (
    <motion.div
      key={item.uid}
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", damping: 24, stiffness: 360 }}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 14, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: cfg.glow }}
    >
      <motion.div
        animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
        style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}`, flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: cfg.accent }}>
          {item.ride.profitPerKm !== null ? `R$${fmt(item.ride.profitPerKm)}/km` : "—"}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.accent, opacity: 0.65, marginLeft: 8 }}>
          — {cfg.short}
        </span>
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>
        {item.detectedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </motion.div>
  );
}

// ─── INCOMING RIDE CARD ───────────────────────────────────────────────────────
// Full-screen bottom sheet that slides up when auto mode detects a ride.
// Shows full verdict + key metrics + countdown + decision buttons.

function IncomingRideCard({ item, countdown, onDecision }: {
  item: FeedItem;
  countdown: number;
  onDecision: (d: "accepted" | "ignored") => void;
}) {
  const cfg = V[item.ride.verdict];
  const { Icon } = cfg;
  const ride = item.ride;
  const [saving, setSaving] = useState<"accepted" | "ignored" | null>(null);
  const countdownPct = (countdown / AUTO_DISMISS_SECS) * 100;

  const handle = (d: "accepted" | "ignored") => {
    if (saving) return;
    setSaving(d);
    onDecision(d);
  };

  const timeMsg = ride.estimatedMinutes !== null && ride.netProfit !== null
    ? `${ride.estimatedMinutes} min de trabalho para ganhar ${fmtBRL(ride.netProfit)} líquido`
    : null;

  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 340 }}
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 150, background: "#0e0e0e", borderRadius: "28px 28px 0 0", border: `1.5px solid ${cfg.border}`, borderBottom: "none", maxHeight: "92dvh", overflowY: "auto", paddingBottom: 40 }}
    >
      {/* Drag handle */}
      <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)", margin: "12px auto 0" }} />

      {/* SIMULATION badge */}
      <div style={{ textAlign: "center", marginTop: 10, marginBottom: 2 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "3px 8px" }}>
          MODO AUTO · SIMULAÇÃO
        </span>
      </div>

      <div style={{ padding: "12px 20px 0" }}>

        {/* ── Verdict ── */}
        <motion.div
          animate={{ boxShadow: cfg.glow }} transition={{ duration: 0.6 }}
          style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 22, padding: "22px 18px 18px", marginBottom: 12, textAlign: "center" }}
        >
          <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.5 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}>
            <Icon size={40} color={cfg.accent} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 12px ${cfg.accent}90)` }} />
            <span style={{ fontSize: 34, fontWeight: 900, color: cfg.accent, letterSpacing: "-0.03em", textShadow: `0 0 32px ${cfg.accent}60`, lineHeight: 1 }}>
              {cfg.label}
            </span>
          </motion.div>
          {/* Strong decision phrase */}
          <p style={{ fontSize: 14, fontWeight: 900, color: cfg.accent, letterSpacing: "0.01em", lineHeight: 1.35, marginBottom: 6 }}>
            {cfg.decision}
          </p>
          {/* Behavioral trigger for bad/borderline rides */}
          {(ride.verdict === "red" || ride.verdict === "yellow") && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontStyle: "italic" }}>
              Motoristas aceitam isso sem perceber.
            </p>
          )}
        </motion.div>

        {/* ── Insight ── */}
        {(timeMsg || ride.profitPerKm !== null) && (() => {
          const ins = buildInsights(ride);
          return (
            <div style={{ background: ins.tagBg, border: `1px solid ${ins.tagBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: ins.tagColor, marginBottom: timeMsg ? 8 : 0 }}>{ins.headline}</p>
              {timeMsg && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={13} color={ins.tagColor} />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{timeMsg}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Core numbers ── */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px", marginBottom: 12 }}>
          <div style={{ textAlign: "center", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.09em", marginBottom: 6 }}>LUCRO ESTIMADO</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: cfg.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{fmtBRL(ride.netProfit)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <MiniStat label="R$/km" val={ride.profitPerKm !== null ? `R$${fmt(ride.profitPerKm)}` : "—"} color={cfg.accent} />
            <MiniStat label="Distância" val={ride.distanceKm !== null ? `${fmt(ride.distanceKm, 1)} km` : "—"} />
            <MiniStat label="Duração" val={ride.estimatedMinutes !== null ? `${ride.estimatedMinutes} min` : "—"} />
          </div>
          {ride.pickup && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 7 }}>
              <MapPin size={12} color="rgba(255,255,255,0.3)" />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{ride.pickup}</span>
              {ride.destination && <><span style={{ color: "rgba(255,255,255,0.18)" }}>→</span><span style={{ fontSize: 11, color: "#f59e0b" }}>{ride.destination}</span></>}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{ride.platform}</span>
            </div>
          )}
        </div>

        {/* ── Decision buttons ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <motion.button
            whileTap={{ scale: 0.97 }} onClick={() => handle("accepted")} disabled={!!saving}
            style={{ width: "100%", padding: "20px", borderRadius: 18, background: saving === "accepted" ? "rgba(0,255,136,0.12)" : "linear-gradient(135deg, #00ff88, #00cc6a)", border: "none", fontSize: 18, fontWeight: 900, color: saving === "accepted" ? "#00ff88" : "#000", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: saving === "accepted" ? "none" : "0 8px 28px rgba(0,255,136,0.35)", letterSpacing: "0.02em" }}
          >
            {saving === "accepted" ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} style={{ width: 22, height: 22, border: "2px solid rgba(0,255,136,0.3)", borderTop: "2px solid #00ff88", borderRadius: "50%" }} /> : <CheckCircle size={20} strokeWidth={2.5} />}
            {saving === "accepted" ? "Salvando..." : "✓  ACEITEI A CORRIDA"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }} onClick={() => handle("ignored")} disabled={!!saving}
            style={{ width: "100%", padding: "18px", borderRadius: 18, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.12)", fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.55)", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <XCircle size={18} /> ✗  IGNOREI
          </motion.button>
        </div>

        {/* ── Auto-dismiss countdown ── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Auto-dispensa em {countdown}s</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>Toque para decidir</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${countdownPct}%` }}
              transition={{ duration: 0.95, ease: "linear" }}
              style={{ height: "100%", background: countdown > 7 ? "#00ff88" : countdown > 3 ? "#f59e0b" : "#ef4444", borderRadius: 2 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MiniStat({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? "#fff" }}>{val}</div>
    </div>
  );
}

// ─── ANALYZING SCREEN ─────────────────────────────────────────────────────────

function AnalyzingScreen({ previewUrl }: { previewUrl: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}
    >
      {previewUrl && (
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, overflow: "hidden" }}>
          <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(12px)" }} />
        </div>
      )}
      <div style={{ position: "relative" }}>
        <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.08, 0.3] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -20, borderRadius: "50%", background: "rgba(0,255,136,0.3)" }} />
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          style={{ width: 72, height: 72, border: "3px solid rgba(0,255,136,0.15)", borderTop: "3px solid #00ff88", borderRadius: "50%", position: "relative", zIndex: 1 }} />
        <Zap size={26} color="#00ff88" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 2 }} />
      </div>
      <div style={{ textAlign: "center", position: "relative" }}>
        <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10 }}>Analisando corrida...</p>
        <DotDot />
      </div>
    </motion.div>
  );
}

function DotDot() {
  const msgs = ["Lendo a imagem com IA", "Extraindo preço e distância", "Calculando seu lucro real"];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((v) => (v + 1) % msgs.length), 1600); return () => clearInterval(t); }, []);
  return (
    <motion.p key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      style={{ fontSize: 13, color: "#00ff88", fontWeight: 600 }}>{msgs[i]}</motion.p>
  );
}

// ─── INSIGHT ENGINE ───────────────────────────────────────────────────────────

function buildInsights(result: OfferAnalysis) {
  const pkm = result.profitPerKm;
  const net = result.netProfit;
  const mins = result.estimatedMinutes;
  const diff = pkm !== null ? pkm - IDEAL_KM : null;
  const timeMsg = mins !== null && net !== null
    ? `Você vai trabalhar ${mins} min para ganhar ${fmtBRL(net)} líquido` : null;

  if (result.verdict === "red") return {
    headline: pkm !== null ? `Você está ganhando apenas R$${fmt(pkm)}/km — abaixo do custo real` : "Rentabilidade abaixo do custo real",
    sub: net !== null && net < 0 ? "Essa corrida GERA PREJUÍZO. Você sairá no negativo." : "Seus custos superam o que essa corrida paga.",
    timeMsg, diff, tagColor: "#ef4444", tagBg: "rgba(239,68,68,0.10)", tagBorder: "rgba(239,68,68,0.22)",
  };
  if (result.verdict === "yellow") return {
    headline: pkm !== null ? `R$${fmt(pkm)}/km — ${diff !== null ? `R$${fmt(Math.abs(diff))} abaixo do ideal` : "abaixo do ideal"}` : "Rentabilidade abaixo do ideal",
    sub: "A corrida paga suas despesas, mas a margem é pequena.",
    timeMsg, diff, tagColor: "#f59e0b", tagBg: "rgba(245,158,11,0.09)", tagBorder: "rgba(245,158,11,0.22)",
  };
  return {
    headline: pkm !== null ? `R$${fmt(pkm)}/km — ${diff !== null && diff > 0 ? `R$${fmt(diff)} acima da meta!` : "dentro da meta!"}` : "Rentabilidade excelente!",
    sub: "Essa corrida compensa bem. Lucro acima do mínimo ideal.",
    timeMsg, diff, tagColor: "#00ff88", tagBg: "rgba(0,255,136,0.08)", tagBorder: "rgba(0,255,136,0.20)",
  };
}

// ─── TARGET BAR ───────────────────────────────────────────────────────────────

function TargetBar({ profitPerKm }: { profitPerKm: number | null }) {
  if (profitPerKm === null) return null;
  const maxBar = IDEAL_KM * 1.4;
  const actualPct = Math.min((profitPerKm / maxBar) * 100, 100);
  const idealPct = (IDEAL_KM / maxBar) * 100;
  const barColor = profitPerKm >= IDEAL_KM ? "#00ff88" : profitPerKm >= 1.0 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em" }}>COMPARATIVO DE META</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Meta: <strong style={{ color: "#00ff88" }}>R${fmt(IDEAL_KM)}/km</strong></span>
      </div>
      <div style={{ position: "relative", height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${actualPct}%` }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 6, background: barColor, boxShadow: `0 0 8px ${barColor}60` }} />
        <div style={{ position: "absolute", left: `${idealPct}%`, top: -3, bottom: -3, width: 2, background: "#00ff88", borderRadius: 2, boxShadow: "0 0 6px rgba(0,255,136,0.7)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: barColor }}>R${fmt(profitPerKm)}/km (você)</span>
        {profitPerKm < IDEAL_KM
          ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>faltam <strong style={{ color: "#f59e0b" }}>R${fmt(IDEAL_KM - profitPerKm)}</strong></span>
          : <span style={{ fontSize: 11, color: "#00ff88" }}>✓ meta atingida</span>}
      </div>
    </div>
  );
}

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────

function ResultScreen({ result, previewUrl, onDecision, onNewCapture, onCorrect }: {
  result: OfferAnalysis;
  previewUrl: string;
  onDecision: (d: "accepted" | "ignored") => Promise<void>;
  onNewCapture: () => void;
  onCorrect: () => void;
}) {
  const cfg = V[result.verdict];
  const { Icon } = cfg;
  const [saving, setSaving] = useState<"accepted" | "ignored" | null>(null);
  const insights = buildInsights(result);

  const handleDecision = async (d: "accepted" | "ignored") => {
    if (saving) return;
    setSaving(d);
    await onDecision(d);
    setSaving(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 340 }} style={{ display: "flex", flexDirection: "column" }}>

      <motion.div animate={{ boxShadow: cfg.glow }} transition={{ duration: 0.7, ease: "easeOut" }}
        style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 28, padding: "28px 20px 24px", marginBottom: 12, textAlign: "center" }}>
        <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 10 }}>
          <Icon size={46} color={cfg.accent} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 14px ${cfg.accent}A0)` }} />
          <span style={{ fontSize: 40, fontWeight: 900, color: cfg.accent, letterSpacing: "-0.03em", textShadow: `0 0 40px ${cfg.accent}70`, lineHeight: 1 }}>{cfg.label}</span>
        </motion.div>
        <p style={{ fontSize: 15, color: cfg.accent, opacity: 0.7, fontWeight: 700 }}>{cfg.sub}</p>
        {result.confidence === "low" && (
          <div style={{ marginTop: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "7px 14px", display: "inline-block" }}>
            <span style={{ fontSize: 11, color: "#f59e0b" }}>⚠️ Dados com baixa confiança</span>
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        style={{ background: insights.tagBg, border: `1.5px solid ${insights.tagBorder}`, borderRadius: 20, padding: "18px 18px 16px", marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: insights.tagColor, lineHeight: 1.4, marginBottom: 6 }}>{insights.headline}</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{insights.sub}</p>
        {insights.timeMsg && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${insights.tagBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={14} color={insights.tagColor} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{insights.timeMsg}</span>
          </div>
        )}
        {result.profitPerKm !== null && <TargetBar profitPerKm={result.profitPerKm} />}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 22, padding: "20px 18px", marginBottom: 12 }}>
        <div style={{ textAlign: "center", marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.32)", letterSpacing: "0.09em", marginBottom: 8 }}>LUCRO ESTIMADO</div>
          <div style={{ fontSize: 54, fontWeight: 900, color: result.netProfit !== null ? cfg.accent : "rgba(255,255,255,0.25)", letterSpacing: "-0.04em", lineHeight: 1 }}>{fmtBRL(result.netProfit)}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 6 }}>após combustível e custos variáveis</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.32)", letterSpacing: "0.08em", marginBottom: 6 }}>R$ / KM</div>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: result.profitPerKm !== null ? (result.profitPerKm >= IDEAL_KM ? "#00ff88" : result.profitPerKm >= 1.0 ? "#f59e0b" : "#ef4444") : "rgba(255,255,255,0.22)" }}>
              {result.profitPerKm !== null ? `R$${fmt(result.profitPerKm)}` : "—"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 4 }}>lucro por km</div>
          </div>
          <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.32)", letterSpacing: "0.08em", marginBottom: 6 }}>R$ / HORA</div>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: result.profitPerHour !== null ? "#fff" : "rgba(255,255,255,0.22)" }}>
              {result.profitPerHour !== null ? `R$${fmt(result.profitPerHour)}` : "—"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 4 }}>lucro por hora</div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 18, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <RideDetail icon={<DollarSign size={14} color="#00ff88" />} label="Valor" val={fmtBRL(result.price)} />
          <RideDetail icon={<Navigation size={14} color="rgba(255,255,255,0.4)" />} label="Distância" val={result.distanceKm !== null ? `${fmt(result.distanceKm, 1)} km` : "—"} />
          <RideDetail icon={<Clock size={14} color="rgba(255,255,255,0.4)" />} label="Duração" val={result.estimatedMinutes !== null ? `${result.estimatedMinutes} min` : "—"} />
          <RideDetail icon={<Zap size={14} color="rgba(255,255,255,0.4)" />} label="App" val={result.platform} />
        </div>
        {result.pickup && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <MapPin size={13} color="rgba(255,255,255,0.3)" style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{result.pickup}</span>
            {result.destination && <><span style={{ color: "rgba(255,255,255,0.18)" }}>→</span><span style={{ fontSize: 12, color: "#f59e0b" }}>{result.destination}</span></>}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
        style={{ textAlign: "center", marginBottom: 16, padding: "0 4px" }}>
        {result.verdict === "red" && (
          <>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#ef4444", lineHeight: 1.3, marginBottom: 6, letterSpacing: "0.01em" }}>
              VOCÊ VAI PERDER DINHEIRO NESSA CORRIDA
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
              Motoristas aceitam isso sem perceber.
            </p>
          </>
        )}
        {result.verdict === "yellow" && (
          <>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#f59e0b", lineHeight: 1.3, marginBottom: 6, letterSpacing: "0.01em" }}>
              SÓ ACEITE SE ESTIVER PARADO
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
              Motoristas aceitam isso sem perceber.
            </p>
          </>
        )}
        {result.verdict === "green" && (
          <p style={{ fontSize: 16, fontWeight: 900, color: "#00ff88", lineHeight: 1.3, letterSpacing: "0.01em" }}>
            ESSA CORRIDA PAGA SEU TEMPO — ACEITE
          </p>
        )}
      </motion.div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDecision("accepted")} disabled={!!saving}
          style={{ width: "100%", padding: "22px", borderRadius: 20, background: saving === "accepted" ? "rgba(0,255,136,0.15)" : "linear-gradient(135deg, #00ff88, #00cc6a)", border: "none", fontSize: 20, fontWeight: 900, color: saving === "accepted" ? "#00ff88" : "#000", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: saving === "accepted" ? "none" : "0 8px 32px rgba(0,255,136,0.35)", transition: "all 0.2s", letterSpacing: "0.02em" }}>
          {saving === "accepted" ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} style={{ width: 24, height: 24, border: "2px solid rgba(0,255,136,0.3)", borderTop: "2px solid #00ff88", borderRadius: "50%" }} /> : <CheckCircle size={22} strokeWidth={2.5} />}
          {saving === "accepted" ? "Salvando..." : "✓  ACEITEI A CORRIDA"}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDecision("ignored")} disabled={!!saving}
          style={{ width: "100%", padding: "20px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.12)", fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.6)", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <XCircle size={20} /> {saving === "ignored" ? "Salvando..." : "✗  IGNOREI"}
        </motion.button>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onCorrect}
          style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "11px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.32)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Edit3 size={13} /> Corrigir dados
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onNewCapture}
          style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "11px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.32)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Camera size={13} /> Nova captura
        </motion.button>
      </div>
    </motion.div>
  );
}

function RideDetail({ icon, label, val }: { icon: React.ReactNode; label: string; val: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{val}</div>
      </div>
    </div>
  );
}

// ─── CORRECTION SCREEN ────────────────────────────────────────────────────────

function CorrectionScreen({ result, costs, onApply, onBack }: { result: OfferAnalysis; costs: DriverCosts; onApply: (r: OfferAnalysis) => void; onBack: () => void }) {
  const [price, setPrice] = useState(result.price !== null ? String(result.price).replace(".", ",") : "");
  const [dist, setDist] = useState(result.distanceKm !== null ? String(result.distanceKm).replace(".", ",") : "");
  const [mins, setMins] = useState(result.estimatedMinutes !== null ? String(result.estimatedMinutes) : "");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try {
      const body = { price: parseFloat(price.replace(",", ".")) || null, distanceKm: parseFloat(dist.replace(",", ".")) || null, estimatedMinutes: parseInt(mins) || null, costPerKm: costs.costPerKm, fixedCostPerHour: costs.fixedCostPerHour };
      const res = await authFetch(`${BASE}/api/assistant/recalculate`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      if (res.ok) { const calc = await res.json(); onApply({ ...result, ...body, confidence: "high", ...calc }); }
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "inherit", marginBottom: 24 }}>
        <ArrowLeft size={16} /> Voltar ao resultado
      </button>
      <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Corrigir Dados</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24, lineHeight: 1.6 }}>Corrija os valores se a IA leu algo incorretamente da imagem.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <CostInput label="VALOR DA CORRIDA (R$)" hint="Ex: 12,50" prefix="R$" value={price} onChange={setPrice} />
        <CostInput label="DISTÂNCIA (km)" hint="Ex: 4,2" prefix="km" value={dist} onChange={setDist} />
        <CostInput label="DURAÇÃO (minutos)" hint="Ex: 18" prefix="min" value={mins} onChange={setMins} />
      </div>
      <motion.button whileTap={{ scale: 0.97 }} onClick={apply} disabled={busy}
        style={{ width: "100%", marginTop: 28, background: "linear-gradient(135deg,#00ff88,#00cc6a)", border: "none", borderRadius: 16, padding: "18px", fontSize: 15, fontWeight: 800, color: "#000", cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Calculando..." : "Aplicar e Recalcular"}
      </motion.button>
    </motion.div>
  );
}

// ─── HISTORY SCREEN ───────────────────────────────────────────────────────────

function HistoryScreen({ offers }: { offers: SavedOffer[] }) {
  const [filter, setFilter] = useState<"today" | "all">("today");
  const todayStr = new Date().toDateString();
  const filtered = filter === "today" ? offers.filter((o) => new Date(o.capturedAt).toDateString() === todayStr) : offers;
  const netSum = filtered.filter((o) => o.decision === "accepted").reduce((s, o) => s + (o.netProfit ?? 0), 0);

  if (offers.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "72px 24px" }}>
        <History size={48} color="rgba(255,255,255,0.08)" style={{ marginBottom: 20 }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Histórico vazio</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", lineHeight: 1.6 }}>Capture corridas e salve suas decisões para ver aqui</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: 13, padding: 3, marginBottom: 18 }}>
        {(["today", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ flex: 1, padding: "10px", borderRadius: 11, border: "none", background: filter === f ? "rgba(255,255,255,0.09)" : "transparent", fontSize: 13, fontWeight: filter === f ? 700 : 500, color: filter === f ? "#fff" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
            {f === "today" ? "Hoje" : "Tudo"}
          </button>
        ))}
      </div>
      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
          <TodayPill label="Ofertas" value={String(filtered.length)} />
          <TodayPill label="Aceitas" value={String(filtered.filter((o) => o.decision === "accepted").length)} accent />
          <TodayPill label="Lucro" value={netSum > 0 ? `R$${fmt(netSum, 0)}` : "—"} />
        </div>
      )}
      {filtered.length === 0 && <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.28)", padding: "40px 0" }}>Nenhuma oferta capturada hoje</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((o) => {
          const cfg = V[(o.verdict as keyof typeof V) ?? "yellow"] ?? V.yellow;
          const time = new Date(o.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          return (
            <motion.div key={o.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: "rgba(255,255,255,0.025)", borderLeft: `3px solid ${cfg.accent}`, borderRadius: 16, padding: "15px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{fmtBRL(o.price)}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{o.distanceKm !== null ? `${fmt(o.distanceKm, 1)} km` : ""}{o.estimatedMinutes ? ` · ${o.estimatedMinutes}min` : ""}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {o.profitPerKm !== null && <span style={{ fontSize: 13, fontWeight: 800, color: cfg.accent }}>R${fmt(o.profitPerKm)}/km</span>}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>{time}{o.platform ? ` · ${o.platform}` : ""}</span>
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: cfg.accent, background: `${cfg.accent}15`, border: `1px solid ${cfg.accent}28`, borderRadius: 8, padding: "5px 9px", marginBottom: 5, letterSpacing: "0.05em" }}>{cfg.label.split(" ")[0]}</div>
                {o.decision && <div style={{ fontSize: 10, fontWeight: 700, color: o.decision === "accepted" ? "#00ff88" : "rgba(255,255,255,0.28)" }}>{o.decision === "accepted" ? "✓ Aceitei" : "✗ Ignorei"}</div>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function TodayPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: accent ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${accent ? "rgba(0,255,136,0.14)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: "11px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.32)", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: accent ? "#00ff88" : "#fff" }}>{value}</div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("capture");
  const [state, setState] = useState<PageState>({ kind: "idle" });
  const [voiceOn, setVoiceOn] = useState(true);
  const [showCosts, setShowCosts] = useState(false);
  const [costs, setCosts] = useState<DriverCosts>(loadCosts);
  const [history, setHistory] = useState<SavedOffer[]>([]);
  const [todayStats, setTodayStats] = useState<{ total: number; accepted: number; avgProfitPerKm: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  // ── Auto mode state ──
  const [autoModeOn, setAutoModeOn] = useState(false);
  const [autoFeed, setAutoFeed] = useState<FeedItem[]>([]);
  const [incomingRide, setIncomingRide] = useState<FeedItem | null>(null);
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SECS);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Real Mode info banner state ──
  const [showRealModeInfo, setShowRealModeInfo] = useState(false);
  const realModeInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRealModeTap = () => {
    setShowRealModeInfo(true);
    if (realModeInfoTimerRef.current) clearTimeout(realModeInfoTimerRef.current);
    realModeInfoTimerRef.current = setTimeout(() => setShowRealModeInfo(false), 4000);
  };

  const refreshHistory = useCallback(async () => {
    try { const r = await authFetch(`${BASE}/api/assistant/history?limit=100`, { credentials: "include" }); if (r.ok) setHistory(await r.json()); } catch { /* */ }
  }, []);

  const refreshStats = useCallback(async () => {
    try { const r = await authFetch(`${BASE}/api/assistant/stats/today`, { credentials: "include" }); if (r.ok) setTodayStats(await r.json()); } catch { /* */ }
  }, []);

  useEffect(() => { refreshHistory(); refreshStats(); }, []);

  // ── Auto mode timer ──
  useEffect(() => {
    if (!autoModeOn) {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setIncomingRide(null);
      return;
    }

    const scheduleNext = () => {
      const delay = 8000 + Math.random() * 7000; // 8–15 seconds
      autoTimerRef.current = setTimeout(async () => {
        // Only fire if no ride is currently showing and not in manual analyze flow
        if (state.kind === "idle") {
          const newItem = await fetchNextFeedItem(costs);
          // Real provider returns null when bridge isn't active yet — retry later
          if (!newItem) { scheduleNext(); return; }
          setIncomingRide(newItem);
          setCountdown(AUTO_DISMISS_SECS);

          // Play sound
          if (voiceOn) {
            playTone(newItem.ride.verdict);
            const cfg = V[newItem.ride.verdict];
            const prof = newItem.ride.profitPerKm !== null ? `. ${newItem.ride.profitPerKm.toFixed(2).replace(".", ",")} reais por quilômetro.` : "";
            setTimeout(() => speak(cfg.speech + prof), 350);
          }

          // Start countdown
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = setInterval(() => {
            setCountdown((c) => {
              if (c <= 1) {
                clearInterval(countdownRef.current!);
                // Auto-dismiss as ignored
                setIncomingRide((cur) => {
                  if (cur) {
                    setAutoFeed((f) => [...f, { ...cur, decision: "ignored" }].slice(-20));
                  }
                  return null;
                });
                scheduleNext();
                return AUTO_DISMISS_SECS;
              }
              return c - 1;
            });
          }, 1000);
        } else {
          scheduleNext(); // retry later
        }
      }, delay);
    };

    scheduleNext();
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoModeOn, costs, voiceOn, state.kind]);

  // ── Auto mode decision handler ──
  const handleAutoDecision = useCallback((item: FeedItem, decision: "accepted" | "ignored") => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setAutoFeed((f) => [...f, { ...item, decision }].slice(-20));
    setIncomingRide(null);
    setCountdown(AUTO_DISMISS_SECS);
    // Schedule next ride
    const delay = 8000 + Math.random() * 7000;
    autoTimerRef.current = setTimeout(async () => {
      if (state.kind === "idle") {
        const newItem = await fetchNextFeedItem(costs);
        if (!newItem) return;
        setIncomingRide(newItem);
        setCountdown(AUTO_DISMISS_SECS);
        if (voiceOn) {
          playTone(newItem.ride.verdict);
          const cfg = V[newItem.ride.verdict];
          setTimeout(() => speak(cfg.speech), 350);
        }
        countdownRef.current = setInterval(() => {
          setCountdown((c) => {
            if (c <= 1) {
              clearInterval(countdownRef.current!);
              setIncomingRide((cur) => { if (cur) setAutoFeed((f) => [...f, { ...cur, decision: "ignored" }].slice(-20)); return null; });
              return AUTO_DISMISS_SECS;
            }
            return c - 1;
          });
        }, 1000);
      }
    }, delay);
  }, [costs, voiceOn, state.kind]);

  // ── Manual capture flow ──
  const cleanupPreview = () => {
    if (previewRef.current?.startsWith("blob:")) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
  };

  const handleCapture = useCallback(async (capture: CaptureResult) => {
    cleanupPreview();
    previewRef.current = capture.previewUrl;
    setError(null);
    setState({ kind: "analyzing", previewUrl: capture.previewUrl });

    const fd = new FormData();
    fd.append("screenshot", capture.file);
    fd.append("costPerKm", String(costs.costPerKm));
    fd.append("fixedCostPerHour", String(costs.fixedCostPerHour));

    try {
      const res = await authFetch(`${BASE}/api/assistant/analyze`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as any).code === "NOT_RIDE_OFFER" ? "Imagem não reconhecida como oferta de corrida. Tente novamente." : ((err as any).error ?? "Erro ao analisar. Tente novamente."));
        setState({ kind: "idle" });
        return;
      }
      const result: OfferAnalysis = await res.json();
      setState({ kind: "result", result, previewUrl: capture.previewUrl });
      if (voiceOn) {
        playTone(result.verdict);
        const cfg = V[result.verdict];
        const prof = result.profitPerKm !== null ? `. ${result.profitPerKm.toFixed(2).replace(".", ",")} reais por quilômetro.` : "";
        setTimeout(() => speak(cfg.speech + prof), 300);
      }
    } catch {
      setError("Sem conexão. Verifique a internet e tente novamente.");
      setState({ kind: "idle" });
    }
  }, [costs, voiceOn]);

  const handleDecision = useCallback(async (decision: "accepted" | "ignored") => {
    if (state.kind !== "result") return;
    try { await authFetch(`${BASE}/api/assistant/save`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...state.result, decision }) }); } catch { /* */ }
    cleanupPreview();
    setState({ kind: "idle" });
    await Promise.all([refreshHistory(), refreshStats()]);
  }, [state, refreshHistory, refreshStats]);

  const resetToIdle = () => { cleanupPreview(); setState({ kind: "idle" }); setError(null); };

  const toggleAutoMode = () => {
    setAutoModeOn((v) => {
      if (v) { setIncomingRide(null); setAutoFeed([]); }
      return !v;
    });
  };

  const lastFeedItem = autoFeed.length > 0 ? autoFeed[autoFeed.length - 1] : null;
  const showBack = state.kind !== "idle";

  return (
    <div style={{ minHeight: "100%", background: "#080808", color: "#fff", fontFamily: "inherit" }}>

      {/* ── Full-screen analyzing overlay ── */}
      <AnimatePresence>
        {state.kind === "analyzing" && <AnalyzingScreen previewUrl={state.previewUrl} />}
      </AnimatePresence>

      {/* ── Incoming ride overlay (Auto Mode) ── */}
      <AnimatePresence>
        {incomingRide && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
            <IncomingRideCard
              item={incomingRide}
              countdown={countdown}
              onDecision={(d) => handleAutoDecision(incomingRide, d)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(8,8,8,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={showBack ? resetToIdle : () => navigate("/")}
          style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <ArrowLeft size={17} color="rgba(255,255,255,0.55)" />
        </motion.button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={14} color="#00ff88" style={{ filter: "drop-shadow(0 0 5px rgba(0,255,136,0.7))" }} />
            <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>Assistente Ao Vivo</span>
            {autoModeOn && (
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 6px rgba(0,255,136,0.9)" }} />
            )}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.27)", marginTop: 1 }}>
            R${fmt(costs.costPerKm)}/km · R${fmt(costs.fixedCostPerHour)}/h
          </div>
        </div>

        {/* AUTO MODE toggle */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleAutoMode}
          style={{ display: "flex", alignItems: "center", gap: 6, background: autoModeOn ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${autoModeOn ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.09)"}`, borderRadius: 10, padding: "7px 11px", cursor: "pointer", transition: "all 0.2s" }}
        >
          <Radio size={14} color={autoModeOn ? "#00ff88" : "rgba(255,255,255,0.4)"} />
          <span style={{ fontSize: 11, fontWeight: 800, color: autoModeOn ? "#00ff88" : "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
            {autoModeOn ? "AUTO ON" : "AUTO"}
          </span>
          {/* Toggle pill */}
          <div style={{ width: 28, height: 16, borderRadius: 8, background: autoModeOn ? "rgba(0,255,136,0.25)" : "rgba(255,255,255,0.07)", border: `1px solid ${autoModeOn ? "rgba(0,255,136,0.4)" : "rgba(255,255,255,0.12)"}`, position: "relative", transition: "all 0.2s" }}>
            <motion.div animate={{ x: autoModeOn ? 13 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{ position: "absolute", top: 2, width: 10, height: 10, borderRadius: "50%", background: autoModeOn ? "#00ff88" : "rgba(255,255,255,0.3)", boxShadow: autoModeOn ? "0 0 4px rgba(0,255,136,0.7)" : "none" }} />
          </div>
        </motion.button>

        {/* REAL MODE — disabled until Android bridge is ready */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={handleRealModeTap}
          title="Modo real via Android AccessibilityService (em breve)"
          style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "7px 9px", cursor: "pointer", opacity: 0.55 }}
        >
          <Lock size={12} color="rgba(255,255,255,0.4)" />
          <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>REAL</span>
        </motion.button>

        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setVoiceOn((v) => !v)}
          style={{ width: 34, height: 34, borderRadius: 10, background: voiceOn ? "rgba(0,255,136,0.07)" : "rgba(255,255,255,0.04)", border: `1px solid ${voiceOn ? "rgba(0,255,136,0.18)" : "rgba(255,255,255,0.07)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {voiceOn ? <Volume2 size={15} color="#00ff88" /> : <VolumeX size={15} color="rgba(255,255,255,0.4)" />}
        </motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCosts(true)}
          style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Settings2 size={15} color="rgba(255,255,255,0.45)" />
        </motion.button>
      </div>

      {/* ── Real Mode info banner ── */}
      <AnimatePresence>
        {showRealModeInfo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            style={{ position: "fixed", bottom: 88, left: 16, right: 16, zIndex: 300, background: "#181818", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "16px 18px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Smartphone size={18} color="#818cf8" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                  Modo automático real em breve (Android)
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                  Detectará corridas automaticamente pelo Accessibility Service do Android — sem captura manual. Disponível na versão APK.
                </p>
              </div>
              <button onClick={() => setShowRealModeInfo(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 18, lineHeight: 1, padding: "0 0 0 4px" }}>×</button>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
              <Lock size={11} color="rgba(99,102,241,0.6)" />
              <span style={{ fontSize: 10, color: "rgba(99,102,241,0.7)", fontWeight: 700, letterSpacing: "0.04em" }}>
                Provider: {REAL_PROVIDER.isAvailable ? "disponível" : "aguardando bridge Android"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab bar ── */}
      {state.kind === "idle" && (
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {(["capture", "history"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: "13px 8px", background: "none", border: "none", borderBottom: `2.5px solid ${tab === t ? "#00ff88" : "transparent"}`, fontSize: 12, fontWeight: tab === t ? 800 : 500, color: tab === t ? "#00ff88" : "rgba(255,255,255,0.35)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all 0.18s" }}>
              {t === "capture"
                ? <><Camera size={14} />Capturar</>
                : <><History size={14} />Histórico {history.length > 0 ? `(${history.length})` : ""}</>}
            </button>
          ))}
        </div>
      )}

      {/* ── Error banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.18)", padding: "11px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <XCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#ef4444", flex: 1 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", fontSize: 20, lineHeight: 1 }}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div style={{ padding: "16px 16px 120px" }}>

        {/* Floating widget — last auto detected ride */}
        <AnimatePresence>
          {autoModeOn && state.kind === "idle" && lastFeedItem && (
            <FloatingWidget key={lastFeedItem.uid} item={lastFeedItem} />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {state.kind === "idle" && tab === "capture" && (
            autoModeOn
              ? <MonitoringScreen key="monitoring" feed={autoFeed} onToggleOff={toggleAutoMode} />
              : <IdleScreen key="idle" onCapture={handleCapture} todayStats={todayStats} />
          )}
          {state.kind === "idle" && tab === "history" && (
            <HistoryScreen key="hist" offers={history} />
          )}
          {state.kind === "result" && (
            <ResultScreen key="result" result={state.result} previewUrl={state.previewUrl}
              onDecision={handleDecision} onNewCapture={resetToIdle}
              onCorrect={() => setState({ kind: "correcting", result: state.result, previewUrl: state.previewUrl })} />
          )}
          {state.kind === "correcting" && (
            <CorrectionScreen key="correct" result={state.result} costs={costs}
              onApply={(r) => setState({ kind: "result", result: r, previewUrl: state.previewUrl })}
              onBack={() => setState({ kind: "result", result: state.result, previewUrl: state.previewUrl })} />
          )}
        </AnimatePresence>
      </div>

      {/* ── Cost sheet ── */}
      <AnimatePresence>
        {showCosts && <CostSheet costs={costs} onSave={(c) => { saveCosts(c); setCosts(c); }} onClose={() => setShowCosts(false)} />}
      </AnimatePresence>
    </div>
  );
}
