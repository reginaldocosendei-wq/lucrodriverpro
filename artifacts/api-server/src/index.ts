import express from "express";
import cors from "cors";
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
//
// Two paths are registered for flexibility:
//   /api/stripe/webhook   — original path (keeps existing Stripe dashboard configs working)
//   /api/stripe-webhook   — alternate path (as requested; use whichever is in Stripe dashboard)
async function handleStripeWebhook(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
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
}

app.post("/api/stripe/webhook",  express.raw({ type: "application/json" }), handleStripeWebhook);
app.post("/api/stripe-webhook",  express.raw({ type: "application/json" }), handleStripeWebhook);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// MUST come before the domain redirect so that browser OPTIONS preflight
// requests receive proper Access-Control-* headers. If the redirect fires
// first, it returns a 301 with no CORS headers → Chrome treats the preflight
// as failed → blocks the actual POST → user sees the generic error fallback
// even though the server never received the request.
app.use(cors({ origin: true, credentials: true }));


// ─── JSON body parser ─────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Session ──────────────────────────────────────────────────────────────────
// Cookie strategy: always SameSite=None + Secure=true when running on HTTPS.
// This is required because Replit path-routes the frontend and API through a
// reverse proxy, and some browsers treat requests to sub-paths of the same
// domain as cross-origin when the cookie was issued by a proxied sub-service.
// SameSite=None is the most permissive setting and works in all contexts as
// long as Secure=true (HTTPS). Local dev without HTTPS gets Lax.
const isProd = process.env.NODE_ENV === "production";
const isReplitDev = !!process.env["REPLIT_DEV_DOMAIN"] && !isProd;
const needsSecure = isProd || isReplitDev;
const cookieSameSite: "lax" | "none" = needsSecure ? "none" : "lax";

console.log(`[startup] cookie config — sameSite=${cookieSameSite} secure=${needsSecure} isProd=${isProd} isReplitDev=${isReplitDev}`);

const PgStore = ConnectPgSimple(session);
app.use(
  session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "lucro-driver-dev-secret",
    resave: false,
    rolling: true,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: needsSecure,
      sameSite: cookieSameSite,
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }),
);

// ─── Session debug middleware ──────────────────────────────────────────────────
app.use((req, res, next) => {
  const sid = req.sessionID ?? "(none)";
  const uid = (req.session as any)?.userId ?? null;
  const cookieHeader = req.headers.cookie ? "present" : "MISSING";
  if (req.path.startsWith("/api/auth")) {
    console.log(`[session] ${req.method} ${req.path} — sessionId=${sid} userId=${uid ?? "none"} cookie=${cookieHeader}`);
  }
  // Log Set-Cookie header after response for auth endpoints
  if (req.path.startsWith("/api/auth")) {
    const origEnd = res.end.bind(res);
    (res as any).end = function (...args: any[]) {
      const setCookie = res.getHeader("set-cookie");
      if (setCookie) {
        console.log(`[session] SET-COOKIE sent for ${req.method} ${req.path}:`, Array.isArray(setCookie) ? setCookie[0]?.split(";")[0] + "..." : String(setCookie).split(";")[0] + "...");
      } else {
        console.log(`[session] no Set-Cookie header for ${req.method} ${req.path}`);
      }
      return origEnd(...args);
    };
  }
  next();
});

// JWT header is now validated per-route by the requireAuth middleware in
// routes/middleware/requireAuth.ts. No global session pollution needed here.

// ─── Prevent browser / CDN caching of API responses ──────────────────────────
// Without this header, browsers can serve a stale GET /api/auth/me response
// (e.g. plan:"free") from their HTTP cache even after the user subscribes.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

// ─── Log every request to /api/auth/me so we can confirm it reaches us ───────
app.use((req, _res, next) => {
  if (req.path === "/api/auth/me") {
    const auth = req.headers.authorization ? "Bearer present" : "NO AUTH HEADER";
    console.log(`[ME_REQUEST] ${req.method} /api/auth/me — ${auth}`);
  }
  next();
});

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
  const _sk = process.env.STRIPE_SECRET_KEY ?? "";
  console.log("[startup] STRIPE_SECRET_KEY:      ", _sk ? `SET len=${_sk.length} prefix=${_sk.slice(0, 14)}` : "MISSING → will use connector");
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
