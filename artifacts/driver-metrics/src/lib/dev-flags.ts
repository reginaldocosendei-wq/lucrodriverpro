// ─── DEV-ONLY BYPASS FLAGS ─────────────────────────────────────────────────────
// Set ALL flags to false before publishing to production.

// Real auth is ON — /api/auth/me fires on every app load.
// The debug panel shows the live session state after login.
export const DEV_DISABLE_AUTH_FETCH = false;
export const DEV_DISABLE_DASHBOARD_PRELOAD = false;

// Route-guard bypass — set to true to confirm session persistence on desktop.
//
// With this ON:
//   • HomeRoute always renders the dashboard (never the landing page)
//   • PrivateGuard never redirects to /login
//   • /api/auth/me still fires normally
//   → debug panel will show isAuthenticated: true once the session confirms
//
// This isolates session persistence from route-guard timing.
// If you log in and the panel flips to isAuthenticated: true, the session
// is working and the loop was purely a guard-timing issue (already fixed).
export const DEV_SKIP_ROUTE_GUARDS = true;
