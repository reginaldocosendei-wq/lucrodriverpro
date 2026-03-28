// ─── DEV-ONLY BYPASS FLAGS ─────────────────────────────────────────────────────
// Both flags are OFF — real auth is active.
// Set DEV_DISABLE_AUTH_FETCH = true only to test routing without a real session.
// NEVER deploy with either flag set to true.

export const DEV_DISABLE_AUTH_FETCH = false;
export const DEV_DISABLE_DASHBOARD_PRELOAD = false;
