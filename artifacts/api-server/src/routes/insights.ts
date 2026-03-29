import { Router } from "express";
import { db, dailySummariesTable, costsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { aggregateMetrics } from "../services/metricsService";
import { generateInsights, calculateDecision } from "../services/insightsService";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  try {
    const [summaries, costs] = await Promise.all([
      db.select().from(dailySummariesTable).where(eq(dailySummariesTable.userId, userId)),
      db.select().from(costsTable).where(eq(costsTable.userId, userId)),
    ]);

    const today = getDateStr(0);
    const monthStart = startOfMonth();

    const summariesToday = summaries.filter((s) => s.date >= today);
    const todayAgg = aggregateMetrics(summariesToday);

    const isFixed = (c: { costType?: string | null }) => (c.costType ?? "variable") === "fixed_monthly";
    const variableCosts    = costs.filter((c) => !isFixed(c));
    const fixedCosts       = costs.filter(isFixed);
    const fixedMonthlyTotal   = fixedCosts.reduce((s, c) => s + c.amount, 0);
    const dailyFixedCostQuota = fixedMonthlyTotal > 0 ? fixedMonthlyTotal / 30 : 0;
    const costsToday = variableCosts.filter((c) => c.date >= today).reduce((s, c) => s + c.amount, 0);
    const costsMonth = variableCosts.filter((c) => c.date >= monthStart).reduce((s, c) => s + c.amount, 0);
    const earningsMonth = summaries
      .filter((s) => s.date >= monthStart)
      .reduce((s, r) => s + r.earnings, 0);

    // All-time averages for rating
    const allAgg = aggregateMetrics(summaries);

    const engineInput = {
      summaries,
      costsToday,
      costsMonth,
      fixedMonthlyTotal,
      dailyFixedCostQuota,
      earningsToday: todayAgg.totalEarnings,
      earningsMonth,
      tripsToday: todayAgg.totalTrips,
      hoursToday: todayAgg.totalHours,
      kmToday: todayAgg.totalKm,
      earningsPerHourToday: todayAgg.earningsPerHour,
      earningsPerTripToday: todayAgg.earningsPerTrip,
      earningsPerKmToday: todayAgg.earningsPerKm,
      ratingToday: todayAgg.avgRating,
      ratingAll: allAgg.avgRating,
    };

    const insights = generateInsights(engineInput);
    const decision = calculateDecision(engineInput);

    res.json({ decision, insights });
  } catch (err: any) {
    console.error("Insights error:", err);
    res.status(500).json({ error: "Erro ao gerar insights" });
  }
});

export default router;
