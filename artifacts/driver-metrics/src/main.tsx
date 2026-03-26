import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);
