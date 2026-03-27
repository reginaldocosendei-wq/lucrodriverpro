import { Router } from "express";
import { db, dailySummariesTable, costsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { aggregateMetrics } from "../services/metricsService";
import { generateInsights } from "../services/insightsService";

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

    const costsToday = costs.filter((c) => c.date >= today).reduce((s, c) => s + c.amount, 0);
    const costsMonth = costs.filter((c) => c.date >= monthStart).reduce((s, c) => s + c.amount, 0);
    const earningsMonth = summaries
      .filter((s) => s.date >= monthStart)
      .reduce((s, r) => s + r.earnings, 0);

    // All-time averages for rating
    const allAgg = aggregateMetrics(summaries);

    const insights = generateInsights({
      summaries,
      costsToday,
      costsMonth,
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
    });

    res.json(insights);
  } catch (err: any) {
    console.error("Insights error:", err);
    res.status(500).json({ error: "Erro ao gerar insights" });
  }
});

export default router;
