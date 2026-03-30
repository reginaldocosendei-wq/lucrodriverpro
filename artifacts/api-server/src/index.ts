import express from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";

const app = express();

// Required so req.secure works behind Replit's proxy in production
app.set("trust proxy", 1);

app.use(express.json());

// ─── Session ──────────────────────────────────────────────────────────────────
// connect-pg-simple manages its own pg connection via conString — no direct
// "pg" import needed. The "session" table already exists in the database.
const PgStore = ConnectPgSimple(session);

app.use(
  session({
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
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }),
);

// ─── Lazy DB pool ─────────────────────────────────────────────────────────────
// Dynamic import keeps @workspace/db out of the module-load critical path —
// server binds to PORT immediately even if DATABASE_URL is slow to appear.
let _pool: any = null;
async function getPool() {
  if (!_pool) {
    const { pool } = await import("@workspace/db");
    _pool = pool;
  }
  return _pool;
}

// ─── Health checks ────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/api/test", (_req, res) => {
  res.json({ status: "API working" });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  console.log("REGISTER ATTEMPT:", email);

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }

  try {
    const pool = await getPool();

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    if (existing.rows.length > 0) {
      console.log("REGISTER FAILED — email exists:", email);
      res.status(400).json({ error: "E-mail já cadastrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, plan)
       VALUES ($1, $2, $3, 'free')
       RETURNING id, name, email, plan, created_at`,
      [name, email, passwordHash],
    );

    const u = result.rows[0];
    (req.session as any).userId = u.id;

    console.log("REGISTER SUCCESS — userId:", u.id);
    res.status(201).json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan,
        createdAt: u.created_at,
      },
      message: "Conta criada com sucesso",
    });
  } catch (err: any) {
    console.error("REGISTER ERROR:", err.message, err.stack);
    res.status(500).json({ error: "Erro ao criar conta. Tente novamente." });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  console.log("LOGIN ATTEMPT:", email);

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const pool = await getPool();

    const result = await pool.query(
      `SELECT id, name, email, password_hash, plan, created_at
       FROM users WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      console.log("LOGIN FAILED — not found:", email);
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }

    const u = result.rows[0];
    const valid = await bcrypt.compare(password, u.password_hash);

    if (!valid) {
      console.log("LOGIN FAILED — wrong password:", email);
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }

    (req.session as any).userId = u.id;

    console.log("LOGIN SUCCESS — userId:", u.id);
    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan,
        createdAt: u.created_at,
      },
      message: "Login realizado com sucesso",
    });
  } catch (err: any) {
    console.error("LOGIN ERROR:", err.message, err.stack);
    res.status(500).json({ error: "Erro ao fazer login. Tente novamente." });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
app.get("/api/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  console.log("ME CHECK — userId:", userId ?? "none");

  if (!userId) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.query(
      `SELECT id, name, email, plan, created_at
       FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "not authenticated" });
      return;
    }

    const u = result.rows[0];
    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan,
        createdAt: u.created_at,
      },
      message: "OK",
    });
  } catch (err: any) {
    console.error("ME ERROR:", err.message);
    res.status(500).json({ error: "failed to get user" });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
app.post("/api/auth/logout", (req, res) => {
  const userId = (req.session as any)?.userId;
  console.log("LOGOUT — userId:", userId ?? "none");
  req.session.destroy(() => {
    res.json({ message: "Sessão encerrada" });
  });
});

// ─── Start server IMMEDIATELY ─────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT:", port);
});

// ─── Catch silent crashes ─────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED PROMISE:", err);
});
