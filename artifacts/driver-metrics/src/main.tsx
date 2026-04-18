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

/* ── Service Worker — DISABLED: unregister all active workers ─────────────── */
// SW disabled because stale-while-revalidate caching serves old JS bundles
// after deploys, causing the new auth flow to never reach the user's browser.
if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister().then(() =>
        console.log("[SW] unregistered:", reg.scope)
      );
    }
  });
  // Also wipe all caches so stale JS/CSS bundles are evicted immediately.
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
