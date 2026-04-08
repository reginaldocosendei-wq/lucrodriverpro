/**
 * PaymentService — single source of truth for all Stripe payment operations.
 *
 * Four clearly-named operations:
 *   1. createCheckoutSession  — start a Stripe-hosted payment flow for a user
 *   2. activateProAccess      — set plan=pro in DB after confirmed payment
 *   3. syncSubscriptionStatus — reconcile DB plan against live Stripe state
 *   4. handleStripeWebhook    — process an inbound Stripe webhook event
 *
 * Routes and webhook handlers are thin dispatchers that call these methods.
 * No payment logic lives outside this file.
 */

import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { syncStripeStatusForUser } from "./lib/planSync";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutResult {
  url: string;
}

export interface ProAccessOptions {
  stripeCustomerId?:    string;
  stripeSubscriptionId?: string;
}

export interface PlanSyncResult {
  plan: "free" | "pro";
}

// ─── PaymentService ───────────────────────────────────────────────────────────

export class PaymentService {

  // ── 1. createCheckoutSession ───────────────────────────────────────────────
  /**
   * Finds or creates a Stripe customer for the user, then creates a
   * Stripe Checkout session for the given price.
   *
   * @throws If the user does not exist or Stripe returns an error.
   */
  async createCheckoutSession(
    userId: number,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutResult> {
    const user = await storage.getUser(userId);
    if (!user) throw new Error("Usuário não encontrado");

    // Find or create Stripe customer — idempotent
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      successUrl,
      cancelUrl,
    );

    if (!session.url) throw new Error("Stripe não retornou URL de checkout");
    return { url: session.url };
  }

  // ── 2. activateProAccess ───────────────────────────────────────────────────
  /**
   * Upgrades a user to PRO in the database after a confirmed payment.
   * Clears trialStartDate so computeEffectivePlan reads this as a paid
   * subscription (not a trial).
   *
   * All plan activations — from webhooks, sync-plan, or simulate — go through
   * this one function.
   */
  async activateProAccess(userId: number, opts?: ProAccessOptions): Promise<void> {
    await storage.updateUserStripeInfo(userId, {
      plan: "pro",
      trialStartDate: null,
      ...(opts?.stripeCustomerId     ? { stripeCustomerId:     opts.stripeCustomerId }     : {}),
      ...(opts?.stripeSubscriptionId ? { stripeSubscriptionId: opts.stripeSubscriptionId } : {}),
    });
    console.log(`[PaymentService] activateProAccess — userId=${userId}`);
  }

  // ── 3. syncSubscriptionStatus ──────────────────────────────────────────────
  /**
   * Reconciles the user's plan against their current Stripe subscription.
   *
   * Three-layer fallback chain — stops at the first "pro" confirmation:
   *   Layer 1: stripe.subscriptions DB table (populated by webhook sync library)
   *   Layer 2: Live Stripe API — stripe.subscriptions.list for this customer
   *   Layer 3: Live Stripe API — stripe.checkout.sessions.retrieve(sessionId)
   *            (only when sessionId is provided by checkout-success page)
   *
   * This ensures PRO activates even when:
   *   - STRIPE_WEBHOOK_SECRET is missing (webhooks not validated)
   *   - Stripe tables not yet populated at the moment of the call
   *   - Webhook delivery was delayed or retried
   */
  async syncSubscriptionStatus(userId: number, sessionId?: string): Promise<PlanSyncResult> {
    const user = await storage.getUser(userId);
    if (!user) throw new Error("Usuário não encontrado");

    console.log(`[PaymentService] syncSubscriptionStatus — userId=${userId} sessionId=${sessionId ?? "none"} stripeCustomerId=${user.stripeCustomerId ?? "none"}`);

    // ── Layer 1: DB sync (fast path, uses stripe.subscriptions table) ─────────
    const synced = await syncStripeStatusForUser(user);
    if (synced.plan === "pro") {
      console.log(`[PaymentService] sync L1 DB → pro — userId=${userId}`);
      return { plan: "pro" };
    }

    // ── Layer 2: Live Stripe API — subscription list ───────────────────────────
    if (user.stripeCustomerId) {
      try {
        const stripe = await getUncachableStripeClient();
        const subs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status:   "active",
          limit:    1,
        });
        if (subs.data.length > 0) {
          const sub = subs.data[0];
          await this.activateProAccess(userId, {
            stripeCustomerId:     user.stripeCustomerId,
            stripeSubscriptionId: sub.id,
          });
          console.log(`[PaymentService] sync L2 live-sub → pro — userId=${userId} sub=${sub.id}`);
          return { plan: "pro" };
        }
        console.log(`[PaymentService] sync L2 live-sub → no active subscription — userId=${userId}`);
      } catch (err: any) {
        console.error("[PaymentService] sync L2 error:", err.message);
      }
    }

    // ── Layer 3: Live Stripe API — checkout session (only when sessionId given) ─
    if (sessionId) {
      try {
        const stripe = await getUncachableStripeClient();
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["subscription"],
        });
        console.log(`[PaymentService] sync L3 session=${sessionId} payment_status=${session.payment_status} status=${session.status}`);
        if (session.payment_status === "paid" || session.status === "complete") {
          const customerId     = typeof session.customer     === "string" ? session.customer     : session.customer?.id;
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id;
          await this.activateProAccess(userId, {
            ...(customerId     ? { stripeCustomerId:     customerId }     : {}),
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
          });
          console.log(`[PaymentService] sync L3 checkout session → pro — userId=${userId}`);
          return { plan: "pro" };
        }
      } catch (err: any) {
        console.error("[PaymentService] sync L3 error:", err.message);
      }
    }

    console.log(`[PaymentService] sync all layers → free — userId=${userId}`);
    return { plan: "free" };
  }

  // ── 4. handleStripeWebhook ─────────────────────────────────────────────────
  /**
   * Processes a raw Stripe webhook:
   *   a) Feeds the payload to the Replit Stripe sync library (keeps stripe.*
   *      tables up to date).
   *   b) Applies plan changes to the user record based on the event type.
   *
   * IMPORTANT: payload must be the raw Buffer before express.json() runs.
   * The webhook route in app.ts uses express.raw() for exactly this reason.
   */
  async handleStripeWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "[PaymentService] Webhook payload must be a raw Buffer. " +
        "Ensure the /webhook route is registered BEFORE express.json() middleware.",
      );
    }

    // a) Update stripe.* tables via the Replit sync library
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // b) Apply plan changes from the event
    await this._syncPlanFromEvent(payload, signature);
  }

  // ── Private: event dispatch ────────────────────────────────────────────────

  private async _syncPlanFromEvent(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return; // no secret configured — skip plan sync

    try {
      const stripe = await getUncachableStripeClient();
      const event  = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      const obj    = event.data?.object as any;
      if (!obj) return;

      const customerId: string | undefined =
        typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;

      const user = await storage.getUserByStripeCustomerId(customerId);
      if (!user) {
        console.warn(`[PaymentService] No user found for Stripe customer ${customerId}`);
        return;
      }

      switch (event.type) {
        // New subscription → activate PRO
        case "customer.subscription.created":
          await this._applyStripeStatus(user.id, obj.status ?? "active", {
            stripeCustomerId:    customerId,
            stripeSubscriptionId: obj.id,
          });
          break;

        // Checkout paid → activate PRO
        case "checkout.session.completed":
          if (obj.payment_status === "paid") {
            await this._applyStripeStatus(user.id, "active", {
              stripeCustomerId: customerId,
            });
          }
          break;

        // Renewal paid → keep PRO
        case "invoice.payment_succeeded":
          await this._applyStripeStatus(user.id, "active", {
            stripeCustomerId: customerId,
          });
          break;

        // Stripe will retry — do NOT downgrade yet.
        // Downgrade fires when the subscription eventually moves to canceled/past_due.
        case "invoice.payment_failed":
          console.warn(`[PaymentService] invoice.payment_failed for customer ${customerId} — Stripe will retry`);
          break;

        // Subscription state changed or cancelled
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await this._applyStripeStatus(user.id, obj.status ?? "canceled", {
            stripeCustomerId:    customerId,
            stripeSubscriptionId: obj.id,
          });
          break;
      }

      console.log(`[PaymentService] Webhook ${event.type} → userId=${user.id}`);
    } catch (err: any) {
      // Non-fatal: /me syncs on every request as a belt-and-suspenders fallback
      console.error("[PaymentService] webhook event error:", err.message);
    }
  }

  private async _applyStripeStatus(
    userId: number,
    stripeStatus: string,
    opts: { stripeCustomerId?: string; stripeSubscriptionId?: string },
  ): Promise<void> {
    const shouldBePro = ["active", "trialing"].includes(stripeStatus);
    await storage.updateUserStripeInfo(userId, {
      plan: shouldBePro ? "pro" : "free",
      ...(shouldBePro ? { trialStartDate: null } : {}),
      ...(opts.stripeCustomerId     ? { stripeCustomerId:     opts.stripeCustomerId }     : {}),
      ...(opts.stripeSubscriptionId ? { stripeSubscriptionId: opts.stripeSubscriptionId } : {}),
    });
  }
}

export const paymentService = new PaymentService();
