# PRO Access Fix Report
**Date:** 2026-03-30  
**Status:** Fixed and verified

---

## Root Cause

`artifacts/api-server/src/index.ts` was a minimal standalone server that contained only four inline auth routes (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`). It never imported the full application router (`routes/index.ts`), leaving **all 20+ business route files completely unreachable**.

Every API call required to activate or detect PRO access returned HTTP 404:

| Route | Called By | Was Returning |
|---|---|---|
| `POST /api/create-checkout` | Upgrade page | 404 |
| `POST /api/stripe/checkout` | Upgrade page (fallback) | 404 |
| `POST /api/stripe/sync-plan` | `checkout-success.tsx` | 404 |
| `POST /api/stripe/webhook` | Stripe (plan activation) | 404 |
| `POST /api/auth/trial/start` | Upgrade page | 404 |
| `GET /api/stripe/products-with-prices` | Upgrade page | 404 |
| `GET /api/rides`, `GET /api/costs`, etc. | All data pages | 404 |

**Additionally:** The inline `/api/auth/me` in `index.ts` returned `{ user: { plan }, message }` — a nested shape. The frontend reads `data.plan` directly, so `data.plan` was always `undefined`. This meant `isPro = user?.plan === "pro"` in `reports.tsx` was **always `false`** even if the user had `plan: "pro"` in the database.

### Two compounding bugs

1. **No business routes** → checkout, webhook, sync-plan all 404'd → Stripe payments never persisted plan to DB
2. **Wrong `/me` response shape** → even if DB had `plan: "pro"`, the frontend computed `isPro = false`

---

## Files Changed

### 1. `artifacts/api-server/src/index.ts` — Complete rewrite

**Before:** Minimal standalone server. Four inline auth routes. No business routes.  
**After:** Full server that mounts all routes lazily. Exact changes:

- Removed all inline auth route handlers (now handled by `routes/auth.ts`)
- Added `/api/healthz` health check (required by deployment config)
- Added `POST /api/stripe/webhook` with `express.raw()` **before** `express.json()` (Stripe HMAC signature validation requires the raw Buffer)
- Added domain redirect middleware (`*.replit.app` → `lucrodriverpro.com`)
- Added lazy router loader: `app.use("/api", ...)` dynamically imports `routes/index.ts` on the first request, so server still binds to PORT immediately at startup
- All 20+ route files are now reachable through the mounted router

### 2. `artifacts/api-server/src/routes/auth.ts` — Logout fix

**Before:**
```typescript
router.post("/logout", (req, res) => {
  req.session.destroy(() => {});  // callback ignored
  res.json({ message: "Logout realizado com sucesso" });  // response sent before destroy
});
```
**After:**
```typescript
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logout realizado com sucesso" });  // respond inside callback
  });
});
```

---

## How PRO Is Determined

PRO access is computed in `src/lib/planSync.ts → computeEffectivePlan()`:

```
Priority order:
  1. users.plan = "pro" AND users.trialStartDate IS NULL
     → Paid PRO (Stripe or PIX/admin manually)
     → planSource = "stripe" (if stripeSubscriptionId set) or "pix_admin"

  2. users.trialStartDate IS SET AND elapsed < 7 days
     → Trial PRO (free 7-day trial)
     → planSource = "trial"

  3. users.trialStartDate IS SET AND elapsed ≥ 7 days
     → Free (trial expired)

  4. Everything else → Free
```

Database fields involved:
- `users.plan` — `"free"` | `"pro"` (updated by Stripe webhook or admin)
- `users.trial_start_date` — timestamp when 7-day trial was activated (NULL if never started)
- `users.stripe_customer_id` — Stripe customer ID (set at first checkout attempt)
- `users.stripe_subscription_id` — set by webhook handler after successful payment

---

## How `/api/auth/me` Response Is Now Used

`routes/auth.ts` GET `/me` returns a **flat user object** (no wrapper):
```json
{
  "id": 45,
  "name": "Test User",
  "email": "test@example.com",
  "plan": "pro",
  "planSource": "trial",
  "trialActive": true,
  "trialExpired": false,
  "trialDaysLeft": 7,
  "trialEndDate": "2026-04-06T20:47:28.975Z",
  "createdAt": "..."
}
```

The frontend does `const { data: user } = useGetMe()` — `user.plan` now correctly equals `"pro"` or `"free"`. The reports page gate `isPro = user?.plan === "pro"` now works correctly.

---

## Full PRO Activation Flow (After Fix)

### Path A — Stripe payment
1. User visits `/upgrade` → calls `POST /api/create-checkout` → receives Stripe checkout URL ✅
2. User completes payment on Stripe → Stripe fires webhook to `POST /api/stripe/webhook` ✅
3. Webhook handler calls `syncPlanByStripeCustomer(customerId, "active")` → sets `users.plan = "pro"` ✅
4. Stripe redirects user to `/checkout/success` → page calls `POST /api/stripe/sync-plan` ✅
5. sync-plan reconciles DB against live Stripe subscription → confirms `plan = "pro"` ✅
6. `queryClient.invalidateQueries(["/api/auth/me"])` fires → fresh `/me` response ✅
7. `user.plan === "pro"` → `isPro = true` → reports page unlocked ✅

### Path B — 7-day free trial
1. User clicks "Iniciar teste grátis" → calls `POST /api/auth/trial/start` ✅
2. Server sets `users.trial_start_date = NOW()` ✅
3. Response includes `{ plan: "pro", planSource: "trial", trialActive: true, trialDaysLeft: 7 }` ✅
4. React Query cache is invalidated → `/me` returns `plan: "pro"` ✅
5. Reports page unlocked ✅

---

## How to Test

### Test 1 — Basic route availability
```bash
curl http://localhost:8080/api/healthz                 # → {"status":"ok"}
curl http://localhost:8080/api/stripe/products-with-prices  # → {"data":[...]}
```

### Test 2 — Full trial activation
```bash
# Register
curl -X POST .../api/auth/register -c cookies.txt -d '{"name":"X","email":"x@x.com","password":"pass"}'
# Activate trial
curl -X POST .../api/auth/trial/start -b cookies.txt
# → {"plan":"pro","planSource":"trial","trialActive":true,"trialDaysLeft":7,...}
# Verify /me
curl .../api/auth/me -b cookies.txt
# → {"plan":"pro","planSource":"trial","trialActive":true,...}
```

### Test 3 — Stripe checkout URL generation
```bash
curl -X POST .../api/create-checkout -b cookies.txt \
  -d '{"priceId":"price_1TEbgtDnebKxBIG0kxMNHyH5"}'
# → {"url":"https://checkout.stripe.com/..."}
```

---

## Verified Working After Fix

| Check | Result |
|---|---|
| `GET /api/healthz` | ✅ `{"status":"ok"}` |
| `POST /api/auth/register` | ✅ Returns user with all plan fields |
| `POST /api/auth/login` | ✅ Returns user with plan fields + syncs Stripe |
| `GET /api/auth/me` | ✅ Flat user with `plan`, `planSource`, `trialActive`, `trialDaysLeft` |
| `GET /api/rides` | ✅ 401 (auth required, not 404) |
| `POST /api/create-checkout` | ✅ Returns real Stripe URL |
| `POST /api/auth/trial/start` | ✅ Activates trial, returns `plan:"pro"` |
| `POST /api/stripe/sync-plan` | ✅ 200 (route reachable) |
| `POST /api/stripe/webhook` | ✅ Route registered with raw body before JSON |
| Domain redirect middleware | ✅ Active in production |
| Session save race condition | ✅ Fixed (routes/auth.ts uses `await saveSession()`) |
