// ─── DEV-ONLY BYPASS FLAGS ─────────────────────────────────────────────────────
// Set to true to disable auth-gating in the React shell (route guards, home
// page swap). API calls still use real session cookies — so if the user is
// actually logged in, data appears. Set both to false before publishing.

export const DEV_DISABLE_AUTH_FETCH = true;
export const DEV_DISABLE_DASHBOARD_PRELOAD = true;
