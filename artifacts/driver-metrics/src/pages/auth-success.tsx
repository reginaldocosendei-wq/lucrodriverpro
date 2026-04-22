import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

export default function AuthSuccess() {
  const { setTokenAndFetchUser } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    console.log("[AUTH_SUCCESS] token from URL:", !!token);

    if (token) {
      setTokenAndFetchUser(token)
        .then(() => {
          console.log("[AUTH_SUCCESS] auth complete — navigating to /");
          navigate("/");
        })
        .catch(() => {
          console.warn("[AUTH_SUCCESS] setTokenAndFetchUser failed — navigating to /");
          navigate("/");
        });
    } else {
      console.warn("[AUTH_SUCCESS] no token in URL — redirecting to /login");
      navigate("/login");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#080808",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid rgba(0,255,136,0.15)",
          borderTopColor: "#00ff88",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
