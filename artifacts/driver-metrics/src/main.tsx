import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { setBaseUrl } from "@workspace/api-client-react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import "./index.css";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

console.log("APP START: main.tsx loaded", {
  base: import.meta.env.BASE_URL,
  mode: import.meta.env.MODE,
  native: Capacitor.isNativePlatform(),
});

/* ── Capacitor: point API client at the remote server ─────────────────────── */
const apiBaseOverride = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBaseOverride) {
  setBaseUrl(apiBaseOverride);
}

/* ── Service Worker — skip inside Capacitor native shell ──────────────────── */
if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (worker) {
            worker.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                worker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
);
