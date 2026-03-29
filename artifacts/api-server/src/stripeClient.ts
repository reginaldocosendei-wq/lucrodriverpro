import Stripe from "stripe";

// ── Secret key resolution ─────────────────────────────────────────────────────
//
// Priority order:
//   1. STRIPE_SECRET_KEY  — direct env var (works anywhere, no connector needed)
//   2. Replit connector   — managed credentials via REPLIT_CONNECTORS_HOSTNAME
//
// Using STRIPE_SECRET_KEY is the simpler path and is always tried first.
// The Replit connector is a fallback for environments where the key is
// injected via the Stripe integration instead of a plain env var.

async function resolveSecretKey(): Promise<string> {
  // ── Path 1: direct env var ──────────────────────────────────────────────────
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey && envKey.startsWith("sk_")) {
    console.log("[stripe] using STRIPE_SECRET_KEY from environment");
    return envKey;
  }

  // ── Path 2: Replit connector ────────────────────────────────────────────────
  const hostname      = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken  = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "[stripe] No secret key found. " +
      "Set STRIPE_SECRET_KEY env var or configure the Stripe Replit integration.",
    );
  }

  const isProduction    = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnv       = isProduction ? "production" : "development";
  const url             = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets",  "true");
  url.searchParams.set("connector_names",  "stripe");
  url.searchParams.set("environment",      targetEnv);

  console.log(`[stripe] fetching ${targetEnv} credentials from Replit connector...`);

  const response = await fetch(url.toString(), {
    headers: {
      Accept:           "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data       = await response.json();
  const connection = data.items?.[0];

  if (!connection?.settings?.secret) {
    throw new Error(
      `[stripe] Replit connector returned no secret for environment "${targetEnv}". ` +
      "Set STRIPE_SECRET_KEY as an env var instead.",
    );
  }

  console.log(`[stripe] credentials resolved via Replit connector (${targetEnv})`);
  return connection.settings.secret as string;
}

async function resolvePublishableKey(): Promise<string> {
  const envKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envKey && envKey.startsWith("pk_")) {
    return envKey;
  }

  // Fall back to Replit connector (publishable key is optional server-side)
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

  const response   = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  const data       = await response.json();
  const connection = data.items?.[0];
  return (connection?.settings?.publishable as string) ?? "";
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
