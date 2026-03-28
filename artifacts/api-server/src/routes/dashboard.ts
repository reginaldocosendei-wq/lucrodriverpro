import { Router } from "express";
import { db, ridesTable, costsTable, goalsTable, dailySummariesTable, extraEarningsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { aggregateMetrics } from "../services/metricsService";

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

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

router.get("/summary", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const [summaries, rides, costs, [goal], extraEarnings] = await Promise.all([
    db.select().from(dailySummariesTable).where(eq(dailySummariesTable.userId, userId)),
    db.select().from(ridesTable).where(eq(ridesTable.userId, userId)),
    db.select().from(costsTable).where(eq(costsTable.userId, userId)),
    db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).limit(1),
    db.select().from(extraEarningsTable).where(eq(extraEarningsTable.userId, userId)),
  ]);

  const today = getDateStr(0);
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  // ── daily_summaries aggregations ──────────────────────────────────────────
  const summariesToday = summaries.filter((s) => s.date >= today);
  const summariesWeek = summaries.filter((s) => s.date >= weekStart);
  const summariesMonth = summaries.filter((s) => s.date >= monthStart);

  const todayAgg = aggregateMetrics(summariesToday);
  const weekAgg = aggregateMetrics(summariesWeek);
  const monthAgg = aggregateMetrics(summariesMonth);
  const allAgg = aggregateMetrics(summaries);

  // ── legacy rides (fallback for accounts that haven't migrated) ────────────
  const ridesToday = rides.filter((r) => r.createdAt.toISOString().split("T")[0] >= today);
  const ridesEarningsToday = ridesToday.reduce((s, r) => s + r.value, 0);
  const ridesCountToday = ridesToday.length;

  const ridesEarningsWeek = rides
    .filter((r) => r.createdAt.toISOString().split("T")[0] >= weekStart)
    .reduce((s, r) => s + r.value, 0);

  const ridesEarningsMonth = rides
    .filter((r) => r.createdAt.toISOString().split("T")[0] >= monthStart)
    .reduce((s, r) => s + r.value, 0);

  // ── Prefer daily_summaries over rides ─────────────────────────────────────
  const earningsToday = todayAgg.totalEarnings > 0 ? todayAgg.totalEarnings : ridesEarningsToday;
  const tripsToday = todayAgg.totalTrips > 0 ? todayAgg.totalTrips : ridesCountToday;
  const earningsWeek = weekAgg.totalEarnings > 0 ? weekAgg.totalEarnings : ridesEarningsWeek;
  const earningsMonth = monthAgg.totalEarnings > 0 ? monthAgg.totalEarnings : ridesEarningsMonth;

  // ── Extra earnings ─────────────────────────────────────────────────────────
  const extraToday  = extraEarnings.filter((e) => e.date >= today).reduce((s, e) => s + e.amount, 0);
  const extraWeek   = extraEarnings.filter((e) => e.date >= weekStart).reduce((s, e) => s + e.amount, 0);
  const extraMonth  = extraEarnings.filter((e) => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);

  // ── Costs ──────────────────────────────────────────────────────────────────
  const costsToday = costs.filter((c) => c.date >= today).reduce((s, c) => s + c.amount, 0);
  const costsMonth = costs.filter((c) => c.date >= monthStart).reduce((s, c) => s + c.amount, 0);

  const realProfitToday = (earningsToday + extraToday) - costsToday;
  const realProfitMonth = (earningsMonth + extraMonth) - costsMonth;

  // ── New metrics from daily_summaries ──────────────────────────────────────
  const earningsPerTripToday = todayAgg.earningsPerTrip;
  const earningsPerKmToday = todayAgg.earningsPerKm;
  const earningsPerHourToday = todayAgg.earningsPerHour;
  const ratingToday = todayAgg.avgRating;

  const earningsPerTripAll = allAgg.earningsPerTrip;
  const earningsPerKmAll = allAgg.earningsPerKm;
  const earningsPerHourAll = allAgg.earningsPerHour;
  const ratingAll = allAgg.avgRating;

  // ── Legacy per-km from rides (fallback) ───────────────────────────────────
  const legacyAvgPerKm =
    rides.length > 0 ? rides.reduce((s, r) => s + r.valuePerKm, 0) / rides.length : 0;

  const avgPerKm = earningsPerKmAll ?? legacyAvgPerKm;
  const avgPerRide = earningsPerTripAll ?? (rides.length > 0 ? rides.reduce((s, r) => s + r.value, 0) / rides.length : 0);

  // ── Best platform ─────────────────────────────────────────────────────────
  const platformMap: Record<string, number> = {};
  for (const s of summaries) {
    if (s.platform) platformMap[s.platform] = (platformMap[s.platform] ?? 0) + s.earnings;
  }
  for (const r of rides) {
    platformMap[r.platform] = (platformMap[r.platform] ?? 0) + r.value;
  }
  const bestPlatform = Object.entries(platformMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  const totalRides = summaries.reduce((s, r) => s + r.trips, 0) + rides.length;
  const bestRide = rides.length > 0 ? Math.max(...rides.map((r) => r.value)) : 0;

  // ── Goals ─────────────────────────────────────────────────────────────────
  const goalDaily = goal?.daily ?? 0;
  const goalWeekly = goal?.weekly ?? 0;
  const goalMonthly = goal?.monthly ?? 0;

  const goalDailyPct   = goalDaily   > 0 ? Math.min(((earningsToday + extraToday)   / goalDaily)   * 100, 100) : 0;
  const goalWeeklyPct  = goalWeekly  > 0 ? Math.min(((earningsWeek  + extraWeek)    / goalWeekly)  * 100, 100) : 0;
  const goalMonthlyPct = goalMonthly > 0 ? Math.min(((earningsMonth + extraMonth)   / goalMonthly) * 100, 100) : 0;

  res.json({
    // Earnings (app only, from screenshots)
    earningsToday,
    earningsWeek,
    earningsMonth,
    // Extra manual earnings
    extraEarningsToday: extraToday,
    extraEarningsWeek: extraWeek,
    extraEarningsMonth: extraMonth,
    // True totals (app + extras)
    totalEarningsToday: earningsToday + extraToday,
    totalEarningsWeek:  earningsWeek  + extraWeek,
    totalEarningsMonth: earningsMonth + extraMonth,
    // Trips
    ridesCountToday: tripsToday,
    totalRides,
    // Daily metrics
    earningsPerTripToday,
    earningsPerKmToday,
    earningsPerHourToday,
    ratingToday,
    // All-time metrics
    earningsPerTripAll,
    earningsPerKmAll,
    earningsPerHourAll,
    ratingAll,
    // Legacy compat
    avgPerRide,
    avgPerKm,
    bestRide,
    bestPlatform,
    // Costs / profit
    costsToday,
    realProfitToday,
    costsMonth,
    realProfitMonth,
    // Goals
    goalDaily,
    goalWeekly,
    goalMonthly,
    goalDailyPct,
    goalWeeklyPct,
    goalMonthlyPct,
    // km/hours totals (today)
    kmToday: todayAgg.totalKm,
    hoursToday: todayAgg.totalHours,
  });
});

export default router;
