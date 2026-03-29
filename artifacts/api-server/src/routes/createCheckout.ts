/**
 * POST /api/create-checkout
 *
 * Creates a Stripe Checkout session in subscription mode for the monthly plan.
 * Uses paymentService (which calls stripeClient) — the secret key is NEVER
 * sent to the browser.
 *
 * Secret key resolution order (see stripeClient.ts):
 *   1. STRIPE_SECRET_KEY env var  (direct — works anywhere)
 *   2. Replit Stripe connector    (managed credentials fallback)
 */

import { Router } from "express";
import { paymentService } from "../paymentService";

const router = Router();

// ── Config ────────────────────────────────────────────────────────────────────
const PRICE_ID    = "price_1TFI4jHmFPfQQx";
const SUCCESS_URL = "https://lucrodriver.com/success";
const CANCEL_URL  = "https://lucrodriver.com/cancel";

// Startup confirmation — printed once when the module is first imported
console.log("[create-checkout] route registered — POST /api/create-checkout");
console.log("[create-checkout] price:", PRICE_ID);
console.log("[create-checkout] success_url:", SUCCESS_URL);
console.log("[create-checkout] cancel_url:", CANCEL_URL);

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    console.warn("[create-checkout] rejected — no session (401)");
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  next();
}

// ── POST /api/create-checkout ─────────────────────────────────────────────────
router.post("/", requireAuth, async (req: any, res) => {
  const userId = req.session.userId;
  console.log(`[create-checkout] ▶ request — userId=${userId} priceId=${PRICE_ID}`);

  try {
    console.log("[create-checkout] calling paymentService.createCheckoutSession...");
    const { url } = await paymentService.createCheckoutSession(
      userId,
      PRICE_ID,
      SUCCESS_URL,
      CANCEL_URL,
    );
    console.log(`[create-checkout] ✓ session created — userId=${userId} url=${url}`);
    res.json({ url });
  } catch (err: any) {
    console.error("[create-checkout] ✗ ERROR:", {
      userId,
      priceId:  PRICE_ID,
      message:  err?.message,
      type:     err?.type,
      code:     err?.code,
      param:    err?.param,
      rawMsg:   err?.raw?.message,
      stack:    err?.stack?.split("\n").slice(0, 5).join(" | "),
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
