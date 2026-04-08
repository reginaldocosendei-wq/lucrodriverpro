# Backup — before addictive upgrade
Created: 2026-04-08

## Current stable state
- Email/password auth working
- Google login code fully implemented (button visible, awaiting Google Cloud Console origin authorization)
- Stripe live (monthly + yearly checkout, webhook, pro activation)
- PIX disabled (MERCADOPAGO_ACCESS_TOKEN not set)
- Anti-translation protection added (translate="no" on <html>, layout root, Counter/SummaryRow/MetricTile)
- Admin panel (POST /api/admin/activate-pro, GET /api/admin/users, DELETE /api/admin/users/:id)
- DB columns: users table has google_id (nullable) column in production
- PWA configured

## Key files at backup time
- artifacts/api-server/src/routes/auth.ts — email/password + Google OAuth endpoint
- artifacts/api-server/src/paymentService.ts — Stripe webhook handler
- artifacts/api-server/src/storage.ts — getUserByEmail, updateUserStripeInfo
- artifacts/driver-metrics/src/pages/auth.tsx — login form + Google button
- artifacts/driver-metrics/src/main.tsx — GoogleOAuthProvider wrapper
- lib/db/src/schema/users.ts — users schema with googleId field
- artifacts/driver-metrics/index.html — translate="no" + notranslate meta

## To restore
Copy any file from this directory back to the project root:
  cp backup_before_addictive_upgrade/artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/auth.ts

Or restore everything (excluding node_modules):
  cp -a backup_before_addictive_upgrade/. .
