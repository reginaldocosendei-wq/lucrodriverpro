/**
 * Mercado Pago service — thin wrapper around the REST API using fetch().
 * No SDK dependency required.
 */

const MP_BASE = "https://api.mercadopago.com";

export interface MpPixResult {
  paymentId: string;
  status: string;
  qrCode: string;       // EMV copia e cola string
  qrCodeBase64: string; // PNG base64 for <img> display
  expiresAt: string | null;
  ticketUrl: string | null;
}

export interface MpPaymentStatus {
  paymentId: string;
  status: string;           // "pending" | "approved" | "cancelled" | "rejected" | ...
  statusDetail: string;
  externalReference: string | null;
}

// ── createPixPayment ─────────────────────────────────────────────────────────
export async function createPixPayment(opts: {
  accessToken: string;
  amount: number;
  description: string;
  payerEmail: string;
  externalReference: string;
  notificationUrl: string;
  idempotencyKey: string;
  expiryMinutes?: number;
}): Promise<MpPixResult> {
  const expiryMs = (opts.expiryMinutes ?? 30) * 60 * 1000;
  const expiresAt = new Date(Date.now() + expiryMs).toISOString();

  const body = {
    transaction_amount: opts.amount,
    description: opts.description,
    payment_method_id: "pix",
    payer: { email: opts.payerEmail },
    notification_url: opts.notificationUrl,
    external_reference: opts.externalReference,
    date_of_expiration: expiresAt,
  };

  const response = await fetch(`${MP_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "(no body)");
    console.error(`[MP] createPixPayment failed: ${response.status}`, errText);
    throw new Error(`Mercado Pago error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const txData = data?.point_of_interaction?.transaction_data ?? {};

  return {
    paymentId: String(data.id),
    status: data.status ?? "pending",
    qrCode: txData.qr_code ?? "",
    qrCodeBase64: txData.qr_code_base64 ?? "",
    expiresAt: data.date_of_expiration ?? null,
    ticketUrl: txData.ticket_url ?? null,
  };
}

// ── getPaymentStatus ──────────────────────────────────────────────────────────
export async function getPaymentStatus(
  accessToken: string,
  paymentId: string,
): Promise<MpPaymentStatus> {
  const response = await fetch(`${MP_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "(no body)");
    console.error(`[MP] getPaymentStatus failed: ${response.status}`, errText);
    throw new Error(`Mercado Pago status error ${response.status}`);
  }

  const data = await response.json();
  return {
    paymentId: String(data.id),
    status: data.status ?? "unknown",
    statusDetail: data.status_detail ?? "",
    externalReference: data.external_reference ?? null,
  };
}
