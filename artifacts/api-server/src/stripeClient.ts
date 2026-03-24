import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

// Fetches fresh Stripe credentials from the Replit connector API.
// Falls back to STRIPE_SECRET_KEY env var when running outside the connector.
async function fetchStripeCredentials(): Promise<{
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
}> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const identity = process.env["REPL_IDENTITY"];
  const connectorConfigId = "ccfg_stripe_01K611P4YQR0SZM11XFRQJC44Y";

  if (hostname && identity) {
    try {
      const res = await fetch(
        `https://${hostname}/v1/connectorconfigs/${connectorConfigId}/credentials`,
        {
          headers: {
            "X-Replit-Identity": identity,
            "Content-Type": "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json() as {
          secretKey?: string;
          publishableKey?: string;
          webhookSecret?: string;
        };
        if (data.secretKey) return data;
      }
    } catch {
      // fall through to env var
    }
  }

  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new Error(
      "Stripe not configured. Connect the Stripe integration or set STRIPE_SECRET_KEY.",
    );
  }
  return { secretKey };
}

let stripeSyncInstance: StripeSync | null = null;

export async function getStripeSync(): Promise<StripeSync> {
  if (stripeSyncInstance) return stripeSyncInstance;
  const { secretKey, webhookSecret } = await fetchStripeCredentials();
  stripeSyncInstance = new StripeSync({ secretKey, webhookSecret });
  return stripeSyncInstance;
}

// Always returns a fresh client — do NOT cache the result.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await fetchStripeCredentials();
  return new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" });
}
