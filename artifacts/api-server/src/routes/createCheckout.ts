/**
 * POST /api/create-checkout
 *
 * Simple checkout endpoint with a fixed price ID and fixed redirect URLs.
 * Uses the same PaymentService as /api/stripe/checkout — no duplicate logic.
 *
 * Designed for the monthly R$19.90 plan.
 * The secret key is never exposed; it stays server-side via paymentService.
 */

import { Router } from "express";
import { paymentService } from "../paymentService";

const router = Router();

// ── Config ────────────────────────────────────────────────────────────────────
const PRICE_ID    = "price_1TFI4jHmFPfQQx";
const SUCCESS_URL = "https://lucrodriver.com/success";
const CANCEL_URL  = "https://lucrodriver.com/cancel";

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  next();
}

// ── POST /api/create-checkout ─────────────────────────────────────────────────
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const { url } = await paymentService.createCheckoutSession(
      req.session.userId,
      PRICE_ID,
      SUCCESS_URL,
      CANCEL_URL,
    );
    res.json({ url });
  } catch (err: any) {
    console.error("[create-checkout]", err?.message);

    const code =
      err?.type === "StripeAuthenticationError" ? "stripe_auth"    :
      err?.type === "StripeInvalidRequestError"  ? "stripe_invalid" :
      err?.code  === "resource_missing"          ? "stripe_invalid" :
      "stripe_error";

    res.status(500).json({ error: "Erro ao criar sessão de pagamento", code });
  }
});

export default router;
