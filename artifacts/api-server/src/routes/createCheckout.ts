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

// ── Price IDs ─────────────────────────────────────────────────────────────────
// Priority: env var → hardcoded test-mode fallback.
// Set STRIPE_PRICE_ID / STRIPE_PRICE_ID_YEARLY in Replit Secrets.
const MONTHLY_PRICE_ID =
  (process.env.STRIPE_PRICE_ID ?? "").startsWith("price_")
    ? process.env.STRIPE_PRICE_ID!
    : "price_1TEbgtDnebKxBIG0kxMNHyH5";

const YEARLY_PRICE_ID =
  (process.env.STRIPE_PRICE_ID_YEARLY ?? "").startsWith("price_")
    ? process.env.STRIPE_PRICE_ID_YEARLY!
    : null; // no hardcoded fallback for yearly — must be configured

// Production custom domain — used as last-resort fallback for success/cancel URLs.
const PROD_DOMAIN = "https://lucrodriverpro.com";

console.log("[create-checkout] route loaded — POST /api/create-checkout");
console.log("[create-checkout] monthly price:", MONTHLY_PRICE_ID, process.env.STRIPE_PRICE_ID ? "(env)" : "(hardcoded fallback)");
console.log("[create-checkout] yearly price: ", YEARLY_PRICE_ID ?? "NOT CONFIGURED — STRIPE_PRICE_ID_YEARLY missing");

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

  // `plan` selects monthly vs yearly. `priceId` is an explicit override (legacy).
  const {
    plan       = "monthly",
    priceId:   explicitPriceId,
    successUrl: clientSuccess,
    cancelUrl:  clientCancel,
  } = req.body ?? {};

  // Resolve price ID:
  //   1. Explicit priceId in body (legacy path — kept for compatibility)
  //   2. plan=yearly  → STRIPE_PRICE_ID_YEARLY env var
  //   3. plan=monthly → STRIPE_PRICE_ID env var (default)
  let priceId: string;
  if (explicitPriceId && typeof explicitPriceId === "string" && explicitPriceId.startsWith("price_")) {
    priceId = explicitPriceId;
  } else if (plan === "yearly") {
    if (!YEARLY_PRICE_ID) {
      console.error("[create-checkout] STRIPE_PRICE_ID_YEARLY not configured");
      return res.status(500).json({ error: "Plano anual não configurado", code: "yearly_not_configured" });
    }
    priceId = YEARLY_PRICE_ID;
  } else {
    priceId = MONTHLY_PRICE_ID;
  }

  // Build success/cancel URLs:
  //  1. Frontend-provided (highest priority — includes SPA base path)
  //  2. Request host (works in all Replit environments: dev + prod)
  //  3. PROD_DOMAIN (lucrodriverpro.com) — last resort
  const origin     = req.headers.host
    ? `https://${req.headers.host}`
    : PROD_DOMAIN;
  const successUrl = clientSuccess || `${origin}/checkout/success`;
  const cancelUrl  = clientCancel  || `${origin}/checkout/cancel`;

  console.log(`[create-checkout] ▶ userId=${userId} plan=${plan} priceId=${priceId}`);
  console.log(`[create-checkout]   successUrl=${successUrl}`);
  console.log(`[create-checkout]   cancelUrl=${cancelUrl}`);

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
