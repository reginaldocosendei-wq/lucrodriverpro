import { storageGetSync, storageSetSync, storageRemoveSync } from "@/lib/storage";

/**
 * Returns the API base URL prefix to prepend to all manual fetch calls.
 *
 * - In browser (Replit dev/prod): uses Vite's BASE_URL (e.g. "/driver-metrics")
 * - In Android (Capacitor): uses VITE_API_BASE_URL pointing at the deployed server
 *   e.g. "https://your-app.replit.app"
 */
export function getApiBase(): string {
  const override = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (override) {
    return override.replace(/\/+$/, "");
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
