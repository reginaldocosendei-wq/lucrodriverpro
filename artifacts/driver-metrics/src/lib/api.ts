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
 * from localStorage alongside session cookies. Use instead of raw fetch()
 * for every authenticated endpoint so both cookie and JWT auth paths work.
 */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("auth_token");
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { credentials: "include", ...init, headers });
}

// ─── Cached user object ────────────────────────────────────────────────────────
// Stored in localStorage so plan checks survive page reloads even if
// GET /api/auth/me is slow, cached by a browser/CDN, or temporarily unreachable.

const USER_STORAGE_KEY = "auth_user";

export function storeAuthUser(user: Record<string, unknown>): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors (private mode, storage full, etc.)
  }
}

export function loadAuthUser(): Record<string, unknown> | null {
  try {
    const s = localStorage.getItem(USER_STORAGE_KEY);
    return s ? (JSON.parse(s) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function clearAuthUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}
