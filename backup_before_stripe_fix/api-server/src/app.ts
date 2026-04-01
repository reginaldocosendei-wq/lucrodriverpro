import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { WebhookHandlers } from "./webhookHandlers";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy hop (Replit's HTTPS termination layer).
// Without this, req.secure is always false because the server itself receives
// plain HTTP from the Replit reverse proxy.  express-session silently skips
// setting the cookie when secure:true and req.secure is false, causing 401
// on every request after login.
app.set("trust proxy", 1);

// ─── ROOT HEALTH CHECK ────────────────────────────────────────────────────────
// Responds before domain-redirect and any other middleware.
// Autoscale / Cloud Run probes that hit "/" will always get 200 OK.
app.get("/", (_req, res) => {
  res.send("OK");
});

// ─── STRIPE WEBHOOK — must be registered BEFORE express.json() ───────────────
// Stripe sends raw Buffer; if express.json() runs first the signature check fails.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("Webhook error:", err.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// ─── DOMAIN REDIRECT (production only) ───────────────────────────────────────
// Registered AFTER the Stripe webhook handler so that webhook callbacks from
// Stripe (which don't follow redirects) are never affected.
// Any other request arriving on the .replit.app URL is permanently redirected
// to the custom domain with HTTPS preserved.
const CUSTOM_DOMAIN = "lucrodriverpro.com";

app.use((req, res, next) => {
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  if (!isProduction) return next();

  const host = (req.headers.host ?? "").toLowerCase();
  if (!host || host === CUSTOM_DOMAIN || host.endsWith(`.${CUSTOM_DOMAIN}`)) {
    return next(); // already on the custom domain
  }

  // Preserve the full path + query string in the redirect target.
  return res.redirect(301, `https://${CUSTOM_DOMAIN}${req.url}`);
});

// ─── GENERAL MIDDLEWARE ───────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));

const isProd = process.env.NODE_ENV === "production";

// Running inside Replit (dev or prod) means the app is always accessed over
// HTTPS (replit.dev / replit.app domains), AND the preview pane is an iframe
// embedded cross-site inside replit.com.  SameSite=Lax blocks cookies in that
// cross-site iframe context — so we must use SameSite=None + Secure=true
// whenever we're in Replit, not just in production.
const isReplit = !!process.env["REPLIT_DEV_DOMAIN"] || isProd;

// ─── SESSION STORE ────────────────────────────────────────────────────────────
// PostgreSQL-backed so sessions survive server restarts.
// The `session` table is created automatically on first boot (createTableIfMissing).
const PgStore = ConnectPgSimple(session);
const sessionStore = new PgStore({
  conString: process.env["DATABASE_URL"],
  createTableIfMissing: true,
  ttl: 7 * 24 * 60 * 60, // seconds — matches maxAge below
});

app.use(
  session({
    store: sessionStore,
    secret: process.env["SESSION_SECRET"] ?? "lucro-driver-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      // SameSite=None + Secure=true is required in two situations:
      //   1. Production: Capacitor WebViews send cookies cross-site to the API.
      //   2. Replit dev preview: the preview pane is a cross-site iframe on
      //      replit.com, so SameSite=Lax causes the browser to block the
      //      session cookie on every fetch after the initial page load → 401.
      // Both cases are HTTPS, so Secure=true is always valid here.
      secure: isReplit,
      httpOnly: true,
      sameSite: isReplit ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

export default app;