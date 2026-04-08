export default function LoginTestPage() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    }}>
      <div style={{
        padding: "32px 48px",
        background: "#eab308",
        borderRadius: 24,
        textAlign: "center",
      }}>
        <p style={{ fontSize: 32, fontWeight: 900, color: "#000", margin: 0 }}>
          LOGIN TEST PAGE
        </p>
        <p style={{ fontSize: 14, color: "#000", opacity: 0.6, margin: "8px 0 0" }}>
          Click handler + route both work ✓
        </p>
      </div>
      <a href="/" style={{ color: "#00ff88", fontSize: 14 }}>← voltar ao início</a>
    </div>
  );
}
