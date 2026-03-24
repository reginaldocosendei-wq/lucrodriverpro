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

export default router;
