/**
 * Mercado Pago PIX routes
 *
 *  POST /api/pix/mp/create          — authenticated, creates payment + stores in DB
 *  GET  /api/pix/mp/status/:id      — authenticated, polls payment status
 *  POST /api/pix/mp/webhook         — public, handles Mercado Pago notifications
 */

import { Router } from "express";
import { db, usersTable, pixPaymentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { createPixPayment, getPaymentStatus, validateWebhookSignature } from "../mercadopagoService";
import { paymentService } from "../paymentService";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function getMpToken(): string | null {
  return process.env.MERCADOPAGO_ACCESS_TOKEN ?? null;
}

function getNotificationUrl(): string {
  // APP_BASE_URL must be an absolute URL (e.g. https://lucrodriverpro.com).
  // Fallback to the production domain so Mercado Pago always receives a valid
  // absolute URL even when the env var is not explicitly configured.
  const base = (process.env.APP_BASE_URL ?? "https://lucrodriverpro.com").replace(/\/$/, "");
  return `${base}/api/pix/mp/webhook`;
}

// ── POST /create ─────────────────────────────────────────────────────────────
router.post("/create", async (req, res) => {
  const userId = req.userId!;

  const accessToken = getMpToken();
  if (!accessToken) {
    res.status(503).json({ error: "PIX automático não configurado. Use o PIX manual." });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    // Idempotency: return an existing pending MP payment created in the last 25 min
    const cutoff = new Date(Date.now() - 25 * 60 * 1000);
    const existing = await db
      .select()
      .from(pixPaymentsTable)
      .where(
        and(
          eq(pixPaymentsTable.userId, userId),
          eq(pixPaymentsTable.status, "pending"),
          sql`${pixPaymentsTable.notes}::jsonb->>'provider' = 'mercadopago'`,
          sql`${pixPaymentsTable.requestedAt} > ${cutoff}`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const rec = existing[0];
      let meta: any = {};
      try { meta = JSON.parse(rec.notes ?? "{}"); } catch {}
      res.json({
        pixPaymentId: rec.id,
        qrCode: meta.pixCopyPaste ?? "",
        qrCodeBase64: meta.qrCodeBase64 ?? "",
        expiresAt: meta.expiresAt ?? null,
        reused: true,
      });
      return;
    }

    // Create new Mercado Pago PIX payment
    const idempotencyKey = `lucro-pix-${userId}-${Date.now()}`;
    const mp = await createPixPayment({
      accessToken,
      amount: 19.90,
      description: "Lucro Driver PRO Mensal",
      payerEmail: user.email,
      externalReference: `user:${userId}`,
      notificationUrl: getNotificationUrl(),
      idempotencyKey,
      expiryMinutes: 30,
    });

    // Persist in existing pix_payments table — metadata stored as JSON in notes
    const notes = JSON.stringify({
      provider: "mercadopago",
      providerPaymentId: mp.paymentId,
      pixCopyPaste: mp.qrCode,
      qrCodeBase64: mp.qrCodeBase64,
      expiresAt: mp.expiresAt,
      ticketUrl: mp.ticketUrl,
    });

    const [record] = await db
      .insert(pixPaymentsTable)
      .values({
        userId: user.id,
        email: user.email,
        name: user.name,
        amount: "19.90",
        status: "pending",
        notes,
      })
      .returning();

    console.log(`[MP PIX] Created payment ${mp.paymentId} for userId=${userId}, dbId=${record.id}`);

    res.status(201).json({
      pixPaymentId: record.id,
      qrCode: mp.qrCode,
      qrCodeBase64: mp.qrCodeBase64,
      expiresAt: mp.expiresAt,
      reused: false,
    });
  } catch (err: any) {
    // Log the full MP error (message includes status code + MP response body)
    console.error("[MP PIX] create failed —", err?.message ?? err);
    if (err?.cause) console.error("[MP PIX] cause:", err.cause);
    res.status(500).json({ error: "Não foi possível gerar o PIX. Tente o PIX manual." });
  }
});

// ── GET /status/:pixPaymentId ─────────────────────────────────────────────────
router.get("/status/:pixPaymentId", async (req, res) => {
  const userId = req.userId!;
  const pixPaymentId = parseInt(req.params.pixPaymentId);

  if (isNaN(pixPaymentId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const accessToken = getMpToken();
  if (!accessToken) {
    res.status(503).json({ error: "PIX automático não configurado" });
    return;
  }

  try {
    const [record] = await db
      .select()
      .from(pixPaymentsTable)
      .where(
        and(
          eq(pixPaymentsTable.id, pixPaymentId),
          eq(pixPaymentsTable.userId, userId),
        ),
      )
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "Pagamento não encontrado" });
      return;
    }

    // If already activated in DB, return confirmed immediately
    if (record.status === "confirmed") {
      res.json({ status: "approved", dbStatus: "confirmed" });
      return;
    }

    let meta: any = {};
    try { meta = JSON.parse(record.notes ?? "{}"); } catch {}

    if (!meta.providerPaymentId) {
      res.status(422).json({ error: "Dados do pagamento inválidos" });
      return;
    }

    const mpStatus = await getPaymentStatus(accessToken, meta.providerPaymentId);

    // If newly approved here, activate PRO and update DB
    if (mpStatus.status === "approved" && record.status === "pending") {
      console.log(`[MP PIX] Activating PRO via status poll — userId=${userId}, mpId=${meta.providerPaymentId}`);
      await db
        .update(pixPaymentsTable)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(pixPaymentsTable.id, record.id));
      await paymentService.activateProAccess(userId);
    }

    res.json({ status: mpStatus.status, statusDetail: mpStatus.statusDetail });
  } catch (err: any) {
    console.error("[MP PIX] status error:", err?.message ?? err);
    res.status(500).json({ error: "Erro ao verificar status do pagamento" });
  }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
// Called by Mercado Pago. No session auth — must be publicly reachable.
router.post("/webhook", async (req, res) => {
  // Respond 200 immediately to prevent MP retries — process asynchronously
  res.status(200).json({ ok: true });

  const accessToken = getMpToken();
  if (!accessToken) {
    console.warn("[MP Webhook] MERCADOPAGO_ACCESS_TOKEN not set — ignoring");
    return;
  }

  try {
    // MP sends either body.data.id or query ?data.id
    const bodyId = req.body?.data?.id ?? req.body?.id;
    const queryId = (req.query as any)?.["data.id"] ?? (req.query as any)?.id;
    const rawId = bodyId ?? queryId;

    if (!rawId) {
      console.warn("[MP Webhook] No payment ID found in request");
      return;
    }

    const providerPaymentId = String(rawId);

    // Signature validation — optional, skipped when MERCADOPAGO_WEBHOOK_SECRET is not set
    const sigValid = validateWebhookSignature({
      secret:     process.env.MERCADOPAGO_WEBHOOK_SECRET,
      xSignature: req.headers["x-signature"] as string | undefined,
      xRequestId: req.headers["x-request-id"] as string | undefined,
      paymentId:  providerPaymentId,
    });
    if (!sigValid) {
      console.warn(`[MP Webhook] Invalid signature for paymentId=${providerPaymentId}`);
      return;
    }
    console.log(`[MP Webhook] Received notification for paymentId=${providerPaymentId}`);

    // Fetch the real payment from Mercado Pago to verify status
    const mpStatus = await getPaymentStatus(accessToken, providerPaymentId);

    if (mpStatus.status !== "approved") {
      console.log(`[MP Webhook] Payment ${providerPaymentId} status=${mpStatus.status}, skipping`);
      return;
    }

    // Find the matching record in our DB
    const [record] = await db
      .select()
      .from(pixPaymentsTable)
      .where(sql`${pixPaymentsTable.notes}::jsonb->>'providerPaymentId' = ${providerPaymentId}`)
      .limit(1);

    if (!record) {
      console.warn(`[MP Webhook] No pix_payment found for providerPaymentId=${providerPaymentId}`);
      return;
    }

    // Idempotency: skip if already confirmed
    if (record.status === "confirmed") {
      console.log(`[MP Webhook] Payment ${providerPaymentId} already confirmed, skipping`);
      return;
    }

    if (!record.userId) {
      console.warn(`[MP Webhook] pix_payment id=${record.id} has no userId`);
      return;
    }

    // Activate PRO and mark payment as confirmed
    await db
      .update(pixPaymentsTable)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(pixPaymentsTable.id, record.id));

    await paymentService.activateProAccess(record.userId);

    console.log(`[MP Webhook] PRO activated for userId=${record.userId} via payment ${providerPaymentId}`);
  } catch (err: any) {
    console.error("[MP Webhook] processing error:", err?.message ?? err);
  }
});

export default router;
