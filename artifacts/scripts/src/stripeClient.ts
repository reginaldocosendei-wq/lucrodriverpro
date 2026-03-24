import Stripe from "stripe";

async function fetchStripeCredentials(): Promise<{ secretKey: string }> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const identity = process.env["REPL_IDENTITY"];
  const connectorConfigId = "ccfg_stripe_01K611P4YQR0SZM11XFRQJC44Y";

  if (hostname && identity) {
    try {
      const res = await fetch(
        `https://${hostname}/v1/connectorconfigs/${connectorConfigId}/credentials`,
        { headers: { "X-Replit-Identity": identity } },
      );
      if (res.ok) {
        const data = await res.json() as { secretKey?: string };
        if (data.secretKey) return { secretKey: data.secretKey };
      }
    } catch {
      // fall through
    }
  }

  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) throw new Error("No Stripe credentials available.");
  return { secretKey };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await fetchStripeCredentials();
  return new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" });
}
