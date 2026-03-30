# Lucro Driver — Bug Audit Plan
**Audit date:** 2026-03-30  
**Current working commit:** f4d26aac741838e87e197d1694e90ad39135a984  
**Auditor:** Read-only inspection — NO code changed during this audit.

---

## How the App is Structured Right Now

```
artifacts/driver-metrics/  (React SPA — Vite + Wouter)
│   src/main.tsx           ← SPA entrypoint, sets Capacitor + service worker
│   src/App.tsx            ← Router, auth guard, QueryClient
│   src/pages/             ← All pages (home, rides, costs, upgrade, admin, ...)
│   src/lib/api-client-react  ← Auto-generated hooks calling /api/auth/*, etc.
│
artifacts/api-server/
│   src/index.ts           ← ACTIVE SERVER (minimal, standalone)
│   src/app.ts             ← FULL APP (sessions, all routes, Stripe webhook)
│                             ⚠ NOT imported by index.ts — completely disconnected
│   src/routes/            ← 20+ route files (auth, rides, costs, stripe, pix, ...)
│                             ⚠ NOT reachable — index.ts doesn't mount them
│   src/routes/index.ts    ← Master router wiring all routes
│   src/stripeClient.ts    ← Stripe key resolver (connector-first)
│   src/paymentService.ts  ← Stripe checkout / portal / sync logic
│   src/lib/planSync.ts    ← Trial + subscription plan computation
│   src/webhookHandlers.ts ← Stripe webhook event processing
```

---

## Critical Bugs 🔴

### BUG-C1 — ALL business routes return 404
**Severity:** CRITICAL  
**File:** `artifacts/api-server/src/index.ts`

**Problem:**  
`index.ts` is a minimal standalone server with no `import app from "./app"`.  
The full business logic lives in `app.ts` + `routes/` (20+ route files), all of which are completely unreachable.

Routes currently returning 404 in production:
- `GET /api/auth/me` → **actually works** (inline in index.ts) ✅  
- `POST /api/auth/register` → works ✅  
- `POST /api/auth/login` → works ✅  
- `GET /api/rides*` → **404** ❌  
- `GET /api/costs*` → **404** ❌  
- `GET /api/goals*` → **404** ❌  
- `GET /api/dashboard*` → **404** ❌  
- `GET /api/reports*` → **404** ❌  
- `GET /api/insights*` → **404** ❌  
- `GET /api/stripe/*` → **404** ❌  
- `GET /api/pix/*` → **404** ❌  
- `POST /api/create-checkout` → **404** ❌  
- `GET /api/admin/*` → **404** ❌  
- `GET /api/preferences*` → **404** ❌  
- `GET /api/extra-earnings*` → **404** ❌  
- `GET /api/healthz` → **404** ❌  

**Risk of fix:** Medium — must wire routes carefully and keep lazy imports to avoid startup blocking.  
**Safe fix strategy:**  
1. Dynamically import the master router inside a lazy function (same pattern as `getPool`)  
2. Mount it with `app.use("/api", ...)` inside a middleware that calls the lazy loader  
3. Or: convert index.ts to import app.ts but protect all imports with try/catch

---

### BUG-C2 — Stripe webhook completely disconnected
**Severity:** CRITICAL  
**File:** `artifacts/api-server/src/index.ts` (missing), `artifacts/api-server/src/app.ts` (has it, unreachable)

**Problem:**  
`app.ts` registers `POST /api/stripe/webhook` with `express.raw({ type: "application/json" })` BEFORE `express.json()`. This raw-body-before-json ordering is critical for Stripe signature verification.  
Since `app.ts` is not imported, Stripe webhook events (subscription created, payment succeeded, plan changes, cancellations) all hit 404 and are silently dropped.

**Impact:**  
- Plan upgrades via Stripe are NOT persisted → users pay but stay on "free"  
- Subscription renewals not recorded  
- Cancellations not processed  

**Risk of fix:** Medium — must add webhook route with raw body parser BEFORE express.json()  
**Safe fix strategy:**  
1. In index.ts, add the webhook route before `app.use(express.json())`  
2. Use `express.raw({ type: "application/json" })` as the body parser for that one route  
3. Import `WebhookHandlers` lazily (dynamic import)

---

### BUG-C3 — Session save race condition on login/register
**Severity:** CRITICAL (intermittent — harder to reproduce but real in production)  
**File:** `artifacts/api-server/src/index.ts` lines ~75, ~115

**Problem:**  
On register and login, `index.ts` does:
```typescript
(req.session as any).userId = u.id;
// ← no await session.save() here
res.status(201).json({ ... });
```

The browser immediately fires `GET /api/auth/me` after receiving the 200.  
If that request arrives at the server before the session row is written to PostgreSQL, the session middleware reads an empty session, and `/api/auth/me` returns 401 → login loop / user sees they are logged out immediately after login.

The correct implementation (in `routes/auth.ts`) explicitly calls:
```typescript
await saveSession(req); // wraps req.session.save() in a Promise
res.json({ ... });
```

**Risk of fix:** Low — add `await saveSession(req)` before each `res.json()` in register and login.  
**Safe fix strategy:** Copy the `saveSession` helper from `routes/auth.ts` into `index.ts`, call it after setting `userId`.

---

### BUG-C4 — `/api/healthz` returns 404
**Severity:** CRITICAL (deployment stability)  
**File:** `artifacts/api-server/.replit-artifact/artifact.toml` and `artifacts/api-server/src/index.ts`

**Problem:**  
The artifact.toml declares:
```toml
[services.production.health.startup]
path = "/api/healthz"
```
But `index.ts` only has `GET /` and `GET /api/test`. There is no `/api/healthz` handler.  
The Autoscale health probe will receive a 404 and may mark the deployment as unhealthy after the grace period expires, causing restarts.

**Risk of fix:** Very Low — just add one GET handler.  
**Safe fix strategy:**
```typescript
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
```

---

## Medium Bugs 🟡

### BUG-M1 — `/api/auth/me` returns wrong response shape (when app.ts is reconnected)
**Severity:** MEDIUM (latent — will surface when BUG-C1 is fixed)  
**File:** `artifacts/api-server/src/routes/auth.ts` line ~109

**Problem:**  
The frontend's generated API client (`useGetMe()`) expects `AuthResponse = { user: User, message: string }`.  
But `routes/auth.ts` GET /me does:
```typescript
res.json(userResponse(user)); // ← flat object, NOT wrapped in {user, message}
```
This will cause `data.user` to be undefined in the frontend after reconnecting routes.

The current `index.ts` returns the correct shape: `{ user: {...}, message: "OK" }`.

**Risk of fix:** Low (change one line in routes/auth.ts).  
**Safe fix strategy:** Wrap the response: `res.json({ user: userResponse(user), message: "OK" })`.

---

### BUG-M2 — User response missing trial/plan fields
**Severity:** MEDIUM  
**File:** `artifacts/api-server/src/index.ts` lines ~80, ~120, ~155

**Problem:**  
`index.ts` auth routes return:
```json
{ "user": { "id": 44, "name": "...", "email": "...", "plan": "free", "createdAt": "..." } }
```
The frontend pages (upgrade.tsx, etc.) may check for `user.trialActive`, `user.trialDaysLeft`, `user.planSource`, `user.trialExpired`, `user.trialEndDate` — all computed by `computeEffectivePlan()` in `routes/auth.ts`.

Without these fields, trial banners won't appear, plan gates won't compute correctly, and upgrade prompts may be wrong.

**Risk of fix:** Low (add planSync import and call computeEffectivePlan).  
**Safe fix strategy:** Add lazy import of `computeEffectivePlan` and include those fields in the auth responses in `index.ts`.

---

### BUG-M3 — Stripe plan sync not called on login/me
**Severity:** MEDIUM  
**File:** `artifacts/api-server/src/index.ts`

**Problem:**  
`routes/auth.ts` calls `await syncStripeStatusForUser(user)` on both login and `/me` to reconcile the user's Stripe subscription status from the live Stripe API. `index.ts` reads the user from DB without this sync.

A user who cancels or upgrades their Stripe subscription will see stale plan data until the server reconnects `routes/auth.ts`.

**Risk of fix:** Low (add dynamic import of planSync inside handlers).  
**Safe fix strategy:** Add lazy call to `syncStripeStatusForUser()` in login and /me handlers.

---

### BUG-M4 — Domain redirect not applied in production
**Severity:** MEDIUM  
**File:** `artifacts/api-server/src/index.ts` (missing middleware), `artifacts/api-server/src/app.ts` (has it, unreachable)

**Problem:**  
`app.ts` contains middleware to redirect `*.replit.app` → `lucrodriverpro.com` (301).  
`index.ts` does not have this. Users visiting the `.replit.app` domain in production land on the app with the replit URL instead of being redirected to the custom domain.

**Risk of fix:** Very Low — add the middleware block from app.ts.  
**Safe fix strategy:** Copy the domain redirect middleware block from app.ts into index.ts after the webhook route.

---

### BUG-M5 — Missing environment variables block payment features
**Severity:** MEDIUM (configuration, not code)  
**Variables:** `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `APP_BASE_URL`, `ADMIN_EMAIL`

**Problem:**  
All payment-related UI (upgrade page, PIX payment) and server-side features (webhook validation, PIX notifications) depend on these vars being set. They are currently missing in production.

**Impact:**  
- `STRIPE_WEBHOOK_SECRET` missing → webhook signature validation fails → webhooks rejected  
- `MERCADOPAGO_ACCESS_TOKEN` missing → PIX payment flow fails entirely  
- `STRIPE_PUBLISHABLE_KEY` missing → Stripe.js can't initialize on the frontend  

**Risk of fix:** Zero code change — set values in Replit Secrets panel.  
**Safe fix strategy:** Add each value in Replit → Secrets → Add secret.

---

### BUG-M6 — `POST /api/auth/logout` doesn't call session.destroy() callback
**Severity:** MEDIUM (minor session hygiene)  
**File:** `artifacts/api-server/src/index.ts` line ~165

**Problem:**  
```typescript
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Sessão encerrada" });
  });
});
```
This is correct. But `routes/auth.ts` has:
```typescript
req.session.destroy(() => {});  // ← discards callback, res.json called outside
res.json({ message: "Logout realizado com sucesso" });
```
In `routes/auth.ts`, the response is sent before the session is destroyed. When app.ts is reconnected, logout may leave stale sessions.

**Risk of fix:** Low.  
**Safe fix strategy:** Fix routes/auth.ts logout to respond inside the callback (matches current index.ts behavior).

---

## Cosmetic Bugs 🟢

### BUG-X1 — Pino HTTP logger not applied to index.ts
**Severity:** Cosmetic  
**File:** `artifacts/api-server/src/index.ts`

**Problem:**  
`app.ts` uses `pino-http` structured logging. `index.ts` uses only `console.log`. Production logs will be plain text instead of JSON. Structured logs are useful for debugging but don't break functionality.

---

### BUG-X2 — CORS headers not set in index.ts
**Severity:** Cosmetic (currently same-origin so not a problem)  
**File:** `artifacts/api-server/src/index.ts`

**Problem:**  
`app.ts` imports `cors` middleware. `index.ts` doesn't. Cross-origin requests (e.g. from Capacitor APK pointing at the production API) will be blocked. Not an issue for web-only users on the same domain, but will break the mobile APK flow.

---

### BUG-X3 — No SPA fallback route
**Severity:** Cosmetic (handled by artifact.toml static rewrite)  
**File:** `artifacts/driver-metrics/.replit-artifact/artifact.toml`

**Problem:**  
The artifact.toml has `from = "/*" → to = "/index.html"`, so Replit's static server handles the SPA fallback. This is correct and working. No bug — just noting it's not in Express.

---

### BUG-X4 — Import.tsx allows unauthenticated access (by design)
**Severity:** Cosmetic / intentional  
**File:** `artifacts/driver-metrics/src/App.tsx` (ImportRoute)

**Problem:**  
The `/import` route is semi-public (no PrivateGuard). This appears intentional (allows first-time users to import a day before signing up). If this is not intended, it would need a guard.

---

## Risk-Ordered Fix Plan

Fix in this exact order to minimize the risk of breaking what currently works:

| Priority | Bug | Risk | Estimated Impact |
|---|---|---|---|
| 1 | **BUG-C4** — Add `/api/healthz` route | Very Low | Prevents Autoscale instability |
| 2 | **BUG-C3** — Fix session save race condition | Low | Prevents login loops in production |
| 3 | **BUG-M5** — Set missing env vars in Secrets | Zero | Unblocks payment features immediately |
| 4 | **BUG-M4** — Add domain redirect middleware | Very Low | SEO + branding |
| 5 | **BUG-M1** — Fix /me response shape in routes/auth.ts | Low | Prereq for BUG-C1 fix |
| 6 | **BUG-X6** — Fix routes/auth.ts logout callback | Low | Prereq for BUG-C1 fix |
| 7 | **BUG-C2** — Add Stripe webhook route to index.ts | Medium | Prereq for BUG-C1 (must be before express.json) |
| 8 | **BUG-C1** — Connect business routes (mount routes/index.ts) | Medium | All data features |
| 9 | **BUG-M2** — Add trial/plan fields to auth responses | Low | After BUG-C1 — routes/auth.ts handles this |
| 10 | **BUG-M3** — Add Stripe plan sync to login/me | Low | After BUG-C1 — routes/auth.ts handles this |
| 11 | **BUG-X1** — Add pino logger | Very Low | Nice-to-have logging improvement |
| 12 | **BUG-X2** — Add CORS | Low | Required for Capacitor APK |

---

## What Is Currently WORKING ✅

These things work right now and must NOT be broken by fixes:

| Feature | Status | Route |
|---|---|---|
| Server starts + binds PORT | ✅ Working | — |
| Health check `GET /` | ✅ Working | index.ts |
| `POST /api/auth/register` | ✅ Working | index.ts |
| `POST /api/auth/login` | ✅ Working | index.ts |
| `GET /api/auth/me` | ✅ Working (right shape) | index.ts |
| `POST /api/auth/logout` | ✅ Working | index.ts |
| Session persistence (PostgreSQL) | ✅ Working | connect-pg-simple |
| Frontend renders | ✅ Working | static via artifact |
| Frontend auth form (register + login) | ✅ Working | calls correct /api/auth/* paths |
| `trust proxy` for production cookies | ✅ Working | index.ts |
| Lazy DB pool (no startup blocking) | ✅ Working | index.ts |
