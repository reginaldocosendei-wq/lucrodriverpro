import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function HealthCheckPage() {
  const [, navigate] = useLocation();
  const [ts] = useState(() => new Date().toISOString());

  useEffect(() => {
    console.log("HEALTH-CHECK MOUNTED", { ts });
  }, [ts]);

  return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, padding: "0 24px", textAlign: "center",
    }}>
      <div style={{
        padding: "40px 56px", background: "#00ff88",
        borderRadius: 28, maxWidth: 480, width: "100%",
      }}>
        <p style={{ fontSize: 36, fontWeight: 900, color: "#000", margin: 0, letterSpacing: "-0.02em" }}>
          APP IS RUNNING
        </p>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", margin: "10px 0 0", fontFamily: "monospace" }}>
          Router ✓ &nbsp;|&nbsp; JS bundle ✓ &nbsp;|&nbsp; React ✓
        </p>
        <p style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", margin: "6px 0 0", fontFamily: "monospace" }}>
          {ts}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            height: 48, borderRadius: 14, border: "none",
            background: "rgba(255,255,255,0.06)", color: "#fff",
            fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ← Voltar ao início
        </button>
        <button
          onClick={() => navigate("/import-test")}
          style={{
            height: 48, borderRadius: 14, border: "none",
            background: "rgba(255,255,255,0.06)", color: "#fff",
            fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          → Import Test
        </button>
        <button
          onClick={() => navigate("/login-test")}
          style={{
            height: 48, borderRadius: 14, border: "none",
            background: "rgba(255,255,255,0.06)", color: "#fff",
            fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          → Login Test
        </button>
      </div>
    </div>
  );
}
