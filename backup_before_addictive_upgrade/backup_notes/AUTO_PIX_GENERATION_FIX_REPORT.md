# Auto PIX Generation Fix Report

**Date:** 2026-03-31  
**Scope:** Automatic PIX via Mercado Pago — generation failure diagnosis and fix  
**Risk level:** Minimal — 2 lines changed in 1 route file, no auth/session/Stripe touched

---

## Root Cause

There are **two compounding root causes**. Both must be resolved for automatic PIX to work.

### Root Cause 1 — Missing `MERCADOPAGO_ACCESS_TOKEN` (primary blocker)

`MERCADOPAGO_ACCESS_TOKEN` is not set in the production environment.

When this env var is absent, `GET /api/pix/mp/create` immediately returns HTTP **503** with:
```json
{"error": "PIX automático não configurado. Use o PIX manual."}
```

The frontend correctly handles 503 and shows the **"unconfigured"** state ("PIX automático em breve").  
**This is not a code bug — it is a missing environment variable.**

### Root Cause 2 — Invalid `notification_url` sent to Mercado Pago (secondary blocker)

`APP_BASE_URL` was also not set. The function `getNotificationUrl()` fell back to `""`, producing:

```
/api/pix/mp/webhook   ← relative path, not an absolute URL
```

Mercado Pago validates `notification_url` and rejects payment creation when the URL is not absolute (`https://…`).  
This would cause PIX creation to fail with HTTP **500** ("Algo deu errado") even after adding a valid token.

**This was a code bug.** It is now fixed (see Changes section).

---

### Why "Algo deu errado" was shown before the auth fix

Prior to the auth/session cookie fix, all authenticated API calls from the browser returned **401 Unauthorized** (because `SameSite=Lax` cookies were silently dropped by the Replit proxy iframe).

The frontend checks:
```typescript
if (res.status === 503) { setState("unconfigured"); return; }
if (!res.ok) { setState("failed"); ... }   // 401 hits here
```

401 ≠ 503 → "failed" state → "Algo deu errado" headline was displayed.  
**This is now resolved by the auth fix already deployed.**

---

## Files Changed

| File | Change |
|------|--------|
| `artifacts/api-server/src/routes/mercadopago.ts` | `getNotificationUrl()`: fallback from `""` → `"https://lucrodriverpro.com"` |
| `artifacts/api-server/src/routes/mercadopago.ts` | Improved catch-block logging in `POST /create` |

**No other files were changed.** Auth, session, Stripe, manual PIX fallback, DB schema — all untouched.

---

## Env Vars Required

| Variable | Status | Required for |
|----------|--------|--------------|
| `MERCADOPAGO_ACCESS_TOKEN` | **MISSING** ← must add | PIX payment creation — nothing works without this |
| `MERCADOPAGO_WEBHOOK_SECRET` | missing (optional) | Webhook signature validation — safe to omit; webhooks still process without it |
| `APP_BASE_URL` | missing (now optional) | Code now falls back to `https://lucrodriverpro.com` if not set |

### How to get `MERCADOPAGO_ACCESS_TOKEN`

1. Go to [mercadopago.com.br/developers](https://mercadopago.com.br/developers)
2. Log in with your Mercado Pago business account
3. Go to **Suas integrações → Credenciais**
4. Copy the **Access Token** (starts with `APP_USR-` for production or `TEST-` for sandbox)
5. Add it to Replit secrets as `MERCADOPAGO_ACCESS_TOKEN`
6. Republish the app

**Start with a TEST token** (sandbox mode) to validate the full PIX flow before switching to production.

---

## What the Code Does (Full Flow)

```
Browser (pix-auto.tsx)
  └─ POST /api/pix/mp/create  (credentials: include — requires session cookie)
       │
       ├─ MERCADOPAGO_ACCESS_TOKEN missing → 503 → frontend: "unconfigured"
       │                                     (shows "Use o PIX manual" button)
       │
       ├─ Token present → fetch user from DB
       │   └─ idempotency check: return existing pending payment if < 25 min old
       │
       └─ Call Mercado Pago REST API
             POST https://api.mercadopago.com/v1/payments
             body: { payment_method_id: "pix", transaction_amount: 19.90,
                     payer: { email }, notification_url: "https://lucrodriverpro.com/api/pix/mp/webhook",
                     date_of_expiration: <30min from now> }
             ├─ 4xx/5xx from MP → throw → 500 → frontend: "Algo deu errado"
             └─ 201 OK → { point_of_interaction.transaction_data.qr_code,
                            point_of_interaction.transaction_data.qr_code_base64 }
                  └─ insert into pix_payments (notes: JSON with provider, providerPaymentId, qrCode, ...)
                  └─ 201 → { pixPaymentId, qrCode, qrCodeBase64, expiresAt }
                        └─ frontend: "pending" state — shows QR code + copy button

Polling: every 5s → GET /api/pix/mp/status/:pixPaymentId
  └─ fetch payment from Mercado Pago API
  └─ status "approved" → activateProAccess(userId) → frontend: "approved" → redirect home

Webhook: POST /api/pix/mp/webhook (public, no auth)
  └─ parse paymentId from body or query
  └─ validate HMAC signature (if MERCADOPAGO_WEBHOOK_SECRET is set)
  └─ fetch payment status from MP
  └─ status "approved" → activateProAccess(userId)
```

---

## Manual PIX Fallback — Unchanged

`artifacts/api-server/src/routes/pix.ts` — **not touched**.  
`artifacts/driver-metrics/src/pages/pix-payment.tsx` — **not touched**.  
The manual PIX flow (`POST /api/pix/request` + admin confirmation) is fully intact.

---

## Test Steps to Validate Auto PIX Generation Safely

### Step 1 — Sandbox test (no real money)

1. Create a **test application** in Mercado Pago developer portal
2. Copy the **TEST Access Token** (`TEST-...`)
3. Add it as `MERCADOPAGO_ACCESS_TOKEN` in Replit secrets
4. Republish the app
5. Register a new account on `lucrodriverpro.com`
6. Go to Upgrade → PIX → should show QR code within 3–5 seconds
7. Check server logs: `[MP PIX] Created payment <id> for userId=...`

### Step 2 — Simulate payment (sandbox)

Use Mercado Pago's sandbox test cards/payer accounts to approve the payment:
- Go to developer portal → Ferramentas → Simular pagamentos
- Enter the MP payment ID from step 7 above
- Set status to "approved"
- The app should activate PRO automatically (via polling within 5 seconds)

### Step 3 — Verify notification URL is absolute

Check server logs after creation — the `[MP PIX] Created payment` line confirms the MP call succeeded. If you see `[MP PIX] create failed — Mercado Pago error 400:` with a message about `notification_url`, set `APP_BASE_URL=https://lucrodriverpro.com` in secrets.

### Step 4 — Production switch

After sandbox works end-to-end, replace `MERCADOPAGO_ACCESS_TOKEN` with the **production** (`APP_USR-...`) token and republish.

---

## Confirmation: Manual PIX Not Changed

The following files were **not modified** in this fix:

- `artifacts/api-server/src/routes/pix.ts` ✅
- `artifacts/driver-metrics/src/pages/pix-payment.tsx` ✅
- `artifacts/driver-metrics/src/pages/admin-pix.tsx` ✅
- `artifacts/api-server/src/routes/pixAdmin.ts` ✅
- All auth / session / Stripe files ✅
