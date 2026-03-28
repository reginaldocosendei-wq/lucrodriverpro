import { Router, type IRouter } from "express";
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
import adminUsersRouter from "./adminUsers";
import preferencesRouter from "./preferences";
import extraEarningsRouter from "./extraEarnings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
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
router.use("/admin/pix", pixAdminRouter);
router.use("/admin/users", adminUsersRouter);
router.use("/preferences", preferencesRouter);
router.use("/extra-earnings", extraEarningsRouter);

// Dev-only utilities — the router itself refuses all requests in production
router.use("/dev", devAdminRouter);

export default router;
