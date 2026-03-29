/**
 * Stripe routes — thin HTTP layer.
 *
 * All payment business logic lives in PaymentService.
 * These handlers validate inputs, call the service, and format responses.
 */

import { Router } from "express";
import { storage } from "../storage";
import { stripeService } from "../stripeService";
import { paymentService } from "../paymentService";

const router = Router();

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  next();
}

// ── Build a products+prices map from DB rows ──────────────────────────────────
function buildProductsMapFromRows(rows: any[]) {
  const map = new Map<string, any>();
  for (const row of rows) {
    if (!map.has(row.product_id as string)) {
      map.set(row.product_id as string, {
        id:          row.product_id,
        name:        row.product_name,
        description: row.product_description,
        prices:      [],
      });
    }
    if (row.price_id) {
      map.get(row.product_id as string).prices.push({
        id:         row.price_id,
        unitAmount: row.unit_amount,
        currency:   row.currency,
        recurring:  row.recurring,
      });
    }
  }
  return map;
}

// ── GET /products-with-prices ─────────────────────────────────────────────────
// Public — used by the upgrade page to display available plans.
// Primary: stripe.* DB tables. Fallback: live Stripe API.
router.get("/products-with-prices", async (_req, res) => {
  try {
    let rows: any[] = [];
    try {
      rows = await storage.listProductsWithPrices();
    } catch (err: any) {
      console.warn("[products-with-prices] DB fallback:", err?.message);
    }

    if (rows.length > 0) {
      return res.json({ data: Array.from(buildProductsMapFromRows(rows).values()) });
    }

    // Fallback: live Stripe API (first deploy, before backfill runs)
    const prices = await stripeService.listPricesWithProducts();
    const map = new Map<string, any>();
    for (const price of prices) {
      const product = typeof price.product === "object" && price.product !== null
        ? (price.product as any) : null;
      if (!product || product.deleted || !product.active) continue;
      if (!map.has(product.id)) {
        map.set(product.id, { id: product.id, name: product.name, description: product.description ?? null, prices: [] });
      }
      if (price.active) {
        map.get(product.id).prices.push({
          id: price.id, unitAmount: price.unit_amount, currency: price.currency, recurring: price.recurring,
        });
      }
    }
    res.json({ data: Array.from(map.values()) });
  } catch (err: any) {
    console.error("[products-with-prices]", err?.message);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// ── POST /checkout ────────────────────────────────────────────────────────────
// Creates a Stripe Checkout session and returns the hosted payment URL.
router.post("/checkout", requireAuth, async (req: any, res) => {
  try {
    const { priceId, successUrl: clientSuccess, cancelUrl: clientCancel } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId é obrigatório" });

    // Prefer URLs from the frontend (they include the correct SPA base path).
    const baseUrl    = `https://${req.headers.host}`;
    const successUrl = clientSuccess || `${baseUrl}/checkout/success`;
    const cancelUrl  = clientCancel  || `${baseUrl}/checkout/cancel`;

    const { url } = await paymentService.createCheckoutSession(
      req.session.userId,
      priceId,
      successUrl,
      cancelUrl,
    );

    res.json({ url });
  } catch (err: any) {
    console.error("[checkout]", err?.message);
    const code =
      err?.type === "StripeAuthenticationError" ? "stripe_auth"    :
      err?.type === "StripeInvalidRequestError"  ? "stripe_invalid" :
      err?.code  === "resource_missing"          ? "stripe_invalid" :
      "stripe_error";
    res.status(500).json({ error: "Erro ao criar sessão de pagamento", code });
  }
});

// ── POST /sync-plan ───────────────────────────────────────────────────────────
// Reconciles the user's DB plan against their live Stripe subscription.
// Called by checkout-success.tsx after returning from Stripe.
router.post("/sync-plan", requireAuth, async (req: any, res) => {
  try {
    const result = await paymentService.syncSubscriptionStatus(req.session.userId);
    res.json(result);
  } catch (err: any) {
    console.error("[sync-plan]", err?.message);
    res.status(500).json({ error: "Erro ao sincronizar plano" });
  }
});

// ── POST /portal ──────────────────────────────────────────────────────────────
// Opens the Stripe Customer Portal for subscription management / cancellation.
router.post("/portal", requireAuth, async (req: any, res) => {
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: "Nenhuma assinatura encontrada" });
    }
    const baseUrl = `https://${req.headers.host}`;
    const session = await stripeService.createCustomerPortalSession(
      user.stripeCustomerId,
      `${baseUrl}/`,
    );
    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[portal]", err?.message);
    res.status(500).json({ error: "Erro ao abrir portal" });
  }
});

// ── GET /subscription ─────────────────────────────────────────────────────────
// Returns the current Stripe subscription info for the logged-in user.
router.get("/subscription", requireAuth, async (req: any, res) => {
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user?.stripeCustomerId) {
      return res.json({ subscription: null, plan: user?.plan ?? "free" });
    }
    const sub = await storage.getActiveSubscriptionForCustomer(user.stripeCustomerId);
    res.json({ subscription: sub, plan: user.plan });
  } catch (err: any) {
    console.error("[subscription]", err?.message);
    res.status(500).json({ error: "Erro ao buscar assinatura" });
  }
});

export default router;
