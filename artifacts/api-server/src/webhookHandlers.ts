import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { syncPlanByStripeCustomer } from "./lib/planSync";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Received type: " + typeof payload + ". " +
        "This usually means express.json() parsed the body before reaching this handler. " +
        "FIX: Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    // 1. Let Replit's Stripe sync process the webhook (updates stripe.* tables)
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // 2. Apply our own plan sync based on the event
    await WebhookHandlers._syncPlanFromEvent(payload, signature);
  }

  private static async _syncPlanFromEvent(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return;

    try {
      const stripe = await getUncachableStripeClient();
      const event  = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      const obj    = event.data?.object as any;
      if (!obj) return;

      // Resolve customer ID whether it's a string or object
      const customerId: string | undefined =
        typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;

      switch (event.type) {
        // Subscription paid / checkout complete → PRO
        case "checkout.session.completed":
          if (obj.payment_status === "paid") {
            await syncPlanByStripeCustomer(customerId, "active");
          }
          break;

        case "invoice.payment_succeeded":
          await syncPlanByStripeCustomer(customerId, "active");
          break;

        // Subscription state changed — map Stripe status directly
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await syncPlanByStripeCustomer(customerId, obj.status ?? "canceled");
          break;
      }
    } catch (err: any) {
      // Non-fatal: /me already syncs on every request as a fallback
      console.error("[PlanSync] webhook event parse error:", err.message);
    }
  }
}
