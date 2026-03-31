# Production Baseline — Lucro Driver
**Captured:** 2026-03-30  
**Status:** LIVE — receiving paid traffic  
**Custom domain:** lucrodriverpro.com  
**Current HEAD commit:** `c3ec518` (Published your App)

---

## Restore Points

| Commit | Description | Use When |
|---|---|---|
| `c3ec518` | **Current production** — all routes + reports fix | Latest known-good baseline |
| `4a5b358` | Reports fix (byPlatform + byDayOfWeek from rides table) | If reports break |
| `46acc52` | PRO activation fix (business routes connected) | If auth/PRO breaks |
| `1ec0bf3` | Bug audit documentation | Reference only |
| `53e7fa2` | Pre-fix backup | Last resort |

**To restore to any commit:**
```bash
git checkout <commit-id> -- .
```
Or use the Replit checkpoint rollback UI.

---

## Deployment Architecture

```
Internet → lucrodriverpro.com (custom domain)
  ↓ (Replit reverse proxy, mTLS)
  ├── /api/*  → API Server  (Express, port 8080)
  └── /*      → SPA Static  (Vite build, port 19323)
```

### API Server (Express)
| Property | Value |
|---|---|
| Entry point | `artifacts/api-server/src/index.ts` → compiled to `dist/index.mjs` |
| Production run command | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| Dev run command | `pnpm --filter @workspace/api-server run dev` |
| Port | `8080` (via `PORT` env var) |
| Health check path | `GET /api/healthz` → `{"status":"ok"}` |
| Root health check | `GET /` → `"OK"` |
| Build command | `pnpm --filter @workspace/api-server run build` (runs `node ./build.mjs` via esbuild) |
| Bundle output | `artifacts/api-server/dist/index.mjs` (3.4 MB, includes all routes) |

### Frontend (SPA)
| Property | Value |
|---|---|
| Framework | React + Vite + Wouter |
| Build output | `artifacts/driver-metrics/dist/public` |
| Served as | Static files (no server-side rendering) |
| SPA fallback | `/*` → `/index.html` (in artifact.toml) |
| Dev run command | `pnpm --filter @workspace/driver-metrics run dev` |
| Port | `19323` |

---

## Environment Variables

### Currently SET in production
| Variable | Purpose | Status |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Set |
| `SESSION_SECRET` | express-session signing key | ✅ Set |
| `STRIPE_SECRET_KEY` | Stripe API secret (fallback to connector) | ✅ Set |
| `PGPORT` | PostgreSQL port | ✅ Set |

### MISSING — features affected
| Variable | Purpose | Impact if Missing |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook HMAC validation | Webhooks accepted but unvalidated |
| `STRIPE_PUBLISHABLE_KEY` | Frontend Stripe.js init | Stripe.js fallback only |
| `MERCADOPAGO_ACCESS_TOKEN` | PIX via MercadoPago | PIX flow completely broken |
| `MERCADOPAGO_WEBHOOK_SECRET` | PIX webhook validation | PIX webhooks unvalidated |
| `APP_BASE_URL` | Canonical app URL | URL construction uses request host (safe) |
| `ADMIN_EMAIL` | Admin notifications | No admin email alerts |

---

## Database

### PostgreSQL Tables (application-owned)
| Table | Purpose | Critical |
|---|---|---|
| `users` | Auth + plan + Stripe IDs | YES — source of truth for PRO |
| `session` | PostgreSQL session store (connect-pg-simple) | YES — auth sessions |
| `daily_summaries` | Manual daily ride summaries | YES — home + reports |
| `rides` | Individual ride records | YES — home + reports |
| `costs` | Driver expenses | YES — profit calculation |
| `extra_earnings` | Tips, bonuses, incentives | YES — reports |
| `goals` | Driver goals | Medium |
| `pix_payments` | PIX payment requests | Low (feature incomplete) |

### PostgreSQL Tables (Stripe-managed, read-only)
| Table | Purpose |
|---|---|
| `stripe.products` | Stripe product catalog |
| `stripe.prices` | Stripe price catalog |
| `stripe.subscriptions` | Live subscription status |
| `stripe.customers` | Stripe customer records |

**CRITICAL RULE:** Never run `pnpm --filter @workspace/db run push` in production — it drops the `session` table, logging out all users.

---

## PRO Access — Source of Truth

### Database fields (in `users` table)
| Field | Type | Meaning |
|---|---|---|
| `plan` | `"free" \| "pro"` | Current plan in DB |
| `trial_start_date` | `timestamp \| null` | When 7-day trial was started |
| `stripe_customer_id` | `text \| null` | Stripe customer ID |
| `stripe_subscription_id` | `text \| null` | Stripe subscription ID |

### Logic file
`artifacts/api-server/src/lib/planSync.ts` → `computeEffectivePlan(user)`

### Decision tree
```
1. plan="pro" AND trial_start_date IS NULL
   → Paid PRO (planSource: "stripe" or "pix_admin")
   
2. trial_start_date IS SET AND elapsed < 7 days
   → Trial PRO (planSource: "trial", trialActive: true)
   
3. trial_start_date IS SET AND elapsed ≥ 7 days
   → Free (trial expired)
   
4. Everything else → Free
```

### `/api/auth/me` response shape (flat object — NOT wrapped in {user,message})
```json
{
  "id": 45,
  "name": "Driver Name",
  "email": "driver@example.com",
  "plan": "pro",
  "planSource": "stripe",
  "trialActive": false,
  "trialExpired": false,
  "trialDaysLeft": 0,
  "trialEndDate": null,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```
**NOTE:** The frontend reads `data.plan` directly (not `data.user.plan`). Any change to this shape breaks the PRO gate everywhere.

---

## Payment Flow — Source of Truth

### Stripe card payment
```
Upgrade page
  → POST /api/create-checkout (paymentService.createCheckoutSession)
  → Stripe Checkout (hosted page)
  → POST /api/stripe/webhook (paymentService.handleStripeWebhook)
     → checkout.session.completed → activateProAccess(userId)
     → customer.subscription.updated → _applyStripeStatus
     → customer.subscription.deleted → _applyStripeStatus (→ free)
     → invoice.payment_succeeded → _applyStripeStatus (→ pro)
  → Redirect to /checkout/success
  → POST /api/stripe/sync-plan (belt-and-suspenders reconcile)
  → queryClient.invalidateQueries(["/api/auth/me"])
```

### Stripe key resolution priority
```
1. Replit connector (managed, auto-rotated)
2. STRIPE_SECRET_KEY env var (fallback)
```
File: `artifacts/api-server/src/stripeClient.ts`

### PRO activation function (single point of truth)
```typescript
// artifacts/api-server/src/paymentService.ts
paymentService.activateProAccess(userId, { stripeCustomerId, stripeSubscriptionId })
// → sets users.plan = "pro", users.trial_start_date = null
```

---

## Known Price IDs (confirmed live in Stripe)
| Plan | Price ID | Amount |
|---|---|---|
| Monthly BRL | `price_1TEbgtDnebKxBIG0kxMNHyH5` | R$19,90/mo |
| Yearly BRL | `price_1TEbgtDnebKxBIG0NeUOR64B` | R$149,90/yr |

---

## Domain Redirect
`*.replit.app` → `lucrodriverpro.com` (301 redirect, production only)  
File: `artifacts/api-server/src/index.ts` (middleware after Stripe webhook route)
