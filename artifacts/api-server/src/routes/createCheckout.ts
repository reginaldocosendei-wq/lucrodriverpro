/**
 * POST /api/create-checkout
 *
 * Fast-path checkout for the monthly subscription plan.
 *
 * Accepts (all optional) from the request body:
 *   priceId     — Stripe price ID; defaults to MONTHLY_PRICE_BRL_ID
 *   successUrl  — redirect after payment; defaults to ${origin}/checkout/success
 *   cancelUrl   — redirect on cancel;    defaults to ${origin}/checkout/cancel
 *
 * Secret key resolution (stripeClient.ts):
 *   1. Replit connector  (preferred — managed, always fresh)
 *   2. STRIPE_SECRET_KEY env var  (fallback for standalone deploys)
 */

import { Router } from "express";
import { paymentService } from "../paymentService";

const router = Router();

// ── Known confirmed price IDs ─────────────────────────────────────────────────
// These come from the project Stripe account and are used as defaults.
// The frontend may override by sending { priceId } in the request body.
const MONTHLY_PRICE_BRL_ID = "price_1TEbgtDnebKxBIG0kxMNHyH5";
const MONTHLY_PRICE_USD_ID = "price_1TEbgtDnebKxBIG0kxMNHyH5"; // same fallback if USD ID unknown

// Production custom domain — used as success/cancel URL base in production.
const PROD_DOMAIN = "https://lucrodriver.com";

console.log("[create-checkout] route loaded — POST /api/create-checkout");
console.log("[create-checkout] default BRL price:", MONTHLY_PRICE_BRL_ID);

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    console.warn("[create-checkout] 401 — no session userId");
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  next();
}

// ── POST /api/create-checkout ─────────────────────────────────────────────────
router.post("/", requireAuth, async (req: any, res) => {
  const userId = req.session.userId as number;

  // Accept optional overrides from the frontend
  const {
    priceId    = MONTHLY_PRICE_BRL_ID,
    successUrl: clientSuccess,
    cancelUrl:  clientCancel,
  } = req.body ?? {};

  // Build success/cancel URLs:
  //  - Frontend-provided: highest priority (includes SPA base path)
  //  - Request host: works in all Replit environments (dev + prod)
  //  - Production domain: last resort for when host is unavailable
  const origin     = `https://${req.headers.host}`;
  const successUrl = clientSuccess || `${origin}/checkout/success`;
  const cancelUrl  = clientCancel  || `${origin}/checkout/cancel`;

  console.log(`[create-checkout] ▶ userId=${userId} priceId=${priceId}`);
  console.log(`[create-checkout]   successUrl=${successUrl}`);
  console.log(`[create-checkout]   cancelUrl=${cancelUrl}`);

  if (!priceId || typeof priceId !== "string" || !priceId.startsWith("price_")) {
    return res.status(400).json({ error: "priceId inválido", code: "invalid_price" });
  }

  try {
    console.log("[create-checkout] calling paymentService.createCheckoutSession...");
    const { url } = await paymentService.createCheckoutSession(
      userId,
      priceId,
      successUrl,
      cancelUrl,
    );
    console.log(`[create-checkout] ✓ session created — userId=${userId}`);
    res.json({ url });
  } catch (err: any) {
    console.error("[create-checkout] ✗ ERROR:", {
      userId,
      priceId,
      message: err?.message,
      type:    err?.type,
      code:    err?.code,
      param:   err?.param,
      rawMsg:  err?.raw?.message,
      stack:   err?.stack?.split("\n").slice(0, 5).join(" | "),
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
