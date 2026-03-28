// ─── DEV-ONLY BYPASS FLAGS ─────────────────────────────────────────────────────
// Set to false before publishing to production.
// DEV_DISABLE_AUTH_FETCH = true  → dashboard and all private routes render
//   immediately without an auth check. Use this to isolate whether the
//   login loop is caused by route-guard timing vs. session persistence.
//   Watch the debug panel: if isAuthenticated turns true after login,
//   session persistence is working and the issue was only guard timing.

export const DEV_DISABLE_AUTH_FETCH = true;
export const DEV_DISABLE_DASHBOARD_PRELOAD = true;
