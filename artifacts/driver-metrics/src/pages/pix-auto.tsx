/**
 * PIX automático via Mercado Pago
 *
 * Flow:
 *   mount → POST /api/pix/mp/create → show QR + start polling
 *   every 5 s → GET /api/pix/mp/status/:id
 *   approved → activate PRO → redirect home
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Copy, Check, Clock, Loader, AlertTriangle, Sparkles,
} from "lucide-react";
import { getApiBase } from "@/lib/api";

const BASE = getApiBase();
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 360; // 30 min ÷ 5 s

// ─── types ────────────────────────────────────────────────────────────────────

type PageState = "creating" | "pending" | "approved" | "failed" | "unconfigured";

interface PixData {
  pixPaymentId: number;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string | null;
}

// ─── copy hook ────────────────────────────────────────────────────────────────

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [text]);
  return { copied, copy };
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function PixAutoPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Auto-PIX is temporarily unavailable — start directly in unconfigured state
  const [state, setState] = useState<PageState>("unconfigured");
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [pollCount, setPollCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { copied, copy } = useCopy(pixData?.qrCode ?? "");

  // ── create payment on mount ─────────────────────────────────────────────────
  const createPayment = useCallback(async () => {
    setState("creating");
    setErrorMsg("");
    setPixData(null);
    setPollCount(0);

    try {
      const res = await fetch(`${BASE}/api/pix/mp/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 503) {
        setState("unconfigured");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error ?? "Erro ao gerar o PIX. Tente novamente.");
        setState("failed");
        return;
      }

      const data = await res.json();
      setPixData({
        pixPaymentId: data.pixPaymentId,
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        expiresAt: data.expiresAt,
      });
      setState("pending");
    } catch {
      setErrorMsg("Erro de conexão. Verifique sua internet e tente novamente.");
      setState("failed");
    }
  }, []);

  // Auto-PIX disabled until MERCADOPAGO_ACCESS_TOKEN is configured.
  // Remove this comment and restore createPayment() call when ready to enable.
  useEffect(() => {}, [createPayment]);

  // ── polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== "pending" || !pixData) return;

    const interval = setInterval(async () => {
      setPollCount((n) => {
        if (n >= MAX_POLLS) {
          clearInterval(interval);
          setErrorMsg("O PIX expirou. Gere um novo pagamento.");
          setState("failed");
        }
        return n + 1;
      });

      try {
        const res = await fetch(
          `${BASE}/api/pix/mp/status/${pixData.pixPaymentId}`,
          { credentials: "include" },
        );

        if (!res.ok) return;

        const { status } = await res.json();

        if (status === "approved") {
          clearInterval(interval);
          setState("approved");
          queryClient.invalidateQueries({ queryKey: ["me"] });
          setTimeout(() => navigate("/"), 3500);
        } else if (
          status === "cancelled" ||
          status === "rejected" ||
          status === "expired"
        ) {
          clearInterval(interval);
          setErrorMsg("Este PIX foi cancelado ou expirou. Gere um novo pagamento.");
          setState("failed");
        }
      } catch {
        // silent — keep polling
      }
    }, POLL_INTERVAL_MS);

    pollRef.current = interval;
    return () => clearInterval(interval);
  }, [state, pixData, queryClient, navigate]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#080808",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── header ─────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "#080808",
      }}>
        <button
          onClick={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            navigate(state === "approved" ? "/" : "/upgrade");
          }}
          style={{
            width: 36, height: 36, borderRadius: 11,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={20} color="rgba(255,255,255,0.55)" />
        </button>
        <span style={{
          fontSize: 16, fontWeight: 700, color: "#f9fafb", letterSpacing: "-0.01em",
        }}>
          Pague com PIX
        </span>
      </div>

      {/* ── content ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 48px" }}>
        <AnimatePresence mode="wait">

          {/* ═══ CREATING (loading) ══════════════════════════════════════════ */}
          {state === "creating" && (
            <motion.div
              key="creating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                minHeight: "60vh", gap: 20,
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.08)",
                  borderTopColor: "#00ff88",
                }}
              />
              <p style={{
                fontSize: 14, color: "rgba(255,255,255,0.4)",
                fontWeight: 500, letterSpacing: "0.01em",
              }}>
                Gerando seu QR Code PIX…
              </p>
            </motion.div>
          )}

          {/* ═══ PENDING (show QR + poll) ════════════════════════════════════ */}
          {state === "pending" && pixData && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Amount badge */}
              <div style={{ display: "flex", justifyContent: "center", padding: "28px 0 24px" }}>
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
                  }}>
                    PRO Mensal
                  </span>
                  <span style={{
                    fontSize: 44, fontWeight: 900, color: "#f9fafb",
                    letterSpacing: "-0.03em", lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    R$19,90
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                    por mês
                  </span>
                </div>
              </div>

              {/* QR code card */}
              <div style={{
                background: "#0e0e0e",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 24,
                padding: "28px 24px 24px",
                marginBottom: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
                  marginBottom: 20,
                }}>
                  Escaneie o QR Code ou copie o código PIX
                </p>

                {/* QR image — prefer MP base64, fallback to qrcode.react */}
                <div style={{
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                }}>
                  {pixData.qrCodeBase64 ? (
                    <img
                      src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                      alt="QR Code PIX"
                      style={{ width: 200, height: 200, display: "block" }}
                    />
                  ) : (
                    <QRCodeSVG
                      value={pixData.qrCode}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#0a0a0a"
                      level="M"
                      marginSize={0}
                    />
                  )}
                </div>

                {/* Polling indicator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 20,
                }}>
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#00ff88",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                    Aguardando confirmação do pagamento…
                  </span>
                </div>

                {/* Expiry note */}
                {pixData.expiresAt && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5, marginTop: 8,
                  }}>
                    <Clock size={11} color="rgba(255,255,255,0.2)" />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>
                      Expira em 30 minutos
                    </span>
                  </div>
                )}
              </div>

              {/* Copy-paste button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={copy}
                disabled={!pixData.qrCode}
                style={{
                  width: "100%",
                  height: 56,
                  borderRadius: 16,
                  cursor: "pointer",
                  background: copied
                    ? "rgba(0,255,136,0.12)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${copied ? "rgba(0,255,136,0.25)" : "rgba(255,255,255,0.1)"}`,
                  color: copied ? "#00ff88" : "rgba(255,255,255,0.7)",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  transition: "all 0.2s ease",
                  marginBottom: 14,
                }}
              >
                {copied ? (
                  <><Check size={16} strokeWidth={2.5} /> Código PIX copiado!</>
                ) : (
                  <><Copy size={15} strokeWidth={2} /> Copiar código PIX Copia e Cola</>
                )}
              </motion.button>

              {/* Instruction */}
              <div style={{
                background: "rgba(0,255,136,0.03)",
                border: "1px solid rgba(0,255,136,0.1)",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 24,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(0,255,136,0.1)",
                  border: "1px solid rgba(0,255,136,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#00ff88",
                }}>
                  1
                </div>
                <p style={{
                  fontSize: 13, color: "rgba(255,255,255,0.5)",
                  lineHeight: 1.65, fontWeight: 500,
                }}>
                  Abra seu banco ou carteira digital, escaneie o QR Code ou cole o código PIX.
                  Seu acesso PRO será ativado <strong style={{ color: "rgba(255,255,255,0.8)" }}>automaticamente</strong> após a confirmação.
                </p>
              </div>

              {/* Fallback to manual */}
              <p style={{
                textAlign: "center",
                fontSize: 11,
                color: "rgba(255,255,255,0.2)",
                lineHeight: 1.6,
              }}>
                Problema com o PIX automático?{" "}
                <button
                  onClick={() => navigate("/pix-payment")}
                  style={{
                    background: "none", border: "none",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 11, fontWeight: 700,
                    cursor: "pointer", textDecoration: "underline",
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                >
                  Use o PIX manual
                </button>
              </p>
            </motion.div>
          )}

          {/* ═══ APPROVED ════════════════════════════════════════════════════ */}
          {state === "approved" && (
            <motion.div
              key="approved"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                minHeight: "70vh", textAlign: "center", padding: "0 8px",
              }}
            >
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  width: 88, height: 88, borderRadius: 26,
                  background: "rgba(0,255,136,0.1)",
                  border: "1px solid rgba(0,255,136,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 28,
                }}
              >
                <Sparkles size={38} color="#00ff88" strokeWidth={1.6} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <p style={{
                  fontSize: 26, fontWeight: 900, color: "#f9fafb",
                  letterSpacing: "-0.025em", marginBottom: 10,
                }}>
                  Pagamento confirmado!
                </p>
                <p style={{
                  fontSize: 15, color: "#00ff88", fontWeight: 700,
                  letterSpacing: "-0.01em", marginBottom: 8,
                }}>
                  PRO ativado com sucesso.
                </p>
                <p style={{
                  fontSize: 13, color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.65, maxWidth: 280, margin: "0 auto 32px",
                }}>
                  Bem-vindo ao Lucro Driver PRO! Você será redirecionado em instantes.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.36, duration: 0.4 }}
              >
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(0,255,136,0.06)",
                  border: "1px solid rgba(0,255,136,0.14)",
                  borderRadius: 50, padding: "10px 20px",
                }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                    style={{
                      width: 14, height: 14, borderRadius: "50%",
                      border: "2px solid rgba(0,255,136,0.15)",
                      borderTopColor: "#00ff88",
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#00ff88" }}>
                    Redirecionando…
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══ UNCONFIGURED ════════════════════════════════════════════════ */}
          {state === "unconfigured" && (
            <motion.div
              key="unconfigured"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                minHeight: "65vh", textAlign: "center", padding: "0 8px",
              }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: 22,
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 24,
              }}>
                <Clock size={30} color="#fbbf24" strokeWidth={1.8} />
              </div>
              <p style={{
                fontSize: 20, fontWeight: 800, color: "#f9fafb",
                letterSpacing: "-0.02em", marginBottom: 10,
              }}>
                PIX automático estará disponível em breve
              </p>
              <p style={{
                fontSize: 13, color: "rgba(255,255,255,0.4)",
                lineHeight: 1.65, maxWidth: 280, margin: "0 auto 28px",
              }}>
                Use o PIX manual por enquanto — seu acesso PRO é ativado em até 2 horas após a confirmação.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/pix-payment")}
                style={{
                  height: 52, paddingInline: 28,
                  borderRadius: 16, border: "none",
                  background: "#00ff88", color: "#000",
                  fontWeight: 800, fontSize: 15,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Usar PIX manual
              </motion.button>
            </motion.div>
          )}

          {/* ═══ FAILED ══════════════════════════════════════════════════════ */}
          {state === "failed" && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                minHeight: "65vh", textAlign: "center", padding: "0 8px",
              }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: 22,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 24,
              }}>
                <AlertTriangle size={30} color="#f87171" strokeWidth={1.8} />
              </div>
              <p style={{
                fontSize: 20, fontWeight: 800, color: "#f9fafb",
                letterSpacing: "-0.02em", marginBottom: 10,
              }}>
                {errorMsg.includes("expirou") ? "PIX expirado" : "Algo deu errado"}
              </p>
              <p style={{
                fontSize: 13, color: "rgba(255,255,255,0.4)",
                lineHeight: 1.65, maxWidth: 280, margin: "0 auto 28px",
              }}>
                {errorMsg || "Não foi possível processar o pagamento."}
              </p>
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 12, width: "100%", maxWidth: 320,
              }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={createPayment}
                  style={{
                    width: "100%", height: 52, borderRadius: 16, border: "none",
                    background: "#00ff88", color: "#000",
                    fontWeight: 800, fontSize: 15,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <Loader size={16} strokeWidth={2.5} />
                  Gerar novo PIX
                </motion.button>
                <button
                  onClick={() => navigate("/pix-payment")}
                  style={{
                    background: "none", border: "none",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Usar PIX manual
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
