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
  const userId = req.session.userId;
  console.log("[create-checkout] request received — userId:", userId, "priceId:", PRICE_ID);

  try {
    const { url } = await paymentService.createCheckoutSession(
      userId,
      PRICE_ID,
      SUCCESS_URL,
      CANCEL_URL,
    );
    console.log("[create-checkout] session created — userId:", userId, "url:", url);
    res.json({ url });
  } catch (err: any) {
    console.error("[create-checkout] ERROR —", {
      userId,
      priceId:  PRICE_ID,
      message:  err?.message,
      type:     err?.type,
      code:     err?.code,
      param:    err?.param,
      raw:      err?.raw?.message,
      stack:    err?.stack?.split("\n").slice(0, 4).join(" | "),
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
