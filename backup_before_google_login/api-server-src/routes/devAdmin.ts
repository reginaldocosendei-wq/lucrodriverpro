import { Router } from "express";
import { db, dailySummariesTable, ridesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { paymentService } from "../paymentService";

const router = Router();

// ── Hard guard: refuse all requests in production ─────────────────────────────
router.use((_req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
});

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

// ── GET /api/dev/test-data-summary ────────────────────────────────────────────
// Returns row counts for the logged-in user across both tables.
router.get("/test-data-summary", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  try {
    const ridesCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(ridesTable)
      .where(eq(ridesTable.userId, userId));

    const summariesCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dailySummariesTable)
      .where(eq(dailySummariesTable.userId, userId));

    res.json({
      rides:     Number(ridesCount[0]?.count     ?? 0),
      summaries: Number(summariesCount[0]?.count ?? 0),
    });
  } catch (err) {
    console.error("[DEV] summary error:", err);
    res.status(500).json({ error: "Erro ao contar registros" });
  }
});

// ── DELETE /api/dev/purge-test-data ───────────────────────────────────────────
// Deletes ALL rides + daily_summaries for the authenticated user only.
router.delete("/purge-test-data", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  try {
    // Count before deleting so we can report back
    const [ridesRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(ridesTable)
      .where(eq(ridesTable.userId, userId));

    const [summariesRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dailySummariesTable)
      .where(eq(dailySummariesTable.userId, userId));

    const ridesCount     = Number(ridesRow?.count     ?? 0);
    const summariesCount = Number(summariesRow?.count ?? 0);

    // Delete
    await db.delete(ridesTable).where(eq(ridesTable.userId, userId));
    await db.delete(dailySummariesTable).where(eq(dailySummariesTable.userId, userId));

    console.warn(
      `[DEV] Purged test data for user ${userId}: ${ridesCount} rides, ${summariesCount} daily summaries`
    );

    res.json({
      deleted: { rides: ridesCount, summaries: summariesCount },
      message: "Dados de teste removidos com sucesso.",
    });
  } catch (err) {
    console.error("[DEV] purge error:", err);
    res.status(500).json({ error: "Erro ao remover registros de teste" });
  }
});

// ── POST /api/dev/simulate-upgrade ───────────────────────────────────────────
// Instantly activates PRO for the logged-in user without going through Stripe.
// The router-level guard above already returns 404 in production — this handler
// is only reachable in development / staging environments.
router.post("/simulate-upgrade", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  try {
    await paymentService.activateProAccess(userId);
    console.log("[DEV] simulate-upgrade — userId=%d → PRO", userId);
    res.json({ ok: true, plan: "pro" });
  } catch (err: any) {
    console.error("[DEV] simulate-upgrade error:", err?.message);
    res.status(500).json({ error: "Erro ao ativar PRO (dev)" });
  }
});

export default router;
