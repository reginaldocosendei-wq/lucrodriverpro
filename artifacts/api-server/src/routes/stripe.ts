import { Router } from "express";
import { storage } from "../storage";
import { stripeService } from "../stripeService";

const router = Router();

// Auth guard: all stripe routes require a session
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  next();
}

// Build a products+prices map from DB rows (same shape as the Stripe-API fallback)
function buildProductsMapFromRows(rows: any[]) {
  const productsMap = new Map<string, any>();
  for (const row of rows) {
    if (!productsMap.has(row.product_id as string)) {
      productsMap.set(row.product_id as string, {
        id: row.product_id,
        name: row.product_name,
        description: row.product_description,
        prices: [],
      });
    }
    if (row.price_id) {
      productsMap.get(row.product_id as string).prices.push({
        id: row.price_id,
        unitAmount: row.unit_amount,
        currency: row.currency,
        recurring: row.recurring,
      });
    }
  }
  return productsMap;
}

// List products with prices (public — used for the upgrade page).
// Primary source: stripe.* DB tables (populated by the sync backfill).
// Fallback: live Stripe API — handles the case where the DB tables haven't
// been populated yet (e.g. right after a fresh production deploy).
router.get("/products-with-prices", async (_req, res) => {
  try {
    // ── Primary: DB lookup ────────────────────────────────────────────────
    let rows: any[] = [];
    let dbError: string | null = null;
    try {
      rows = await storage.listProductsWithPrices();
    } catch (err: any) {
      // stripe schema may not exist yet in this environment
      dbError = err?.message ?? String(err);
      console.warn("products-with-prices DB error (will fallback to Stripe API):", dbError);
    }

    if (rows.length > 0) {
      return res.json({ data: Array.from(buildProductsMapFromRows(rows).values()) });
    }

    // ── Fallback: live Stripe API ─────────────────────────────────────────
    // Triggered when: DB query failed (schema absent) OR rows are empty
    // (schema exists but backfill hasn't run yet).
    const prices = await stripeService.listPricesWithProducts();
    const productsMap = new Map<string, any>();
    for (const price of prices) {
      const product = typeof price.product === "object" && price.product !== null
        ? (price.product as any)
        : null;
      if (!product || product.deleted || !product.active) continue;
      if (!productsMap.has(product.id)) {
        productsMap.set(product.id, {
          id: product.id,
          name: product.name,
          description: product.description ?? null,
          prices: [],
        });
      }
      if (price.active) {
        productsMap.get(product.id).prices.push({
          id: price.id,
          unitAmount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    console.error("products-with-prices error:", err);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// Create Stripe Checkout session
router.post("/checkout", requireAuth, async (req: any, res) => {
  try {
    const { priceId, successUrl: clientSuccessUrl, cancelUrl: clientCancelUrl } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId é obrigatório" });

    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    // Find or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    // Prefer URLs passed from the frontend (they include the correct base path).
    // Fall back to host-derived URLs if not provided.
    const baseUrl = `https://${req.headers.host}`;
    const successUrl = clientSuccessUrl || `${baseUrl}/checkout/success`;
    const cancelUrl  = clientCancelUrl  || `${baseUrl}/checkout/cancel`;

    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      successUrl,
      cancelUrl,
    );

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("checkout error:", err?.message ?? err);
    // Surface a machine-readable code so the frontend can react precisely.
    const code =
      err?.type === "StripeAuthenticationError" ? "stripe_auth" :
      err?.type === "StripeInvalidRequestError"  ? "stripe_invalid" :
      err?.code === "resource_missing"            ? "stripe_invalid" :
      "stripe_error";
    res.status(500).json({ error: "Erro ao criar sessão de pagamento", code });
  }
});

// Sync user plan from Stripe subscription status
// Called after checkout success or on demand
router.post("/sync-plan", requireAuth, async (req: any, res) => {
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    let newPlan = "free";
    let subscriptionId: string | undefined;

    if (user.stripeCustomerId) {
      const sub = await storage.getActiveSubscriptionForCustomer(user.stripeCustomerId);
      if (sub) {
        newPlan = "pro";
        subscriptionId = sub.id as string;
      }
    }

    const updated = await storage.updateUserStripeInfo(user.id, {
      plan: newPlan,
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      // Clear trialStartDate so computeEffectivePlan treats this as a paid PRO,
      // not a trial — critical for users who pay after their trial expires.
      ...(newPlan === "pro" ? { trialStartDate: null } : {}),
    });

    res.json({ plan: updated.plan });
  } catch (err: any) {
    console.error("sync-plan error:", err);
    res.status(500).json({ error: "Erro ao sincronizar plano" });
  }
});

// Customer portal (manage subscription / cancel)
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
    console.error("portal error:", err);
    res.status(500).json({ error: "Erro ao abrir portal" });
  }
});

// Get current subscription info
router.get("/subscription", requireAuth, async (req: any, res) => {
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user?.stripeCustomerId) {
      return res.json({ subscription: null, plan: user?.plan ?? "free" });
    }

    const sub = await storage.getActiveSubscriptionForCustomer(user.stripeCustomerId);
    res.json({ subscription: sub, plan: user.plan });
  } catch (err: any) {
    console.error("subscription error:", err);
    res.status(500).json({ error: "Erro ao buscar assinatura" });
  }
});

// Simulation endpoint — dev/staging only. Bypasses Stripe and sets plan=pro directly.
// BLOCKED in production unless ENABLE_SIMULATE_UPGRADE=true is explicitly set.
router.post("/simulate-upgrade", requireAuth, async (req: any, res) => {
  const isProd   = process.env.NODE_ENV === "production";
  const allowed  = !isProd || process.env.ENABLE_SIMULATE_UPGRADE === "true";
  if (!allowed) {
    return res.status(403).json({ error: "Não disponível em produção" });
  }

  try {
    const userId = req.session.userId as number;
    const user = await storage.updateUserStripeInfo(userId, {
      plan: "pro",
      trialStartDate: null,
    });
    console.log("[simulate-upgrade] userId=%d → plan=pro", userId);
    res.json({ ok: true, plan: user?.plan ?? "pro" });
  } catch (err: any) {
    console.error("[simulate-upgrade] error:", err);
    res.status(500).json({ error: "Erro ao ativar PRO" });
  }
});

export default router;
