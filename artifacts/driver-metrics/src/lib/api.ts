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
