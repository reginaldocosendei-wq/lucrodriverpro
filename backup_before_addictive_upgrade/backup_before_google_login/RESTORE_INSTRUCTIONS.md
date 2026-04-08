# Backup: Stable Version Before Google Login

**Date/Time:** 2026-04-04 13:28 UTC
**Purpose:** Stable production-ready state before adding Google login.
**Commit at backup time:** 58e64ef0c5bf58acf312f70fc47aac3646c495b2

---

## What This Version Contains

- Working live Stripe checkout (monthly + yearly plans routed by env vars)
- Working live webhook (checkout.session.completed → upgrades user to PRO)
- Current PIX flow preserved (disabled until MERCADOPAGO_ACCESS_TOKEN is set)
- Current email/password auth preserved (bcrypt + express-session + PostgreSQL)
- Current production behavior preserved — no breaking changes

---

## Backed-Up Files

| Folder in backup | Source in repo |
|---|---|
| `api-server-src/` | `artifacts/api-server/src/` |
| `driver-metrics-src/` | `artifacts/driver-metrics/src/` |
| `lib-db-src/` | `lib/db/src/` |
| `api-server-package.json` | `artifacts/api-server/package.json` |
| `driver-metrics-package.json` | `artifacts/driver-metrics/package.json` |
| `lib-db-package.json` | `lib/db/package.json` |
| `pnpm-workspace.yaml` | `pnpm-workspace.yaml` |
| `root-package.json` | `package.json` |

---

## Restore Instructions

If anything breaks during or after Google login implementation, restore to this state:

### Option 1 — Git rollback (recommended)

Roll back to commit `58e64ef0c5bf58acf312f70fc47aac3646c495b2` using the Replit Checkpoints panel.
That checkpoint is labelled **"Published your App"** and was created on 2026-04-04.

### Option 2 — Manual file restore

Copy each backed-up folder back to its original location:

```bash
cp -r backup_before_google_login/api-server-src/*     artifacts/api-server/src/
cp -r backup_before_google_login/driver-metrics-src/*  artifacts/driver-metrics/src/
cp -r backup_before_google_login/lib-db-src/*          lib/db/src/
```

Then restart both workflows:
- `artifacts/api-server: API Server`
- `artifacts/driver-metrics: web`

### After restoring

1. Verify the API server starts cleanly (check startup logs for STRIPE_SECRET_KEY SET).
2. Verify the frontend loads at the production domain.
3. Test a yearly checkout to confirm Stripe is live.
4. Confirm `/api/auth/me` returns a valid user session.

---

## Environment Variables Required (Replit Secrets)

These must remain set for full functionality after a restore:

| Secret | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Live Stripe secret key (sk_live_...) |
| `STRIPE_PRICE_ID` | Monthly plan price ID (price_...) |
| `STRIPE_PRICE_ID_YEARLY` | Yearly plan price ID (price_...) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification (whsec_...) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing secret |
| `VITE_ADMIN_EMAIL` | Admin panel access email |
| `VITE_ADMIN_SECRET` | Admin panel access secret |

---

## Verification

- No production code was modified during this backup.
- Total files backed up: 161
- Backup created by: automated copy (no logic changes).
