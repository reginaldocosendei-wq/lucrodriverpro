import { pool } from "@workspace/db";

/**
 * Creates all application tables if they do not already exist.
 * Uses IF NOT EXISTS — safe to run on every startup, against any state.
 * Must be called before app.listen() so the health check only passes once
 * the database is confirmed ready.
 */
export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id               SERIAL      PRIMARY KEY,
        name             TEXT        NOT NULL,
        email            TEXT        NOT NULL UNIQUE,
        password_hash    TEXT        NOT NULL,
        plan             TEXT        NOT NULL DEFAULT 'free',
        stripe_customer_id     TEXT,
        stripe_subscription_id TEXT,
        trial_start_date TIMESTAMP,
        save_mode_replace BOOLEAN   NOT NULL DEFAULT false,
        activated_at     TIMESTAMP,
        created_at       TIMESTAMP   NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rides (
        id                SERIAL  PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value             REAL    NOT NULL,
        distance_km       REAL    NOT NULL,
        duration_minutes  INTEGER NOT NULL,
        platform          TEXT    NOT NULL,
        passenger_rating  REAL    NOT NULL,
        value_per_km      REAL    NOT NULL,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS costs (
        id          SERIAL  PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category    TEXT    NOT NULL,
        cost_type   TEXT    NOT NULL DEFAULT 'variable',
        amount      REAL    NOT NULL,
        description TEXT    NOT NULL DEFAULT '',
        date        DATE    NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS daily_summaries (
        id           SERIAL  PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date         TEXT    NOT NULL,
        earnings     REAL    NOT NULL,
        trips        INTEGER NOT NULL,
        km_driven    REAL,
        hours_worked REAL,
        rating       REAL,
        platform     TEXT,
        notes        TEXT,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS goals (
        id         SERIAL  PRIMARY KEY,
        user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        daily      REAL    NOT NULL DEFAULT 0,
        weekly     REAL    NOT NULL DEFAULT 0,
        monthly    REAL    NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pix_payments (
        id           SERIAL  PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
        email        TEXT    NOT NULL,
        name         TEXT    NOT NULL DEFAULT '',
        amount       TEXT    NOT NULL DEFAULT '19.90',
        status       TEXT    NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMP,
        rejected_at  TIMESTAMP,
        proof_url    TEXT,
        notes        TEXT
      );

      CREATE TABLE IF NOT EXISTS extra_earnings (
        id         SERIAL  PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date       TEXT    NOT NULL,
        type       TEXT    NOT NULL,
        amount     REAL    NOT NULL,
        note       TEXT    NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("[startup] schema verified — all tables ready");
  } finally {
    client.release();
  }
}
