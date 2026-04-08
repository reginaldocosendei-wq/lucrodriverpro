# Restore Instructions — Lucro Driver Working State

**Snapshot commit:** `f4d26aac741838e87e197d1694e90ad39135a984`  
**Date:** 2026-03-30

---

## Method 1 — Replit Checkpoints (EASIEST, recommended)

1. In the Replit editor, click **History** or **Checkpoints** in the left sidebar
2. Find the checkpoint labeled: **"Published your App"** (dated 2026-03-30)
   - or the one just before it: **"Add user registration, login, and session management capabilities"**
3. Click **Restore** on that checkpoint
4. Replit will restore all files to that exact state
5. Restart the workflow: `artifacts/api-server: API Server`
6. Verify: `curl https://YOUR-APP.replit.app/` → should return `OK`

---

## Method 2 — Git Commit (if you have git access)

The working state is at commit `f4d26aac741838e87e197d1694e90ad39135a984`.

```bash
# View the commit
git show f4d26aa --stat

# To restore all files to that commit state (DESTRUCTIVE — loses newer work):
# Use a background project task for this, not the main agent
```

**The commit hash is your single source of truth.** Even if branch names change, this hash points exactly to the working state.

---

## Method 3 — Restore individual critical files manually

If only some files are broken, restore these files from the backup:

### The most critical file: `artifacts/api-server/src/index.ts`

This file must contain exactly:

```typescript
import express from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

const PgStore = ConnectPgSimple(session);
app.use(session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: "session",
    createTableIfMissing: false,
  }),
  secret: process.env.SESSION_SECRET || "lucro-driver-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

let _pool: any = null;
async function getPool() {
  if (!_pool) {
    const { pool } = await import("@workspace/db");
    _pool = pool;
  }
  return _pool;
}

app.get("/", (_req, res) => res.status(200).send("OK"));
app.get("/api/test", (_req, res) => res.json({ status: "API working" }));

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  console.log("REGISTER ATTEMPT:", email);
  if (!name || !email || !password) { res.status(400).json({ error: "name, email and password are required" }); return; }
  try {
    const pool = await getPool();
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) { res.status(400).json({ error: "E-mail já cadastrado" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, plan) VALUES ($1, $2, $3, 'free') RETURNING id, name, email, plan, created_at",
      [name, email, passwordHash],
    );
    const u = result.rows[0];
    (req.session as any).userId = u.id;
    res.status(201).json({ user: { id: u.id, name: u.name, email: u.email, plan: u.plan, createdAt: u.created_at }, message: "Conta criada com sucesso" });
  } catch (err: any) { console.error("REGISTER ERROR:", err.message, err.stack); res.status(500).json({ error: "Erro ao criar conta. Tente novamente." }); }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  console.log("LOGIN ATTEMPT:", email);
  if (!email || !password) { res.status(400).json({ error: "email and password are required" }); return; }
  try {
    const pool = await getPool();
    const result = await pool.query("SELECT id, name, email, password_hash, plan, created_at FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) { res.status(401).json({ error: "Credenciais inválidas" }); return; }
    const u = result.rows[0];
    const valid = await bcrypt.compare(password, u.password_hash);
    if (!valid) { res.status(401).json({ error: "Credenciais inválidas" }); return; }
    (req.session as any).userId = u.id;
    res.json({ user: { id: u.id, name: u.name, email: u.email, plan: u.plan, createdAt: u.created_at }, message: "Login realizado com sucesso" });
  } catch (err: any) { console.error("LOGIN ERROR:", err.message, err.stack); res.status(500).json({ error: "Erro ao fazer login. Tente novamente." }); }
});

app.get("/api/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: "not authenticated" }); return; }
  try {
    const pool = await getPool();
    const result = await pool.query("SELECT id, name, email, plan, created_at FROM users WHERE id = $1", [userId]);
    if (result.rows.length === 0) { res.status(401).json({ error: "not authenticated" }); return; }
    const u = result.rows[0];
    res.json({ user: { id: u.id, name: u.name, email: u.email, plan: u.plan, createdAt: u.created_at }, message: "OK" });
  } catch (err: any) { console.error("ME ERROR:", err.message); res.status(500).json({ error: "failed to get user" }); }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => { res.json({ message: "Sessão encerrada" }); });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => { console.log("SERVER STARTED ON PORT:", port); });
process.on("uncaughtException", (err) => { console.error("UNCAUGHT ERROR:", err); });
process.on("unhandledRejection", (err) => { console.error("UNHANDLED PROMISE:", err); });
```

---

## After Any Restore — Verification Checklist

Run these curl commands to confirm everything is working:

```bash
# 1. Health check
curl https://YOUR-APP.replit.app/
# Expected: OK

# 2. API test
curl https://YOUR-APP.replit.app/api/test
# Expected: {"status":"API working"}

# 3. Register
curl -X POST https://YOUR-APP.replit.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"senha123"}'
# Expected: {"user":{...},"message":"Conta criada com sucesso"}

# 4. Login
curl -X POST https://YOUR-APP.replit.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"senha123"}'
# Expected: {"user":{...},"message":"Login realizado com sucesso"}
```

---

## Most Critical Files (in order of importance)

| Priority | File | Why |
|---|---|---|
| 🔴 1 | `artifacts/api-server/src/index.ts` | The entire active server — auth, sessions, health checks |
| 🔴 2 | `artifacts/api-server/.replit-artifact/artifact.toml` | Production build/run commands |
| 🔴 3 | `artifacts/api-server/build.mjs` | esbuild config — externals list |
| 🟡 4 | `artifacts/api-server/package.json` | Dependencies (bcryptjs, express-session, connect-pg-simple) |
| 🟡 5 | `artifacts/driver-metrics/src/lib/api.ts` | Frontend API base URL logic |
| 🟡 6 | `lib/api-client-react/src/generated/api.ts` | Route paths the frontend calls |
| 🟢 7 | `artifacts/api-server/src/app.ts` | Full app (not active but contains all business logic) |
| 🟢 8 | `lib/db/src/schema.ts` | Drizzle schema for all tables |

---

## Environment Variables Required

These must be set in Replit Secrets for the app to work:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **YES** | PostgreSQL — auth/sessions/all data |
| `SESSION_SECRET` | **YES** | Cookie signing — must be a long random string |
| `STRIPE_SECRET_KEY` | YES for payments | Stripe charges |

Set via: Replit sidebar → **Secrets** tab.
