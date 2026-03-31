import express from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";

const app = express();

// Required so req.secure works behind Replit's proxy in production.
app.set("trust proxy", 1);

// ─── Health checks (must be first — before any middleware) ────────────────────
app.get("/", (_req, res) => res.status(200).send("OK"));
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/api/test", (_req, res) => res.json({ status: "API working" }));

// ─── Stripe webhook — MUST be before express.json() ──────────────────────────
// Stripe sends a raw Buffer; if express.json() runs first it consumes the body
// and the HMAC signature check fails with a 400.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    try {
      const { WebhookHandlers } = await import("./webhookHandlers");
      const s = Array.isArray(sig) ? sig[0] : sig;
      await WebhookHandlers.processWebhook(req.body as Buffer, s);
      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[webhook] processing error:", err.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// ─── Domain redirect (production only) ───────────────────────────────────────
// Registered AFTER the Stripe webhook so Stripe callbacks (which don't follow
// redirects) are never caught here.
const CUSTOM_DOMAIN = "lucrodriverpro.com";
app.use((req, res, next) => {
  if (process.env.REPLIT_DEPLOYMENT !== "1") return next();
  const host = (req.headers.host ?? "").toLowerCase();
  if (!host || host === CUSTOM_DOMAIN || host.endsWith(`.${CUSTOM_DOMAIN}`)) {
    return next();
  }
  return res.redirect(301, `https://${CUSTOM_DOMAIN}${req.url}`);
});

// ─── JSON body parser ─────────────────────────────────────────────────────────
app.use(express.json());

// ─── Session ──────────────────────────────────────────────────────────────────
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

// ─── All API routes (lazily loaded) ──────────────────────────────────────────
// The router is imported on the first request so the server can bind to PORT
// immediately at startup without waiting for @workspace/db or any other import.
// If a route module throws at import time, the error is sent as 500 (not a crash).
let _router: any = null;
async function getRouter() {
  if (!_router) {
    const mod = await import("./routes/index");
    _router = mod.default;
  }
  return _router;
}

app.use("/api", async (req, res, next) => {
  try {
    const router = await getRouter();
    router(req, res, next);
  } catch (err: any) {
    console.error("[router] lazy load error:", err.message);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// ─── Start server IMMEDIATELY ─────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT:", port);
  console.log("[startup] NODE_ENV:", process.env.NODE_ENV ?? "undefined");
  console.log("[startup] DATABASE_URL:          ", process.env.DATABASE_URL       ? "SET" : "MISSING ⚠️");
  console.log("[startup] SESSION_SECRET:         ", process.env.SESSION_SECRET     ? "SET" : "MISSING ⚠️ (using dev fallback)");
  console.log("[startup] STRIPE_SECRET_KEY:      ", process.env.STRIPE_SECRET_KEY  ? "SET" : "will use connector");
  console.log("[startup] STRIPE_WEBHOOK_SECRET:  ", process.env.STRIPE_WEBHOOK_SECRET ? "SET" : "MISSING ⚠️ (webhooks unvalidated)");
  console.log("[startup] MERCADOPAGO_ACCESS_TOKEN:", process.env.MERCADOPAGO_ACCESS_TOKEN ? "SET" : "MISSING (PIX disabled)");
});

// ─── Catch silent crashes ─────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT ERROR:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED PROMISE:", err);
});
