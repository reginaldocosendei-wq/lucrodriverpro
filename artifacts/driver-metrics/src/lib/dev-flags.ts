// ─── DEV-ONLY BYPASS FLAGS ─────────────────────────────────────────────────────
// Set ALL flags to false before publishing to production.

// Real auth is ON — /api/auth/me fires on every app load.
// The debug panel shows the live session state after login.
export const DEV_DISABLE_AUTH_FETCH = false;
export const DEV_DISABLE_DASHBOARD_PRELOAD = false;

// Route-guard bypass — DISABLED (real fix is in place: SameSite=None + trust proxy).
// Set to true temporarily to bypass redirects for debugging session persistence.
export const DEV_SKIP_ROUTE_GUARDS = false;

// Stripe checkout bypass — set true to skip Stripe and jump straight to the
// success page so you can test the post-payment plan-sync flow without a card.
// MUST be false in production.
export const DEV_SKIP_STRIPE_CHECKOUT = false;
