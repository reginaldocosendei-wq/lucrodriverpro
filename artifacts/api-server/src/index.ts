import app from "./app";
import { pool } from "@workspace/db";
import { ensureSchema } from "./lib/ensureSchema";

const port = Number(process.env.PORT) || 3000;

// ─── START SERVER IMMEDIATELY ─────────────────────────────────────────────────
// app.listen() is FIRST — nothing blocks it. The port must be exposed before
// Autoscale's health-check probe fires.
app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT " + port);

  // All async init runs in the background AFTER the port is already open.
  runBackgroundInit().catch((err) =>
    console.error("[startup] background init error:", err.message),
  );
});

// ─── BACKGROUND INIT ──────────────────────────────────────────────────────────
// Nothing here can throw past its own catch or kill the process.
// The server continues serving requests regardless of what happens here.
async function runBackgroundInit() {
  if (!process.env.DATABASE_URL) {
    console.error("[startup] WARNING: DATABASE_URL not set — DB features unavailable");
    return;
  }

  // 1. Ensure all application tables exist (CREATE TABLE IF NOT EXISTS — safe).
  try {
    await ensureSchema();
  } catch (err: any) {
    console.error("[startup] ensureSchema failed:", err.message);
  }

  // 2. Stripe-sync schema migrations (non-fatal).
  try {
    const { runMigrations } = await import("stripe-replit-sync");
    await runMigrations({ databaseUrl: process.env.DATABASE_URL! });
    console.log("[startup] Stripe sync migrations ok");
  } catch (err: any) {
    console.warn("[startup] Stripe sync migrations skipped:", err.message);
  }

  // 3. Confirm live DB connectivity.
  try {
    const r = await pool.query("SELECT COUNT(*) AS cnt FROM users");
    console.log(`[startup] DB ok — users in table: ${r.rows[0].cnt}`);
  } catch (err: any) {
    console.error("[startup] DB check failed:", err.message);
  }
}
