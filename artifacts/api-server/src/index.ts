import app from "./app";
import { pool } from "@workspace/db";
import { ensureSchema } from "./lib/ensureSchema";

// Fail fast if the database URL is missing — nothing can work without it.
if (!process.env.DATABASE_URL) {
  console.error("[startup] FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

async function start() {
  // 1. Ensure all tables exist (safe — CREATE TABLE IF NOT EXISTS)
  try {
    await ensureSchema();
  } catch (err: any) {
    console.error("[startup] schema migration failed:", err.message);
    process.exit(1);
  }

  // 2. Run stripe-replit-sync migrations (non-fatal — Stripe may be unavailable in some envs)
  try {
    const { runMigrations } = await import("stripe-replit-sync");
    await runMigrations({ databaseUrl: process.env.DATABASE_URL! });
    console.log("[startup] Stripe sync migrations ok");
  } catch (err: any) {
    console.warn("[startup] Stripe sync migrations skipped:", err.message);
  }

  // 3. Start the HTTP server
  app.listen(port, "0.0.0.0", () => {
    console.log("SERVER STARTED ON PORT " + port);

    // Confirm DB connectivity with a live row count
    pool
      .query("SELECT COUNT(*) AS cnt FROM users")
      .then((r) => console.log(`[startup] DB ok — users in table: ${r.rows[0].cnt}`))
      .catch((err: Error) => console.error("[startup] DB check failed:", err.message));
  });
}

start().catch((err) => {
  console.error("[startup] Fatal error — server did not start:", err.message);
  process.exit(1);
});
