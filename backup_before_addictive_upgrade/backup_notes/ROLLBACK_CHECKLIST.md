# Rollback Checklist — Lucro Driver Production
**Purpose:** Step-by-step guide to restore the app to a known working state  
**Last verified working commit:** `c3ec518`

---

## When to Use This Checklist

Run through this checklist any time:
- The server is returning 5xx errors on health checks
- Authentication is broken (users cannot log in)
- PRO users are downgraded incorrectly
- Stripe payments are failing
- A new deployment broke something that was previously working

---

## Step 1 — Confirm the Problem

Before rolling back, confirm the symptom:

```bash
# Is the health check responding?
curl https://lucrodriverpro.com/api/healthz
# Expected: {"status":"ok"}

# Is auth working?
curl -X POST https://lucrodriverpro.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<test-email>","password":"<test-password>"}'
# Expected: {"user":{...}, "message":"..."}

# Are business routes reachable?
curl https://lucrodriverpro.com/api/stripe/products-with-prices
# Expected: {"data":[...]} — NOT 404
```

---

## Step 2 — Check Server Logs

Use the Replit workflow console for `artifacts/api-server: API Server`.

**Look for:**
- `SERVER STARTED ON PORT: 8080` — if missing, server didn't bind
- `UNCAUGHT ERROR:` or `UNHANDLED PROMISE:` — runtime crash
- `[router] lazy load error:` — route module import failed
- Any stack trace starting with `SyntaxError` or `Error: Cannot find module`

---

## Step 3 — Rollback Options

### Option A — Replit Checkpoint (fastest, safest)
1. Open the Replit UI
2. Click the clock icon (Checkpoints) in the sidebar
3. Find the checkpoint at commit `c3ec518` (or most recent stable one)
4. Click "Restore"
5. Trigger a new deployment from the Replit deploy button

### Option B — Git Checkout (if you have shell access)
```bash
# Check current state
git log --oneline -5

# Restore to last known-good state (all files)
git checkout c3ec518 -- .

# Verify the critical files are back to known-good state
cat artifacts/api-server/src/index.ts | grep "SERVER STARTED\|healthz\|stripe/webhook"

# Redeploy (use Replit deploy button, or restart workflow)
```

### Option C — Restore specific file (if only one file is broken)
```bash
# Restore only the broken file
git checkout c3ec518 -- artifacts/api-server/src/routes/reports.ts

# Restart the API server workflow to pick up the change
```

---

## Step 4 — After Rollback, Verify These 7 Checkpoints

Run all 7 in order. All must pass before declaring rollback successful.

### ✅ Checkpoint 1 — Health check
```bash
curl https://lucrodriverpro.com/api/healthz
```
Expected: `{"status":"ok"}` with HTTP 200

### ✅ Checkpoint 2 — Root responds
```bash
curl https://lucrodriverpro.com/
```
Expected: `"OK"` with HTTP 200

### ✅ Checkpoint 3 — Login works
```bash
curl -X POST https://lucrodriverpro.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<real-user-email>","password":"<password>"}' \
  -c /tmp/cookies.txt
```
Expected: `{"user":{"plan":"...","planSource":"...","trialActive":...,...}}`  
Expected: User `plan` field is present and correct (not undefined, not null)

### ✅ Checkpoint 4 — /me responds with plan fields
```bash
curl https://lucrodriverpro.com/api/auth/me -b /tmp/cookies.txt
```
Expected: Flat user object with `plan`, `planSource`, `trialActive`, `trialDaysLeft` present

### ✅ Checkpoint 5 — Stripe products load
```bash
curl https://lucrodriverpro.com/api/stripe/products-with-prices
```
Expected: `{"data":[{"name":"Lucro Driver PRO",...}]}` — NOT 404

### ✅ Checkpoint 6 — Checkout endpoint is reachable (not 404)
```bash
curl -X POST https://lucrodriverpro.com/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `{"error":"Autenticação necessária"}` (401) — NOT 404  
(404 means the route is not mounted at all)

### ✅ Checkpoint 7 — Webhook endpoint is reachable
```bash
curl -X POST https://lucrodriverpro.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `{"error":"Missing stripe-signature header"}` (400) — NOT 404

---

## Step 5 — If Rollback Doesn't Resolve It

### Problem: Server starts but returns 500 on all routes
**Likely cause:** Database connection failure  
**Check:** Look for `connection refused` or `ECONNREFUSED` in server logs  
**Action:** Verify `DATABASE_URL` env var is set in Replit Secrets

### Problem: Session not persisting after login
**Likely cause:** `session` table was dropped (someone ran `db push`)  
**Check:** Run `SELECT * FROM session LIMIT 1;` on the database  
**Action:** Run `CREATE TABLE IF NOT EXISTS session (...)` or use the connect-pg-simple `createTableIfMissing: true` temporarily

### Problem: Stripe checkout returns 500
**Likely cause:** Stripe secret key not found  
**Check:** `STRIPE_SECRET_KEY` must be set, OR the Replit Stripe connector must be connected  
**Action:** Verify in Replit Secrets → add `STRIPE_SECRET_KEY`

### Problem: PRO users see the paywall again
**Likely cause:** `/api/auth/me` response shape changed  
**Check:** The response must be a FLAT object with `plan` at top level, NOT `{user:{plan}, message}`  
**Action:** Restore `artifacts/api-server/src/routes/auth.ts` to commit `c3ec518`

---

## Critical "Do Not Touch" Rules

| Rule | Why |
|---|---|
| Never run `pnpm --filter @workspace/db run push` in production | Drops the `session` table → logs out all users |
| Never change the `/api/auth/me` response from flat → nested | The frontend reads `data.plan` directly |
| Never add `express.json()` before the Stripe webhook route | Breaks webhook HMAC verification → all Stripe events rejected |
| Never add synchronous DB calls at module load time in `index.ts` | Prevents server from binding to PORT at startup |
| Never hardcode `PORT=3000` in server code | Production uses `PORT=8080` via env var |
