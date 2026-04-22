import { storageGetSync, storageSetSync, storageRemoveSync } from "@/lib/storage";
import { Capacitor } from "@capacitor/core";

// Production API domain — used as hard fallback when VITE_API_BASE_URL is not
// baked in at build time (e.g. CI didn't pass the env var).
const PRODUCTION_DOMAIN = "https://lucrodriverpro.com";

/**
 * Returns the API base URL prefix to prepend to all manual fetch calls.
 *
 * Priority:
 * 1. VITE_API_BASE_URL (baked in at build time by `build:android`)
 * 2. On native Android with no override → production domain (safety fallback)
 * 3. Browser (Replit dev/prod) → Vite BASE_URL (e.g. "/driver-metrics")
 */
export function getApiBase(): string {
  const override = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (override) {
    return override.replace(/\/+$/, "");
  }
  // On native (Android APK), relative URLs hit the Capacitor local WebView
  // server (https://localhost) instead of the real backend — always use the
  // absolute production domain.
  if (Capacitor.isNativePlatform()) {
    console.warn("[API_BASE] VITE_API_BASE_URL not set — using production fallback:", PRODUCTION_DOMAIN);
    return PRODUCTION_DOMAIN;
  }
  return import.meta.env.BASE_URL.replace(/\/+$/, "");
}

/**
 * Drop-in replacement for fetch() that always injects the JWT Bearer token
 * from the storage cache alongside session cookies.
 */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = storageGetSync("auth_token");
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { credentials: "include", ...init, headers });
}

// ─── Cached user helpers ───────────────────────────────────────────────────────
// These are now thin wrappers around the storage adapter.
// The auth-context is the primary owner of user persistence;
// these helpers remain for compatibility with other parts of the app.

export function storeAuthUser(user: Record<string, unknown>): void {
  try {
    storageSetSync("auth_user", JSON.stringify(user));
  } catch {}
}

export function loadAuthUser(): Record<string, unknown> | null {
  try {
    const s = storageGetSync("auth_user");
    return s ? (JSON.parse(s) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function clearAuthUser(): void {
  storageRemoveSync("auth_user");
}
