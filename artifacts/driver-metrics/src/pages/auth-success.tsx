import { useEffect } from "react";

export default function AuthSuccess() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("auth_token", token);
      console.log("[auth-success] token stored in localStorage — redirecting to /rides");
      window.location.href = "/rides";
    } else {
      console.log("[auth-success] no token found — redirecting to /");
      window.location.href = "/";
    }
  }, []);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#080808",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(0,255,136,0.2)",
          borderTopColor: "#00ff88",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 500 }}>
          Entrando…
        </p>
      </div>
    </div>
  );
}
