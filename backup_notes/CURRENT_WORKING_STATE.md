# Lucro Driver — Current Working State
**Snapshot date:** 2026-03-30  
**Git commit (HEAD):** f4d26aac741838e87e197d1694e90ad39135a984  
**Replit checkpoint label:** "Add user registration, login, and session management capabilities"

---

## 1. Restore Points

| Type | Identifier |
|---|---|
| Git commit | `f4d26aac741838e87e197d1694e90ad39135a984` |
| Previous checkpoint | `d1a53e56b34f02119a75a17ff33f4fcc58c3a79c` |
| Replit checkpoint UI | "Published your App" (most recent) |

To restore: use the Replit Checkpoints panel → select the checkpoint labeled above.

---

## 2. API Server — Entrypoint

**File:** `artifacts/api-server/src/index.ts`  
**Built output:** `artifacts/api-server/dist/index.mjs`

### What index.ts contains right now:
- `express` + `express-session` + `connect-pg-simple` + `bcryptjs`
- `app.set("trust proxy", 1)` — required for Replit's proxy in production
- `express.json()` middleware
- Session store: PostgreSQL via `connect-pg-simple` using `conString: process.env.DATABASE_URL`, `tableName: "session"`, `createTableIfMissing: false`
- Lazy DB pool: `@workspace/db` imported via dynamic `import()` on first request — never blocks startup
- **Routes:**
  - `GET /` → `200 OK` (health check)
  - `GET /api/test` → `{"status":"API working"}`
  - `POST /api/auth/register` — receives `{ name, email, password }`, hashes with bcrypt, inserts into `users`, sets session
  - `POST /api/auth/login` — receives `{ email, password }`, bcrypt compare, sets session
  - `GET /api/auth/me` — reads `req.session.userId`, returns user from DB
  - `POST /api/auth/logout` — calls `req.session.destroy()`
- `app.listen(port, "0.0.0.0", ...)` — always the FIRST binding statement
- `process.on("uncaughtException", ...)` and `process.on("unhandledRejection", ...)` — registered after listen

---

## 3. Run & Build Commands

### Development (workflow command):
```
pnpm --filter @workspace/api-server run dev
```
Which internally runs:
```
export NODE_ENV=development && pnpm run migrate && pnpm run build && pnpm run start
```

### Production build:
```
pnpm --filter @workspace/api-server run build
```
Uses `node ./build.mjs` → esbuild bundles to `dist/index.mjs`

### Production run command (Autoscale):
```
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

### Frontend build:
```
pnpm --filter @workspace/driver-metrics run build
```
Output: `artifacts/driver-metrics/dist/public/` (served as static)

---

## 4. Artifact / Deployment Config

### API Server — `artifacts/api-server/.replit-artifact/artifact.toml`
```toml
kind = "api"
previewPath = "/api"
title = "API Server"

[[services]]
localPort = 8080
name = "API Server"
paths = ["/api"]

[services.development]
run = "pnpm --filter @workspace/api-server run dev"

[services.production]
build = ["pnpm", "--filter", "@workspace/api-server", "run", "build"]
run = ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

[services.production.health.startup]
path = "/api/healthz"

[services.env]
PORT = "8080"
NODE_ENV = "production"
```

### Frontend — `artifacts/driver-metrics/.replit-artifact/artifact.toml`
```toml
kind = "web"
previewPath = "/"
title = "DriverMetrics"

[[services]]
name = "web"
paths = ["/"]
localPort = 19323

[services.development]
run = "pnpm --filter @workspace/driver-metrics run dev"

[services.production]
build = ["pnpm", "--filter", "@workspace/driver-metrics", "run", "build"]
publicDir = "artifacts/driver-metrics/dist/public"
serve = "static"

[[services.production.rewrites]]
from = "/*"
to = "/index.html"

[services.env]
PORT = "19323"
BASE_PATH = "/"
```

---

## 5. Auth / Session-Related Files

| File | Purpose |
|---|---|
| `artifacts/api-server/src/index.ts` | **Main** — contains all auth routes inline |
| `artifacts/api-server/src/app.ts` | Full Express app (routes, session, middleware) — NOT currently used by index.ts |
| `artifacts/api-server/src/routes/auth.ts` | Original auth routes (Drizzle ORM) — NOT currently wired |
| `lib/api-client-react/src/generated/api.ts` | Generated client — defines `/api/auth/register`, `/api/auth/login`, `/api/auth/me` paths |
| `lib/api-client-react/src/custom-fetch.ts` | Fetch wrapper — sends `credentials: "include"` for cookies |

### Session config (active):
- Store: PostgreSQL `session` table
- Cookie: `httpOnly: true`, `secure: true` in production, `sameSite: "none"` in production
- Max age: 30 days
- Secret: `process.env.SESSION_SECRET`

---

## 6. Payment-Related Files

| File | Purpose |
|---|---|
| `artifacts/api-server/src/routes/stripe.ts` | Stripe checkout + webhook handler |
| `artifacts/api-server/src/routes/pix.ts` | PIX / MercadoPago routes |
| `artifacts/driver-metrics/src/pages/upgrade.tsx` | Upgrade/subscription UI |
| `artifacts/driver-metrics/src/pages/pix-payment.tsx` | PIX payment UI |
| `artifacts/driver-metrics/src/pages/checkout-success.tsx` | Post-payment success page |

**Note:** Payment routes are in `app.ts` / `routes/` — they are NOT currently connected to `index.ts`. Index.ts is the active server entry point.

---

## 7. Database

- **Provider:** Replit built-in PostgreSQL
- **Connection:** `process.env.DATABASE_URL`
- **Tables confirmed in DB:** `users`, `rides`, `costs`, `daily_summaries`, `goals`, `pix_payments`, `extra_earnings`, `session`
- **Schema package:** `lib/db/src/schema.ts`
- **Migration:** `ensureSchema.ts` uses `CREATE TABLE IF NOT EXISTS` (safe on every boot)

### users table columns:
`id, name, email, password_hash, plan, created_at, stripe_customer_id, stripe_subscription_id, trial_start_date, save_mode_replace, activated_at`

---

## 8. Environment Variables

| Variable | Status | Used for |
|---|---|---|
| `DATABASE_URL` | ✅ set | PostgreSQL connection |
| `SESSION_SECRET` | ✅ set | Cookie signing |
| `STRIPE_SECRET_KEY` | ✅ set | Stripe payments |
| `STRIPE_PUBLISHABLE_KEY` | ⚠ missing | Frontend Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | ⚠ missing | Webhook signature verify |
| `MERCADOPAGO_ACCESS_TOKEN` | ⚠ missing | PIX payments |
| `MERCADOPAGO_WEBHOOK_SECRET` | ⚠ missing | PIX webhooks |
| `APP_BASE_URL` | ⚠ missing | PIX redirect URLs |
| `ADMIN_EMAIL` | ⚠ missing | Admin panel |

---

## 9. Known Issues (at time of snapshot)

1. **Payment routes not wired:** `app.ts` has Stripe/PIX routes but `index.ts` does not import `app.ts`. Payments will 404 in the current deployment.
2. **No `/api/healthz`:** The artifact.toml health check path is `/api/healthz` but the server only has `/` and `/api/test`. Production health check will fail on that path — the `GET /` fallback handles startup detection instead.
3. **In-memory session fallback:** Session is stored in PostgreSQL — if `DATABASE_URL` is unavailable on startup, the session store will fail to initialize.
4. **Missing env vars:** Several optional vars (Stripe webhook, PIX, admin) are not set — those features 404.
5. **`app.ts` unused:** The full app logic (rides, costs, goals, admin, etc.) is in `app.ts` but the active server (`index.ts`) does not import it.
