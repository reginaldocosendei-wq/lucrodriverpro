import { getStripeSync } from "./stripeClient";
import app from "./app";
import { logger } from "./lib/logger";

async function initStripe() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    return;
  }

  try {
    // Always run schema migrations so stripe.* tables exist in every
    // environment (dev + production). Without this the tables are only
    // created when the `dev` script runs; the production `start` script
    // skips migrations, leaving the stripe schema absent and causing every
    // /api/stripe/products-with-prices call to throw a SQL error.
    const { runMigrations } = await import("stripe-replit-sync");
    await runMigrations({ databaseUrl });
    logger.info("Stripe migrations complete");

    logger.info("Initializing Stripe sync...");
    const stripeSync = await getStripeSync();

    const domains = process.env["REPLIT_DOMAINS"]?.split(",") ?? [];
    const webhookBaseUrl = domains[0] ? `https://${domains[0]}` : "";

    if (webhookBaseUrl) {
      logger.info("Setting up managed webhook...");
      await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`,
      );
      logger.info("Webhook configured");
    }

    // Sync existing Stripe data in the background (non-blocking)
    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err: any) => logger.warn({ err: err.message }, "Stripe backfill warn"));

    logger.info("Stripe initialized");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Stripe init skipped (not configured)");
  }
}

const port = Number(process.env["PORT"] || 3000);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${process.env["PORT"]}"`);

// Start listening immediately so the health check (/api/healthz) responds
// right away and Autoscale deployment marks the instance as healthy.
// Stripe initialization runs in the background and must not block startup —
// in production, findOrCreateManagedWebhook can take several seconds or hang,
// which previously prevented app.listen() from ever being called.
app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

initStripe().catch((err: any) => {
  logger.warn({ err: err?.message }, "Stripe background init error");
});
