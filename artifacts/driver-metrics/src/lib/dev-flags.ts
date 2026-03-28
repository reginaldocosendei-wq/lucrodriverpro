// ─── DEV-ONLY BYPASS FLAGS ─────────────────────────────────────────────────────
// Set all to FALSE (or delete this file) before shipping to production.
// Each flag is independent so you can isolate exactly which step causes a freeze.

// When true: skips the /api/auth/me network call on boot entirely.
// HomeRoute shows the landing page immediately; PrivateGuard redirects to /login.
// Use this to confirm whether the auth fetch is causing the startup freeze.
export const DEV_DISABLE_AUTH_FETCH = true;

// When true: prevents the dashboard summary and daily-summary queries from
// firing even when the Home component mounts (only relevant if DEV_DISABLE_AUTH_FETCH
// is false and a user session exists).
// Use this to confirm whether dashboard preloading is causing a freeze.
export const DEV_DISABLE_DASHBOARD_PRELOAD = true;
