import express from "express";
import bcrypt from "bcryptjs";

const app = express();

app.use(express.json());

// ─── Lazy DB pool ─────────────────────────────────────────────────────────────
// Dynamic import so @workspace/db (and its DATABASE_URL check) never runs
// at module load time — server binds to the port immediately regardless.
let _pool: import("pg").Pool | null = null;
async function getPool(): Promise<import("pg").Pool> {
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

// ─── POST /api/register ───────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  console.log("REGISTER ATTEMPT:", email);

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const pool = await getPool();

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ error: "email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, plan)
       VALUES ($1, $2, $3, 'free')
       RETURNING id, email`,
      [name ?? email, email, passwordHash],
    );

    const user = result.rows[0];
    console.log("REGISTER SUCCESS — userId:", user.id);
    res.status(201).json({ success: true, userId: user.id, email: user.email });
  } catch (err: any) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ error: "registration failed" });
  }
});

// ─── POST /api/login ──────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  console.log("LOGIN ATTEMPT:", email);

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const pool = await getPool();

    const result = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email],
    );

    if (result.rows.length === 0) {
      console.log("LOGIN FAILED — user not found:", email);
      res.status(401).json({ error: "invalid credentials" });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      console.log("LOGIN FAILED — wrong password:", email);
      res.status(401).json({ error: "invalid credentials" });
      return;
    }

    console.log("LOGIN SUCCESS — userId:", user.id);
    res.json({ success: true, userId: user.id, email: user.email });
  } catch (err: any) {
    console.error("LOGIN ERROR:", err.message);
    res.status(500).json({ error: "login failed" });
  }
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
