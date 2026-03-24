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

// List products with prices (public — used for the upgrade page)
router.get("/products-with-prices", async (_req, res) => {
  try {
    const rows = await storage.listProductsWithPrices();

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

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    console.error("products-with-prices error:", err);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// Create Stripe Checkout session
router.post("/checkout", requireAuth, async (req: any, res) => {
  try {
    const { priceId } = req.body;
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

    const baseUrl = `https://${req.headers.host}`;
    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/checkout/success`,
      `${baseUrl}/checkout/cancel`,
    );

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("checkout error:", err);
    res.status(500).json({ error: "Erro ao criar sessão de pagamento" });
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

export default router;
