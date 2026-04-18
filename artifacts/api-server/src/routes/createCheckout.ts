/**
 * POST /api/create-checkout
 *
 * Creates a Stripe Checkout session for the selected plan.
 *
 * Body params:
 *   plan        — "monthly" | "yearly"  (required)
 *   successUrl  — redirect after payment (optional, has sensible default)
 *   cancelUrl   — redirect on cancel    (optional, has sensible default)
 *
 * Price IDs are resolved PER-REQUEST from environment variables so that
 * changes to Replit Secrets take effect immediately without a redeploy.
 *
 *   plan=monthly → process.env.STRIPE_PRICE_ID
 *   plan=yearly  → process.env.STRIPE_PRICE_ID_YEARLY
 *
 * Secret key resolution (stripeClient.ts):
 *   1. STRIPE_SECRET_KEY env var  (set in Replit Secrets)
 *   2. Replit connector            (managed fallback)
 */

import { Router } from "express";
import { paymentService } from "../paymentService";

const router = Router();

// Production custom domain — used as fallback for success/cancel URLs.
const PROD_DOMAIN = "https://lucrodriverpro.com";

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    console.warn("[create-checkout] 401 — no session userId");
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  next();
}

// ── Resolve price ID per-request ───────────────────────────────────────────
// Read from env on every request — never from module-level constants.
// This ensures that updates to Replit Secrets are picked up immediately
// and avoids the "stale container had no env var" class of bug.
function resolvePriceId(plan: string): { priceId: string | null; source: string } {
  if (plan === "yearly") {
    const id = process.env.STRIPE_PRICE_ID_YEARLY ?? "";
    if (id.startsWith("price_") && id.length > 10) {
      return { priceId: id, source: "STRIPE_PRICE_ID_YEARLY" };
    }
    return { priceId: null, source: "STRIPE_PRICE_ID_YEARLY (MISSING or INVALID)" };
  }

  // monthly (default)
  const id = process.env.STRIPE_PRICE_ID ?? "";
  if (id.startsWith("price_") && id.length > 10) {
    return { priceId: id, source: "STRIPE_PRICE_ID" };
  }
  return { priceId: null, source: "STRIPE_PRICE_ID (MISSING or INVALID)" };
}

// ── POST /api/create-checkout ─────────────────────────────────────────────────
router.post("/", requireAuth, async (req: any, res) => {
  const userId = req.userId as number;

  const {
    plan       = "monthly",
    successUrl: clientSuccess,
    cancelUrl:  clientCancel,
  } = req.body ?? {};

  // ── Log: selected plan received by backend
  console.log(`[create-checkout] ▶ userId=${userId} plan="${plan}" received`);

  // ── Resolve price ID from environment (per-request, no cached constants)
  const { priceId, source } = resolvePriceId(plan);

  // ── Log: price ID chosen
  console.log(`[create-checkout] price resolved: priceId=${priceId ?? "null"} source=${source}`);

  if (!priceId) {
    console.error(`[create-checkout] ✗ price ID not configured for plan="${plan}" — set ${source} in Replit Secrets`);
    return res.status(500).json({
      error:  "Plano não configurado no servidor. Configure a variável de ambiente correta.",
      code:   "price_not_configured",
      detail: source,
    });
  }

  // Build success/cancel URLs:
  //  1. Frontend-provided (highest priority — includes SPA base path)
  //  2. Request host (works in dev + prod Replit environments)
  //  3. PROD_DOMAIN — last resort
  const origin     = req.headers.host ? `https://${req.headers.host}` : PROD_DOMAIN;
  const successUrl = clientSuccess || `${origin}/checkout/success`;
  const cancelUrl  = clientCancel  || `${origin}/checkout/cancel`;

  console.log(`[create-checkout]   successUrl=${successUrl}`);
  console.log(`[create-checkout]   cancelUrl=${cancelUrl}`);

  try {
    // ── Log: attempting session creation
    console.log(`[create-checkout] calling paymentService.createCheckoutSession — userId=${userId} priceId=${priceId}`);

    const { url } = await paymentService.createCheckoutSession(
      userId,
      priceId,
      successUrl,
      cancelUrl,
    );

    // ── Log: checkout session created successfully
    console.log(`[create-checkout] ✓ session created — userId=${userId} plan=${plan}`);

    res.json({ url });
  } catch (err: any) {
    console.error("[create-checkout] ✗ ERROR:", {
      userId,
      plan,
      priceId,
      message: err?.message,
      type:    err?.type,
      code:    err?.code,
      param:   err?.param,
      rawMsg:  err?.raw?.message,
    });

    const code =
      err?.type === "StripeAuthenticationError" ? "stripe_auth"    :
      err?.type === "StripeInvalidRequestError"  ? "stripe_invalid" :
      err?.code  === "resource_missing"          ? "stripe_invalid" :
      "stripe_error";

    res.status(500).json({ error: "Erro ao criar sessão de pagamento", code });
  }
});

export default router;
