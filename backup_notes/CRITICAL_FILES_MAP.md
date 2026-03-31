# Critical Files Map — Lucro Driver
**Purpose:** Map every file involved in deployment, auth, PRO access, payments, and reports  
**Status:** Accurate as of commit `c3ec518` (current production)

---

## Server Entry Point

| File | Role | Risk if broken |
|---|---|---|
| `artifacts/api-server/src/index.ts` | **Server entry point** — trust proxy, health checks, Stripe webhook (raw body), domain redirect, session, lazy route mounting | CRITICAL — entire API down |
| `artifacts/api-server/build.mjs` | esbuild config — bundles index.ts + workers into `dist/` | CRITICAL — no build = no deploy |
| `artifacts/api-server/.replit-artifact/artifact.toml` | Run/build/health-check config read by Replit platform | CRITICAL — wrong config = deploy failure |
| `artifacts/driver-metrics/.replit-artifact/artifact.toml` | SPA serving config (static, SPA fallback rewrites) | CRITICAL — frontend won't load |

---

## Authentication

| File | Role | What It Does |
|---|---|---|
| `artifacts/api-server/src/routes/auth.ts` | **Auth routes** | POST /auth/register, /auth/login, /auth/logout, GET /auth/me, POST /auth/trial/start |
| `artifacts/api-server/src/lib/planSync.ts` | **Plan computation** | computeEffectivePlan(), syncStripeStatusForUser(), syncPlanByStripeCustomer() |
| `artifacts/api-server/src/storage.ts` | **DB abstraction** | getUser(), updateUserStripeInfo() |
| `lib/db/src/schema/users.ts` | **Users table schema** | plan, trial_start_date, stripe_customer_id, stripe_subscription_id |

### Session Config (in index.ts)
```
Store:    connect-pg-simple → PostgreSQL "session" table
Secret:   SESSION_SECRET env var
Cookie:   httpOnly=true, secure=true (prod), sameSite="none" (prod), maxAge=30d
Trust:    trust proxy = 1 (required for req.secure behind Replit's proxy)
```

### /api/auth/me Response Contract
```json
{
  "id": number,
  "name": string,
  "email": string,
  "plan": "free" | "pro",
  "planSource": "stripe" | "pix_admin" | "trial" | "free",
  "trialActive": boolean,
  "trialExpired": boolean,
  "trialDaysLeft": number,
  "trialEndDate": string | null,
  "createdAt": string
}
```
⚠️ This is a FLAT object. The frontend reads `data.plan` not `data.user.plan`.  
DO NOT change this to a nested `{ user, message }` shape.

---

## PRO Access Gating

| File | Role | Key Check |
|---|---|---|
| `artifacts/driver-metrics/src/pages/reports.tsx` | Reports PRO gate | `const isPro = user?.plan === "pro"` — entire page locked if false |
| `artifacts/driver-metrics/src/App.tsx` | Route guards | `useBootAuth()` → `PrivateGuard` → redirects to /login if !data |
| `artifacts/driver-metrics/src/lib/dev-flags.ts` | Dev bypass flags | ALL must be `false` in production — has runtime assertion |
| `artifacts/driver-metrics/src/pages/upgrade.tsx` | Upgrade/paywall page | `const u = user as any; u?.trialActive, u?.plan` |
| `artifacts/api-server/src/lib/planSync.ts` | Backend plan logic | `computeEffectivePlan(user)` — the single truth function |
| `artifacts/api-server/src/routes/auth.ts` | /me handler | Calls `syncStripeStatusForUser()` then `computeEffectivePlan()` |

### PRO Gate in reports.tsx
```typescript
const { data: user } = useGetMe();
const { data: reports, isLoading } = useGetEarningsReport({
  query: { enabled: user?.plan === "pro" }  // ← query only fires for PRO users
});
const isPro = user?.plan === "pro";
if (!isPro) { return <Paywall />; }  // ← entire page replaced with upsell
```

---

## Stripe / Card Payment Flow

| File | Role | Risk |
|---|---|---|
| `artifacts/api-server/src/index.ts` | Webhook mount point | CRITICAL — must be before express.json() |
| `artifacts/api-server/src/webhookHandlers.ts` | Webhook dispatcher | Calls paymentService.handleStripeWebhook() |
| `artifacts/api-server/src/paymentService.ts` | **All payment logic** | CRITICAL — all plan activation goes through here |
| `artifacts/api-server/src/stripeService.ts` | Stripe API calls | createCheckoutSession, createCustomer, createCustomerPortalSession |
| `artifacts/api-server/src/stripeClient.ts` | Stripe key resolver | Connector-first, env-var fallback |
| `artifacts/api-server/src/routes/stripe.ts` | Stripe API routes | GET /stripe/products-with-prices, POST /stripe/checkout, POST /stripe/sync-plan, POST /stripe/portal, GET /stripe/subscription |
| `artifacts/api-server/src/routes/createCheckout.ts` | Fast checkout route | POST /create-checkout (primary upgrade path) |
| `artifacts/api-server/src/storage.ts` | DB writes | updateUserStripeInfo() — writes plan, stripeCustomerId, stripeSubscriptionId |

### Stripe Key Resolution (stripeClient.ts)
```
Priority 1: Replit connector (REPLIT_CONNECTORS_HOSTNAME + REPL_IDENTITY)
Priority 2: STRIPE_SECRET_KEY env var
Fallback:   throws Error (causes 500 on payment routes)
```

### Webhook Processing (paymentService.ts)
```
checkout.session.completed      → activateProAccess(userId)
customer.subscription.updated   → _applyStripeStatus (active/trialing → pro, else → free)
customer.subscription.deleted   → _applyStripeStatus → free
invoice.payment_succeeded       → _applyStripeStatus → pro
invoice.payment_failed          → warning only (Stripe will retry)
```

### Webhook Validation
```
STRIPE_WEBHOOK_SECRET env var → used for HMAC validation
Currently MISSING in production → webhook body is processed but NOT signature-validated
Risk: LOW now (malicious webhooks could trigger plan changes), should be set soon
```

---

## Reports Page Data Chain

| Step | File | What Happens |
|---|---|---|
| 1. Frontend query | `lib/api-client-react/src/generated/api.ts` → `useGetEarningsReport()` | Fetches `GET /api/reports/earnings` |
| 2. API route | `artifacts/api-server/src/routes/reports.ts` → `/earnings` | Merges daily_summaries + rides aggregated |
| 3. Data merge | Same file → `getMergedSummaries()` | Summaries take priority; rides fill gaps by (date, platform) |
| 4. Chart data | `byPlatform: [{platform, earnings, trips}]` | Used by horizontal BarChart |
| 5. Chart data | `byDayOfWeek: [{day, earnings, costs, profit, trips}]` | Used by vertical BarChart |
| 6. Frontend check | `hasPlatformData = byPlatform.length > 0` | Shows chart or EmptyChart |
| 7. Frontend check | `hasDayData = byDayOfWeek.some(d => d.earnings > 0)` | Shows chart or EmptyChart |

**KEY BUG FIXED:** reports.ts previously read ONLY `daily_summaries`. Now it also aggregates `rides` table grouped by `(date, platform)`.

---

## PIX Payment (INCOMPLETE — do not activate)

| File | Status | Risk |
|---|---|---|
| `artifacts/api-server/src/routes/pix.ts` | Mounted but limited | Only records `pix_payments` row, no actual payment |
| `artifacts/api-server/src/routes/pixAdmin.ts` | Mounted | Admin can mark PIX as paid → sets plan=pro manually |
| `artifacts/api-server/src/routes/mercadopago.ts` | Mounted but broken | Requires `MERCADOPAGO_ACCESS_TOKEN` (not set) |
| `artifacts/api-server/src/mercadopagoService.ts` | Not called | MercadoPago SDK wrapper |
| `artifacts/driver-metrics/src/pages/pix-payment.tsx` | Accessible at /pix-payment | Upload comprovante + record intent |
| `artifacts/driver-metrics/src/pages/admin-pix.tsx` | Accessible at /admin/pix | Admin approval UI |

**PIX is currently:** Request-only (no automatic activation). Admin manually approves via `/admin/pix` which sets `users.plan = "pro"`.  
**Do NOT implement MercadoPago automatic PIX until MERCADOPAGO_ACCESS_TOKEN is set.**

---

## All API Routes (mounted via lazy router)

```
/api/healthz                 ← Health check (index.ts, always available)
/api/stripe/webhook          ← Stripe webhook (index.ts, raw body before JSON)
/api/auth/register           ← routes/auth.ts
/api/auth/login              ← routes/auth.ts
/api/auth/logout             ← routes/auth.ts
/api/auth/me                 ← routes/auth.ts (flat user + plan fields)
/api/auth/trial/start        ← routes/auth.ts (7-day free trial)
/api/rides                   ← routes/rides.ts
/api/costs                   ← routes/costs.ts
/api/goals                   ← routes/goals.ts
/api/dashboard               ← routes/dashboard.ts
/api/reports/earnings        ← routes/reports.ts (PRO only)
/api/reports/debug           ← routes/reports.ts (debug endpoint)
/api/stripe/products-with-prices ← routes/stripe.ts
/api/stripe/checkout         ← routes/stripe.ts
/api/stripe/sync-plan        ← routes/stripe.ts
/api/stripe/portal           ← routes/stripe.ts
/api/stripe/subscription     ← routes/stripe.ts
/api/create-checkout         ← routes/createCheckout.ts (primary)
/api/pix/request             ← routes/pix.ts
/api/pix/mp                  ← routes/mercadopago.ts (broken without key)
/api/admin/pix               ← routes/pixAdmin.ts
/api/admin/users             ← routes/adminUsers.ts
/api/preferences             ← routes/preferences.ts
/api/extra-earnings          ← routes/extraEarnings.ts
/api/daily-summaries         ← routes/dailySummaries.ts
/api/insights                ← routes/insights.ts
/api/weekly-performance      ← routes/weeklyPerformance.ts
/api/import                  ← routes/import.ts
/api/dev/*                   ← routes/devAdmin.ts (blocked in production)
```

---

## Frontend Pages and Their Guards

| Route | File | Auth Required | PRO Required |
|---|---|---|---|
| `/` | pages/Home.tsx | No (shows landing if unauthed) | No |
| `/login` | pages/auth.tsx | No (redirects if authed) | No |
| `/rides` | pages/rides.tsx | YES | No |
| `/costs` | pages/costs.tsx | YES | No |
| `/goals` | pages/goals.tsx | YES | No |
| `/reports` | pages/reports.tsx | YES | YES (inline gate) |
| `/upgrade` | pages/upgrade.tsx | YES | No |
| `/checkout/success` | pages/checkout-success.tsx | YES | No |
| `/checkout/cancel` | pages/checkout-cancel.tsx | YES | No |
| `/pix-payment` | pages/pix-payment.tsx | YES | No |
| `/pix-auto` | pages/pix-auto.tsx | YES | No |
| `/admin/pix` | pages/admin-pix.tsx | YES | No (no admin check) |
| `/admin/users` | pages/admin-users.tsx | YES | No (no admin check) |
| `/settings` | pages/settings.tsx | YES | No |
| `/import` | pages/Import.tsx | Semi-public | No |

---

## Shared Libraries

| Package | Location | Used By |
|---|---|---|
| `@workspace/db` | `lib/db/` | api-server (all routes) |
| `@workspace/api-client-react` | `lib/api-client-react/` | driver-metrics (all API calls) |
| `@workspace/api-zod` | `lib/api-zod/` | Type definitions |

---

## Files Safe to Modify (low risk)

- `backup_notes/*.md` — documentation only
- `artifacts/driver-metrics/src/pages/upgrade.tsx` — UI only
- `artifacts/driver-metrics/src/pages/checkout-*.tsx` — UI only
- `artifacts/api-server/src/routes/reports.ts` — isolated, doesn't affect auth/payment
- `artifacts/api-server/src/routes/insights.ts` — isolated

## Files That Must NOT Be Modified Without a Restore Point

- `artifacts/api-server/src/index.ts` — server entry, session, webhook registration
- `artifacts/api-server/src/routes/auth.ts` — auth endpoints, /me response shape
- `artifacts/api-server/src/lib/planSync.ts` — PRO computation logic
- `artifacts/api-server/src/paymentService.ts` — all payment activation
- `artifacts/api-server/src/stripeClient.ts` — Stripe key resolution
- `lib/db/src/schema/*.ts` — database schema (never run db push without backup)
