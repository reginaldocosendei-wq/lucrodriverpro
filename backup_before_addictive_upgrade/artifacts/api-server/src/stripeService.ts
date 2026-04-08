import { storage } from "./storage";
import { getUncachableStripeClient } from "./stripeClient";

export class StripeService {
  async createCustomer(email: string, userId: number) {
    const stripe = await getUncachableStripeClient();
    return stripe.customers.create({
      email,
      metadata: { userId: String(userId) },
    });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const stripe = await getUncachableStripeClient();
    return stripe.checkout.sessions.create({
      customer: customerId,
      // Omit payment_method_types — Stripe Checkout auto-selects enabled
      // methods from the account's dashboard (card, PIX, boleto, etc.).
      // payment_method_types restricts too aggressively; automatic_payment_methods
      // is only valid for PaymentIntents, not CheckoutSessions.
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  // Direct Stripe API fetch — used as fallback when the stripe.* DB tables
  // haven't been populated yet (e.g. right after first production deploy).
  async listPricesWithProducts() {
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      limit: 100,
    });
    return prices.data;
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }
}

export const stripeService = new StripeService();
