// ─── DEV-ONLY BYPASS FLAGS ─────────────────────────────────────────────────────
// All flags must be false in production. A runtime assertion below enforces
// this automatically — the app will throw at startup if any flag is enabled
// in a production build.

export const DEV_DISABLE_AUTH_FETCH      = false;
export const DEV_DISABLE_DASHBOARD_PRELOAD = false;

// Route-guard bypass — DISABLED (real fix: SameSite=None + trust proxy).
export const DEV_SKIP_ROUTE_GUARDS = false;

// Stripe checkout bypass — when true, "Começar agora" skips Stripe and calls
// POST /api/dev/simulate-upgrade to instantly activate PRO.
// That endpoint is blocked with HTTP 404 in production by the /api/dev/ router.
export const DEV_SKIP_STRIPE_CHECKOUT = false;

// ── Production guard ────────────────────────────────────────────────────────
// Throws at module load time if any dev flag is enabled in a production build.
// This prevents accidental deployment of bypass flags.
if (import.meta.env.PROD) {
  const activeFlags = [
    DEV_DISABLE_AUTH_FETCH       && "DEV_DISABLE_AUTH_FETCH",
    DEV_DISABLE_DASHBOARD_PRELOAD && "DEV_DISABLE_DASHBOARD_PRELOAD",
    DEV_SKIP_ROUTE_GUARDS        && "DEV_SKIP_ROUTE_GUARDS",
    DEV_SKIP_STRIPE_CHECKOUT     && "DEV_SKIP_STRIPE_CHECKOUT",
  ].filter(Boolean);

  if (activeFlags.length > 0) {
    throw new Error(
      `[dev-flags] PRODUCTION BUILD has dev flags enabled: ${activeFlags.join(", ")}. ` +
      "Set all flags to false before deploying.",
    );
  }
}
