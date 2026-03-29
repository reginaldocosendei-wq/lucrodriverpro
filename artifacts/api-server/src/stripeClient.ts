import Stripe from "stripe";

// ── Secret key resolution ─────────────────────────────────────────────────────
//
// Priority order:
//   1. Replit connector   — managed credentials via REPLIT_CONNECTORS_HOSTNAME
//                          (installed when the Stripe Replit integration is active)
//   2. STRIPE_SECRET_KEY  — direct env var fallback
//
// The Replit connector is tried first because it is managed and rotated
// automatically. The env var is a secondary fallback for environments where
// the connector is not available (e.g. standalone deploys).

async function resolveViaConnector(): Promise<string | null> {
  const hostname      = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken  = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return null;

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnv    = isProduction ? "production" : "development";
  const url          = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment",     targetEnv);

  try {
    const response   = await fetch(url.toString(), {
      headers: {
        Accept:           "application/json",
        "X-Replit-Token": xReplitToken,
      },
    });
    const data       = await response.json();
    const connection = data.items?.[0];
    const secret     = connection?.settings?.secret as string | undefined;

    if (secret && secret.startsWith("sk_")) {
      console.log(`[stripe] key resolved via Replit connector (${targetEnv})`);
      return secret;
    }
  } catch (err: any) {
    console.warn("[stripe] connector fetch failed:", err?.message);
  }

  return null;
}

async function resolveSecretKey(): Promise<string> {
  // ── Path 1: Replit connector (preferred — managed, always fresh) ────────────
  const connectorKey = await resolveViaConnector();
  if (connectorKey) return connectorKey;

  // ── Path 2: direct env var fallback ────────────────────────────────────────
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey && envKey.startsWith("sk_")) {
    console.log("[stripe] key resolved via STRIPE_SECRET_KEY env var");
    return envKey;
  }

  throw new Error(
    "[stripe] No valid secret key found. " +
    "Ensure the Stripe Replit integration is connected, or set STRIPE_SECRET_KEY.",
  );
}

async function resolvePublishableKey(): Promise<string> {
  // Try env var first (publishable key is public — safe to store directly)
  const envKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envKey && envKey.startsWith("pk_")) return envKey;

  // Fall back to Replit connector
  const hostname     = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return "";

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnv    = isProduction ? "production" : "development";
  const url          = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment",     targetEnv);

  try {
    const response   = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    });
    const data       = await response.json();
    const connection = data.items?.[0];
    return (connection?.settings?.publishable as string) ?? "";
  } catch {
    return "";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

// WARNING: Never cache this client — the secret key may rotate.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = await resolveSecretKey();
  return new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" });
}

export async function getStripePublishableKey(): Promise<string> {
  return resolvePublishableKey();
}

export async function getStripeSecretKey(): Promise<string> {
  return resolveSecretKey();
}

// ── StripeSync singleton ──────────────────────────────────────────────────────
let stripeSyncInstance: any = null;

export async function getStripeSync() {
  if (!stripeSyncInstance) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await resolveSecretKey();
    stripeSyncInstance = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSyncInstance;
}
