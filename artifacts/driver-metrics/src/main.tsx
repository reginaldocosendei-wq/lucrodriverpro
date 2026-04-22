import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { setBaseUrl } from "@workspace/api-client-react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import "./index.css";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

// Production API — must match the deployed server domain.
// This is the single source of truth for the native fallback URL.
const PRODUCTION_API = "https://lucrodriverpro.com";

// VITE_API_BASE_URL is baked in at build time by `build:android`.
// If the build was done without it (old APK / missing CI secret), we fall
// back to PRODUCTION_API when on a native platform.
const apiBaseOverride = import.meta.env.VITE_API_BASE_URL as string | undefined;

console.log("APP START: main.tsx loaded", {
  base:          import.meta.env.BASE_URL,
  mode:          import.meta.env.MODE,
  native:        Capacitor.isNativePlatform(),
  apiBaseEnv:    apiBaseOverride ?? "(not set)",
});

/* ── API base URL for generated hooks (customFetch / setBaseUrl) ────────────
 * On Android (native), ALL API calls must use an absolute URL because
 * relative paths like /api/auth/me resolve to https://localhost/api/auth/me
 * which is Capacitor's local WebView server — not the real backend.
 * We use the baked-in env var if available, otherwise fall back to the
 * production domain so the APK always calls the right server.
 * ─────────────────────────────────────────────────────────────────────── */
if (Capacitor.isNativePlatform()) {
  const base = apiBaseOverride || PRODUCTION_API;
  setBaseUrl(base);
  console.log("[NATIVE] setBaseUrl →", base);
} else if (apiBaseOverride) {
  // Web / PWA: only override if env var is explicitly set
  setBaseUrl(apiBaseOverride);
  console.log("[WEB] setBaseUrl →", apiBaseOverride);
}

/* ── Service Worker — disabled to prevent stale bundle caching ─────────── */
if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister().then(() =>
        console.log("[SW] unregistered:", reg.scope)
      );
    }
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((k) => {
        caches.delete(k);
        console.log("[SW] cache deleted:", k);
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
);
