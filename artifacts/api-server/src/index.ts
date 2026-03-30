import app from "./app";

// ─── PROCESS-LEVEL SAFETY NETS ────────────────────────────────────────────────
// These are registered before anything else so no crash goes unlogged.
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err.message, err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection:", reason);
});

// ─── START SERVER — always first, never blocked by config ─────────────────────
const port = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT " + port);

  // ─── ENV VAR AUDIT ──────────────────────────────────────────────────────────
  // Log presence/absence of every env var the server depends on.
  // Values are NEVER printed — only "set" or "MISSING".
  const vars: Array<{ name: string; required: boolean }> = [
    { name: "DATABASE_URL",              required: true  },
    { name: "SESSION_SECRET",            required: false },
    { name: "STRIPE_SECRET_KEY",         required: false },
    { name: "STRIPE_PUBLISHABLE_KEY",    required: false },
    { name: "STRIPE_WEBHOOK_SECRET",     required: false },
    { name: "MERCADOPAGO_ACCESS_TOKEN",  required: false },
    { name: "MERCADOPAGO_WEBHOOK_SECRET",required: false },
    { name: "APP_BASE_URL",              required: false },
    { name: "ADMIN_EMAIL",               required: false },
    { name: "NODE_ENV",                  required: false },
    { name: "PORT",                      required: false },
  ];

  const missing: string[] = [];
  for (const { name, required } of vars) {
    const present = !!process.env[name];
    if (present) {
      console.log(`[env] ${name}: set`);
    } else {
      console.warn(`[env] ${name}: MISSING${required ? " ⚠ REQUIRED" : ""}`);
      if (required) missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.error("[env] Required vars missing — affected features will fail:", missing.join(", "));
  } else {
    console.log("[env] All required environment variables are present");
  }
});
