import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import healthRouter from "./health";
import authRouter from "./auth";
import ridesRouter from "./rides";
import costsRouter from "./costs";
import goalsRouter from "./goals";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import stripeRouter from "./stripe";
import importRouter from "./import";
import dailySummariesRouter from "./dailySummaries";
import insightsRouter from "./insights";
import weeklyPerformanceRouter from "./weeklyPerformance";
import devAdminRouter from "./devAdmin";
import pixRouter from "./pix";
import pixAdminRouter from "./pixAdmin";
import mercadopagoRouter from "./mercadopago";
import adminUsersRouter from "./adminUsers";
import adminActivateProRouter from "./adminActivatePro";
import preferencesRouter from "./preferences";
import extraEarningsRouter from "./extraEarnings";
import createCheckoutRouter from "./createCheckout";
import gamificationRouter from "./gamification";
import assistantRouter from "./assistant";

// Resolve ZIP_PATH from bundle location — identical logic to index.ts
const _routerDir = path.dirname(fileURLToPath(import.meta.url));
const _workspaceRoot = path.resolve(_routerDir, "../../../..");
const ROUTER_ZIP_PATH = path.join(_workspaceRoot, "app.zip");

const router: IRouter = Router();

// ─── DOWNLOAD PROBE — must be first in router (mounted at /api) ───────────────
// /api/download reaches here because index.ts does: app.use("/api", router)
// Express strips the /api prefix before passing to this router, so the path
// seen here is /download.
router.use("/download", (_req, res) => {
  console.log("ZIP PATH:", ROUTER_ZIP_PATH);
  if (!fs.existsSync(ROUTER_ZIP_PATH)) {
    console.log("ZIP NOT FOUND:", ROUTER_ZIP_PATH);
    return res.status(404).send("ZIP não encontrado");
  }
  return res.download(ROUTER_ZIP_PATH, "lucrodriverpro.zip");
});
router.use(healthRouter);
router.use("/auth", authRouter);

// All routes below this line require authentication.
// requireAuth checks Authorization: Bearer JWT first, then falls back to
// cookie session. Returns 401 immediately if neither is present/valid.
router.use(requireAuth);

router.use("/rides", ridesRouter);
router.use("/costs", costsRouter);
router.use("/goals", goalsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/reports", reportsRouter);
router.use("/stripe", stripeRouter);
router.use("/import", importRouter);
router.use("/daily-summaries", dailySummariesRouter);
router.use("/insights", insightsRouter);
router.use("/weekly-performance", weeklyPerformanceRouter);

router.use("/pix", pixRouter);
router.use("/pix/mp", mercadopagoRouter);
router.use("/admin/pix", pixAdminRouter);
router.use("/admin/users", adminUsersRouter);
router.use("/admin/activate-pro", adminActivateProRouter);
router.use("/preferences", preferencesRouter);
router.use("/extra-earnings", extraEarningsRouter);
router.use("/create-checkout", createCheckoutRouter);
router.use("/gamification", gamificationRouter);
router.use("/assistant", assistantRouter);

// Dev-only utilities — the router itself refuses all requests in production
router.use("/dev", devAdminRouter);

export default router;
