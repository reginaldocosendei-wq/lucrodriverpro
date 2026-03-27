import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Copy, Check, Clock } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { getApiBase } from "@/lib/api";

const BASE = getApiBase();

// ─── CONFIG — replace these with the real PIX details ────────────────────────
const PIX_KEY        = "contato@lucrodriver.com.br";
const PIX_NAME       = "Lucro Driver";
const PIX_CITY       = "Sao Paulo";
const PIX_AMOUNT     = "19.90";
const PIX_TXID       = "LUCROPRO";
const WHATSAPP_NUMBER = "5511999999999"; // ← replace with your WhatsApp number (country code + number, no spaces or symbols)

// ─── PIX EMV GENERATOR ────────────────────────────────────────────────────────
function tlv(id: string, value: string) {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function buildPixPayload(key: string, name: string, city: string, amount: string, txid: string): string {
  const accountInfo =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", key);

  let payload =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("26", accountInfo) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", name.substring(0, 25).padEnd(1, " ").trim()) +
    tlv("60", city.substring(0, 15).padEnd(1, " ").trim()) +
    tlv("62", tlv("05", txid || "***")) +
    "6304";

  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
    }
    crc &= 0xffff;
  }
  return payload + crc.toString(16).toUpperCase().padStart(4, "0");
}

const PIX_PAYLOAD = buildPixPayload(PIX_KEY, PIX_NAME, PIX_CITY, PIX_AMOUNT, PIX_TXID);

// ─── COPY HOOK ────────────────────────────────────────────────────────────────
function useCopy(text: string, resetMs = 2200) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), resetMs);
  };
  return { copied, copy };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function PixPaymentPage() {
  const [, navigate]  = useLocation();
  const [step, setStep] = useState<"payment" | "pending">("payment");
  const { data: user } = useGetMe();
  const { copied: keyCopied, copy: copyKey }   = useCopy(PIX_KEY);
  const { copied: codeCopied, copy: copyCode } = useCopy(PIX_PAYLOAD);

  const handlePaid = () => {
    const email = (user as any)?.email ?? "";

    fetch(`${BASE}/api/pix/request`, { method: "POST", credentials: "include" })
      .catch(() => {});

    const text = encodeURIComponent(
      `Olá, acabei de pagar o Lucro Driver PRO via Pix.\n\nMeu email é: ${email}\n\nSegue o comprovante:`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
    setStep("pending");
  };

  return (
    <div style={{
      minHeight: "100dvh", background: "#080808",
      display: "flex", flexDirection: "column",
    }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "#080808",
      }}>
        <button
          onClick={() => step === "pending" ? navigate("/") : navigate("/upgrade")}
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
        <span style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", letterSpacing: "-0.01em" }}>
          Pagamento via Pix
        </span>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 40px" }}>
        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════════════════════
              PAYMENT STATE
          ══════════════════════════════════════════════════════════════ */}
          {step === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >

              {/* Amount badge */}
              <div style={{ display: "flex", justifyContent: "center", padding: "28px 0 24px" }}>
                <div style={{
                  display: "inline-flex", flexDirection: "column", alignItems: "center",
                  gap: 4,
                }}>
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

              {/* QR Code block */}
              <div style={{
                background: "#0e0e0e",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 24,
                padding: "28px 24px 24px",
                marginBottom: 14,
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                {/* Label */}
                <p style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase",
                  marginBottom: 20,
                }}>
                  Escaneie o código QR
                </p>

                {/* QR */}
                <div style={{
                  background: "#ffffff", borderRadius: 16, padding: 16,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                }}>
                  <QRCodeSVG
                    value={PIX_PAYLOAD}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    level="M"
                    marginSize={0}
                  />
                </div>

                {/* Pix logo line */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 18,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(0,255,136,0.08)",
                    border: "1px solid rgba(0,255,136,0.14)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14,
                  }}>
                    🔑
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                    PIX instantâneo · disponível 24h
                  </span>
                </div>
              </div>

              {/* PIX key copy */}
              <div style={{
                background: "#0e0e0e",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18, padding: "16px 18px",
                marginBottom: 14,
              }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 10,
                }}>
                  Ou copie a chave Pix
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    flex: 1, background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
                    padding: "11px 14px",
                    fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500,
                    fontFamily: "monospace", letterSpacing: "0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    minWidth: 0,
                  }}>
                    {PIX_KEY}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={copyKey}
                    style={{
                      flexShrink: 0, height: 44, paddingInline: 18,
                      borderRadius: 12,
                      border: keyCopied ? "1px solid rgba(0,255,136,0.25)" : "1px solid rgba(255,255,255,0.1)",
                      background: keyCopied ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.07)",
                      color: keyCopied ? "#00ff88" : "rgba(255,255,255,0.6)",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      fontFamily: "inherit",
                      transition: "all 0.2s ease",
                    } as React.CSSProperties}
                  >
                    {keyCopied
                      ? <><Check size={14} strokeWidth={2.5} /> Copiado</>
                      : <><Copy size={14} strokeWidth={2} /> Copiar</>
                    }
                  </motion.button>
                </div>
              </div>

              {/* Copy full code (copia e cola) */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={copyCode}
                style={{
                  width: "100%", height: 48, borderRadius: 14, cursor: "pointer",
                  background: codeCopied ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${codeCopied ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`,
                  color: codeCopied ? "#00ff88" : "rgba(255,255,255,0.4)",
                  fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  fontFamily: "inherit",
                  transition: "all 0.2s ease",
                  marginBottom: 24,
                }}
              >
                {codeCopied
                  ? <><Check size={14} strokeWidth={2.5} /> Código PIX copiado</>
                  : <><Copy size={13} strokeWidth={2} /> Copiar código Pix Copia e Cola</>
                }
              </motion.button>

              {/* Instructions */}
              <div style={{
                background: "rgba(0,255,136,0.03)",
                border: "1px solid rgba(0,255,136,0.1)",
                borderRadius: 16, padding: "14px 16px",
                display: "flex", alignItems: "flex-start", gap: 12,
                marginBottom: 24,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, marginTop: 1,
                }}>
                  1
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, fontWeight: 500 }}>
                  Faça o pagamento via Pix e depois clique em{" "}
                  <strong style={{ color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>confirmar</strong>.
                  Seu acesso PRO será ativado em até 2 horas.
                </p>
              </div>

              {/* CTA */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePaid}
                style={{
                  width: "100%", height: 60, borderRadius: 18, border: "none",
                  background: "#00ff88", color: "#000",
                  fontWeight: 900, fontSize: 17, letterSpacing: "-0.015em",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  boxShadow: "0 4px 20px rgba(0,255,136,0.2)",
                  fontFamily: "inherit",
                }}
              >
                <Check size={20} strokeWidth={2.8} />
                Já paguei — Enviar comprovante
              </motion.button>

              <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 14, lineHeight: 1.6 }}>
                Pague apenas após confirmar o valor na sua conta. Dúvidas? contato@lucrodriver.com.br
              </p>

            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PENDING STATE
          ══════════════════════════════════════════════════════════════ */}
          {step === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                minHeight: "70vh", textAlign: "center", padding: "0 8px",
              }}
            >
              {/* Icon */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  width: 80, height: 80, borderRadius: 24,
                  background: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 24,
                }}
              >
                <Clock size={34} color="#00ff88" strokeWidth={1.8} />
              </motion.div>

              {/* Text */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <p style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb", letterSpacing: "-0.02em", marginBottom: 10 }}>
                  Pagamento enviado!
                </p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, maxWidth: 280, margin: "0 auto 32px" }}>
                  Seu acesso PRO será ativado em até 2 horas após a confirmação do pagamento.
                </p>
              </motion.div>

              {/* Status chip */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.4 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.2)",
                  borderRadius: 20, padding: "8px 16px", marginBottom: 36,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308", opacity: 0.9 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#eab308", letterSpacing: "0.04em" }}>
                  Aguardando confirmação
                </span>
              </motion.div>

              {/* Back button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.44, duration: 0.35 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/")}
                style={{
                  width: "100%", maxWidth: 320, height: 54, borderRadius: 16,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: 15,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Voltar ao início
              </motion.button>

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
