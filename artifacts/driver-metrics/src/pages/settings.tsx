import { useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, RefreshCw, PlusSquare, Check, Info, Smartphone } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "@/lib/api";

const BASE = getApiBase();

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function fetchPreferences(): Promise<{ saveModeReplace: boolean }> {
  const res = await fetch(`${BASE}/api/preferences`, { credentials: "include" });
  if (!res.ok) throw new Error("Erro ao buscar preferências");
  return res.json();
}

async function patchPreferences(body: { saveModeReplace: boolean }) {
  const res = await fetch(`${BASE}/api/preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Erro ao salvar preferência");
  return res.json();
}

// ─── OPTION CARD ──────────────────────────────────────────────────────────────
function ModeCard({
  selected,
  onClick,
  icon,
  title,
  desc,
  badge,
  badgeColor,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: "100%",
        background: selected ? "rgba(0,255,136,0.05)" : "rgba(255,255,255,0.025)",
        border: `1.5px solid ${selected ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 18,
        padding: "18px 18px 16px",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.2s, background 0.2s",
        fontFamily: "inherit",
        position: "relative",
        display: "block",
      }}
    >
      {/* Selected check */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{
              position: "absolute", top: 14, right: 14,
              width: 22, height: 22, borderRadius: "50%",
              background: "#00ff88",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Check size={12} color="#000" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: selected ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${selected ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{
              fontSize: 14, fontWeight: 800, color: selected ? "#f9fafb" : "rgba(255,255,255,0.75)",
              transition: "color 0.2s",
            }}>
              {title}
            </span>
            {badge && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                color: badgeColor ?? "#eab308",
                background: `${badgeColor ?? "#eab308"}18`,
                border: `1px solid ${badgeColor ?? "#eab308"}30`,
                borderRadius: 6, padding: "2px 7px",
                textTransform: "uppercase",
              }}>
                {badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.55, margin: 0 }}>
            {desc}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// ─── INSTALL SECTION ──────────────────────────────────────────────────────────
function InstallSection() {
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iP(hone|od|ad)/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const cardStyle: CSSProperties = {
    background: "#0e0e0e",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: "20px 18px",
    marginBottom: 16,
  };

  const sectionLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
  };

  if (isStandalone) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Smartphone size={14} color="rgba(255,255,255,0.35)" />
          <span style={sectionLabel}>Instalar aplicativo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(0,255,136,0.1)",
            border: "1px solid rgba(0,255,136,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, flexShrink: 0,
          }}>✓</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#00ff88", margin: 0 }}>
              App instalado
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>
              Você está usando a versão instalada do Lucro Driver.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Smartphone size={14} color="rgba(255,255,255,0.35)" />
        <span style={sectionLabel}>Instalar aplicativo</span>
      </div>

      {isIOS ? (
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 14px", lineHeight: 1.6 }}>
            Instale o Lucro Driver na tela inicial do iPhone ou iPad:
          </p>
          {[
            { n: "1", text: 'Toque no ícone Compartilhar ↑ na barra inferior do Safari' },
            { n: "2", text: 'Role e toque em "Adicionar à Tela de Início"' },
            { n: "3", text: 'Confirme tocando em "Adicionar" no canto superior direito' },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "rgba(0,255,136,0.08)",
                border: "1px solid rgba(0,255,136,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: "#00ff88", flexShrink: 0,
              }}>{n}</span>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.55 }}>{text}</p>
            </div>
          ))}
          <div style={{
            background: "rgba(234,179,8,0.05)",
            border: "1px solid rgba(234,179,8,0.12)",
            borderRadius: 10, padding: "10px 12px", marginTop: 4,
          }}>
            <p style={{ fontSize: 11, color: "rgba(234,179,8,0.65)", margin: 0, lineHeight: 1.55 }}>
              Disponível apenas no Safari. Chrome e outros navegadores no iPhone não suportam instalação de PWA.
            </p>
          </div>
        </div>
      ) : isAndroid ? (
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 12px", lineHeight: 1.6 }}>
            O Chrome mostrará automaticamente um banner de instalação na parte inferior da tela.
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6 }}>
            Se não aparecer, toque no menu <strong style={{ color: "rgba(255,255,255,0.6)" }}>⋮</strong> e escolha <strong style={{ color: "rgba(255,255,255,0.6)" }}>"Adicionar à tela inicial"</strong>.
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 12px", lineHeight: 1.6 }}>
            No Chrome ou Edge, clique no ícone de instalação <strong style={{ color: "rgba(255,255,255,0.6)" }}>⊕</strong> na barra de endereços para instalar o Lucro Driver como aplicativo no desktop.
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6 }}>
            Firefox e Safari no desktop não suportam instalação de PWA.
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Settings() {
  const [, navigate]   = useLocation();
  const queryClient    = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
  });

  const mutation = useMutation({
    mutationFn: patchPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences"], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    },
  });

  const saveModeReplace = prefs?.saveModeReplace ?? false;

  const handleToggle = (replace: boolean) => {
    if (mutation.isPending) return;
    mutation.mutate({ saveModeReplace: replace });
  };

  return (
    <div style={{ paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/")}
          style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={18} color="rgba(255,255,255,0.6)" />
        </motion.button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb", margin: 0, letterSpacing: "-0.02em" }}>
            Configurações
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, marginTop: 2 }}>
            Preferências do aplicativo
          </p>
        </div>
      </div>

      {/* Section: Save mode */}
      <div style={{
        background: "#0e0e0e",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
        padding: "20px 18px",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
            Modo de salvamento
          </span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", margin: "0 0 18px", lineHeight: 1.5 }}>
          O que fazer ao importar dados de um dia que já possui registro.
        </p>

        {isLoading ? (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "2.5px solid rgba(255,255,255,0.08)",
              borderTopColor: "#00ff88",
              animation: "spin 1s linear infinite",
            }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ModeCard
              selected={!saveModeReplace}
              onClick={() => handleToggle(false)}
              icon={<PlusSquare size={18} color={!saveModeReplace ? "#00ff88" : "rgba(255,255,255,0.35)"} />}
              title="Somar registros"
              desc="Os novos ganhos e corridas são adicionados ao registro existente do mesmo dia. Ideal para quem importa por plataforma separada."
              badge="Padrão"
              badgeColor="#00ff88"
            />
            <ModeCard
              selected={saveModeReplace}
              onClick={() => handleToggle(true)}
              icon={<RefreshCw size={17} color={saveModeReplace ? "#00ff88" : "rgba(255,255,255,0.35)"} />}
              title="Substituir registro"
              desc="O registro existente do dia é completamente substituído pelos novos dados. Use quando quiser corrigir um lançamento anterior."
            />
          </div>
        )}
      </div>

      {/* Install section */}
      <InstallSection />

      {/* Info note */}
      <div style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 14, padding: "12px 14px",
      }}>
        <Info size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: 0, lineHeight: 1.6 }}>
          Esta configuração se aplica tanto na importação por screenshot quanto no lançamento manual.
          Dias sem registro anterior sempre criam um novo registro, independente do modo.
        </p>
      </div>

      {/* Save feedback toast */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)",
              background: "#00ff88", borderRadius: 14,
              padding: "11px 20px",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 8px 28px rgba(0,255,136,0.35)",
              zIndex: 999, pointerEvents: "none",
            }}
          >
            <Check size={14} color="#000" strokeWidth={3} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#000" }}>
              Preferência salva
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
