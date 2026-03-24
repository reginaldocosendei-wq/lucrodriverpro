import { Router } from "express";
import { db, ridesTable, costsTable, goalsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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

  const rides = await db.select().from(ridesTable).where(eq(ridesTable.userId, userId));
  const costs = await db.select().from(costsTable).where(eq(costsTable.userId, userId));
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).limit(1);

  const today = getDateStr(0);
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const ridesNetValue = (r: typeof rides[0]) => r.netValue;

  const earningsToday = rides
    .filter((r) => r.createdAt.toISOString().split("T")[0] >= today)
    .reduce((s, r) => s + ridesNetValue(r), 0);

  const earningsWeek = rides
    .filter((r) => r.createdAt.toISOString().split("T")[0] >= weekStart)
    .reduce((s, r) => s + ridesNetValue(r), 0);

  const earningsMonth = rides
    .filter((r) => r.createdAt.toISOString().split("T")[0] >= monthStart)
    .reduce((s, r) => s + ridesNetValue(r), 0);

  const costsMonth = costs
    .filter((c) => c.date >= monthStart)
    .reduce((s, c) => s + c.amount, 0);

  const totalRides = rides.length;
  const avgPerRide = totalRides > 0 ? rides.reduce((s, r) => s + ridesNetValue(r), 0) / totalRides : 0;
  const avgPerKm = rides.length > 0
    ? rides.reduce((s, r) => s + r.valuePerKm, 0) / rides.length
    : 0;
  const bestRide = rides.length > 0 ? Math.max(...rides.map(ridesNetValue)) : 0;

  const platformEarnings: Record<string, number> = {};
  for (const r of rides) {
    platformEarnings[r.platform] = (platformEarnings[r.platform] ?? 0) + ridesNetValue(r);
  }
  const bestPlatform =
    Object.entries(platformEarnings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  const realProfitMonth = earningsMonth - costsMonth;

  const goalDaily = goal?.daily ?? 0;
  const goalWeekly = goal?.weekly ?? 0;
  const goalMonthly = goal?.monthly ?? 0;

  const goalDailyPct = goalDaily > 0 ? Math.min((earningsToday / goalDaily) * 100, 100) : 0;
  const goalWeeklyPct = goalWeekly > 0 ? Math.min((earningsWeek / goalWeekly) * 100, 100) : 0;
  const goalMonthlyPct = goalMonthly > 0 ? Math.min((earningsMonth / goalMonthly) * 100, 100) : 0;

  res.json({
    earningsToday,
    earningsWeek,
    earningsMonth,
    totalRides,
    avgPerRide,
    avgPerKm,
    bestRide,
    bestPlatform,
    costsMonth,
    realProfitMonth,
    goalDaily,
    goalWeekly,
    goalMonthly,
    goalDailyPct,
    goalWeeklyPct,
    goalMonthlyPct,
  });
});

export default router;
