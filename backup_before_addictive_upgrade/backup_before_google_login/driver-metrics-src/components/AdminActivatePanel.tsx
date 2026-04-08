/**
 * AdminActivatePanel — floating admin shortcut, visible only to the configured
 * admin email (VITE_ADMIN_EMAIL env var). Sends x-admin-secret header when
 * calling POST /api/admin/activate-pro.
 *
 * Rendered inside Layout, fixed-position so it sits above the bottom nav.
 */

import { useState } from "react";
import { Shield, X } from "lucide-react";
import { getApiBase } from "@/lib/api";

const BASE   = getApiBase();
const SECRET = (import.meta.env.VITE_ADMIN_SECRET ?? "") as string;

interface Props {
  userEmail: string | undefined;
}

export function AdminActivatePanel({ userEmail }: Props) {
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL ?? "") as string;

  if (!adminEmail || !userEmail) return null;
  if (userEmail.toLowerCase() !== adminEmail.toLowerCase()) return null;

  return <FloatingPanel />;
}

function FloatingPanel() {
  const [open, setOpen]       = useState(false);
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<{ ok: boolean; msg: string } | null>(null);

  const activate = async () => {
    const target = email.trim();
    if (!target) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${BASE}/api/admin/activate-pro`, {
        method:      "POST",
        credentials: "include",
        headers: {
          "Content-Type":   "application/json",
          "x-admin-secret": SECRET,
        },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({ ok: true, msg: data.message ?? "PRO ativado" });
        setEmail("");
      } else {
        setStatus({ ok: false, msg: data.error ?? "Erro ao ativar PRO" });
      }
    } catch {
      setStatus({ ok: false, msg: "Erro de conexão" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Admin: Ativar PRO"
          style={{
            position:     "fixed",
            bottom:       84,   // above the 64px bottom nav + 20px margin
            right:        16,
            width:        40,
            height:       40,
            borderRadius: "50%",
            background:   "rgba(99,102,241,0.15)",
            border:       "1px solid rgba(99,102,241,0.4)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            cursor:       "pointer",
            zIndex:       200,
            boxShadow:    "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <Shield size={18} color="#818cf8" strokeWidth={2} />
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          style={{
            position:     "fixed",
            bottom:       80,
            right:        12,
            width:        "min(300px, calc(100vw - 24px))",
            borderRadius: 16,
            border:       "1px solid rgba(99,102,241,0.3)",
            background:   "#0d0d14",
            boxShadow:    "0 8px 40px rgba(0,0,0,0.7)",
            zIndex:       200,
            overflow:     "hidden",
          }}
        >
          {/* Panel header */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            gap:            8,
            padding:        "12px 14px",
            borderBottom:   "1px solid rgba(99,102,241,0.15)",
          }}>
            <Shield size={14} color="#818cf8" strokeWidth={2} />
            <span style={{
              flex:          1,
              fontSize:      12,
              fontWeight:    700,
              color:         "#818cf8",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              Admin · Ativar PRO
            </span>
            <button
              onClick={() => { setOpen(false); setStatus(null); }}
              style={{
                background: "none",
                border:     "none",
                cursor:     "pointer",
                padding:    4,
                display:    "flex",
                alignItems: "center",
              }}
            >
              <X size={15} color="rgba(255,255,255,0.4)" />
            </button>
          </div>

          {/* Panel body */}
          <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              placeholder="email do usuário"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && activate()}
              style={{
                width:        "100%",
                height:       40,
                borderRadius: 10,
                border:       "1px solid rgba(255,255,255,0.1)",
                background:   "rgba(255,255,255,0.05)",
                color:        "#f9fafb",
                fontSize:     13,
                padding:      "0 12px",
                fontFamily:   "inherit",
                boxSizing:    "border-box",
                outline:      "none",
              }}
            />

            <button
              onClick={activate}
              disabled={loading || !email.trim()}
              style={{
                height:       40,
                borderRadius: 10,
                border:       "none",
                background:   loading || !email.trim()
                  ? "rgba(99,102,241,0.3)"
                  : "#6366f1",
                color:        "#fff",
                fontSize:     13,
                fontWeight:   700,
                cursor:       loading || !email.trim() ? "not-allowed" : "pointer",
                fontFamily:   "inherit",
                transition:   "background 0.15s",
              }}
            >
              {loading ? "Ativando…" : "Ativar PRO"}
            </button>

            {status && (
              <p style={{
                fontSize:   12,
                fontWeight: 600,
                color:      status.ok ? "#4ade80" : "#f87171",
                margin:     0,
                textAlign:  "center",
              }}>
                {status.ok ? "✓ " : "✗ "}{status.msg}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
