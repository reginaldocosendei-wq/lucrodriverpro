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

async function queryConnector(
  hostname: string,
  xReplitToken: string,
  targetEnv: string,
): Promise<string | null> {
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets",  "true");
  url.searchParams.set("connector_names",  "stripe");
  url.searchParams.set("environment",      targetEnv);

  try {
    const response   = await fetch(url.toString(), {
      headers: {
        Accept:           "application/json",
        "X-Replit-Token": xReplitToken,
      },
    });
    const data       = await response.json();
    const items      = data.items ?? [];
    console.log(`[stripe] connector (${targetEnv}): ${items.length} item(s) returned`);
    const connection = items[0];
    if (connection) {
      const settingKeys = Object.keys(connection.settings ?? {});
      console.log(`[stripe] connector (${targetEnv}): settings keys =`, settingKeys);
    }
    const secret     = connection?.settings?.secret as string | undefined;
    if (secret && secret.startsWith("sk_") && secret.length > 20) {
      console.log(`[stripe] key resolved via Replit connector (${targetEnv}), len=${secret.length}`);
      return secret;
    }
    if (secret) {
      console.warn(`[stripe] connector (${targetEnv}) returned a secret but it looks invalid (len=${secret.length})`);
    }
  } catch (err: any) {
    console.warn(`[stripe] connector fetch failed (${targetEnv}):`, err?.message);
  }
  return null;
}

async function resolveViaConnector(): Promise<string | null> {
  const hostname      = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken  = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    console.log("[stripe] connector unavailable — missing:",
      !hostname ? "REPLIT_CONNECTORS_HOSTNAME " : "",
      !xReplitToken ? "(no REPL_IDENTITY or WEB_REPL_RENEWAL)" : "");
    return null;
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";

  // In production: try the "production" connector first, then fall back to
  // "development". This handles the common case where only a development
  // Stripe connection has been configured in the Replit integration panel.
  const envOrder = isProduction ? ["production", "development"] : ["development"];

  for (const env of envOrder) {
    const key = await queryConnector(hostname, xReplitToken, env);
    if (key) return key;
  }

  return null;
}

async function resolveSecretKey(): Promise<string> {
  // ── Path 1: Replit connector (preferred — managed, always fresh) ────────────
  const connectorKey = await resolveViaConnector();
  if (connectorKey) return connectorKey;

  // ── Path 2: direct env var fallback ────────────────────────────────────────
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey && envKey.startsWith("sk_") && envKey.length > 20) {
    console.log(`[stripe] key resolved via STRIPE_SECRET_KEY env var (len=${envKey.length})`);
    return envKey;
  }

  if (envKey) {
    console.warn(`[stripe] STRIPE_SECRET_KEY is set but looks like a placeholder (len=${envKey.length}) — ignoring`);
  }

  throw new Error(
    "[stripe] No valid secret key found. " +
    "Ensure the Stripe Replit integration is connected, or set STRIPE_SECRET_KEY " +
    "to your actual secret key (sk_test_... or sk_live_...).",
  );
}

async function resolvePublishableKey(): Promise<string> {
  // Try env var first (publishable key is public — safe to store directly)
  const envKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envKey && envKey.startsWith("pk_") && envKey.length > 20) return envKey;

  const hostname     = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return "";

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const envOrder     = isProduction ? ["production", "development"] : ["development"];

  for (const targetEnv of envOrder) {
    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set("include_secrets", "true");
    url.searchParams.set("connector_names", "stripe");
    url.searchParams.set("environment",     targetEnv);
    try {
      const response   = await fetch(url.toString(), {
        headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
      });
      const data       = await response.json();
      const connection = data.items?.[0];
      const pub        = connection?.settings?.publishable as string | undefined;
      if (pub && pub.startsWith("pk_") && pub.length > 20) return pub;
    } catch {
      // continue to next env
    }
  }

  return "";
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
