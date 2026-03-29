import { Router } from "express";
import { db, dailySummariesTable, costsTable, extraEarningsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { splitCosts } from "../lib/costSplit";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Normalise a cost record's date to a plain YYYY-MM-DD string.
 *  The `costs.date` column is PostgreSQL `date`, which pg returns as a string,
 *  but we guard against a JS Date object just in case. */
function normaliseCostDate(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

router.get("/earnings", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  // Fetch all three data sources in parallel
  const [summaries, allCosts, extras] = await Promise.all([
    db.select().from(dailySummariesTable).where(eq(dailySummariesTable.userId, userId)),
    db.select().from(costsTable).where(eq(costsTable.userId, userId)),
    db.select().from(extraEarningsTable).where(eq(extraEarningsTable.userId, userId)),
  ]);

  // Normalise cost dates and split into variable (day-specific) vs fixed (monthly quota)
  const normalisedCosts = allCosts.map(c => ({
    ...c,
    date: normaliseCostDate(c.date),
  }));
  const { variable: variableCosts, fixed: fixedCosts } = splitCosts(normalisedCosts);

  // Fixed monthly costs become a flat daily quota — same logic as the dashboard
  const fixedMonthlyTotal = fixedCosts.reduce((s, c) => s + c.amount, 0);
  const dailyFixedQuota   = fixedMonthlyTotal > 0 ? fixedMonthlyTotal / 30 : 0;

  // ── 1. Daily chart — last 30 calendar days ─────────────────────────────────
  const dailyMap: Record<string, { earnings: number; costs: number; trips: number }> = {};

  // Seed the map with all 30 keys so no day is missing from the chart
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    // Pre-load with the daily fixed-cost quota so it distributes across every day
    dailyMap[key] = { earnings: 0, costs: dailyFixedQuota, trips: 0 };
  }

  // Daily summary earnings
  for (const s of summaries) {
    if (dailyMap[s.date] !== undefined) {
      dailyMap[s.date].earnings += s.earnings;
      dailyMap[s.date].trips   += s.trips;
    }
  }

  // Extra earnings (tips, bonuses, incentives …) — same date key format (text YYYY-MM-DD)
  for (const e of extras) {
    if (dailyMap[e.date] !== undefined) {
      dailyMap[e.date].earnings += e.amount;
    }
  }

  // Variable costs — only date-specific expenses (fuel, food, toll …)
  for (const c of variableCosts) {
    if (dailyMap[c.date] !== undefined) {
      dailyMap[c.date].costs += c.amount;
    }
  }

  // Track which dates have at least one real record so we can return null for
  // empty days instead of zero — this prevents flat-line artefacts on the chart.
  const activeDates = new Set<string>();
  for (const s of summaries)      { if (dailyMap[s.date] !== undefined) activeDates.add(s.date); }
  for (const e of extras)         { if (dailyMap[e.date] !== undefined) activeDates.add(e.date); }
  for (const c of variableCosts)  { if (dailyMap[c.date] !== undefined) activeDates.add(c.date); }

  const daily = Object.entries(dailyMap).map(([date, v]) => {
    if (!activeDates.has(date)) {
      // No real data for this day — return nulls so the chart skips the point
      return { date, earnings: null, costs: null, profit: null, trips: 0 };
    }

    const earnings = Math.round(v.earnings * 100) / 100;
    const costs    = Math.round(v.costs    * 100) / 100;

    // Profit is only meaningful when the driver actually earned something.
    // Without earnings, fixed-cost quota would produce a misleading negative
    // default, so we emit null instead — the chart line simply has no point.
    const profit = earnings > 0
      ? Math.round((earnings - costs) * 100) / 100
      : null;

    return { date, earnings, costs, profit, trips: v.trips };
  });

  // ── 2. By Platform — total earnings per platform across ALL history ─────────
  const platformMap: Record<string, { earnings: number; trips: number }> = {};

  for (const s of summaries) {
    const plat = (s.platform ?? "").trim() || "Outros";
    if (!platformMap[plat]) platformMap[plat] = { earnings: 0, trips: 0 };
    platformMap[plat].earnings += s.earnings;
    platformMap[plat].trips   += s.trips;
  }

  // Extra earnings don't belong to a platform — group them separately
  const extraTotal = extras.reduce((s, e) => s + e.amount, 0);
  if (extraTotal > 0) {
    const key = "Bônus / Extras";
    if (!platformMap[key]) platformMap[key] = { earnings: 0, trips: 0 };
    platformMap[key].earnings += extraTotal;
  }

  const byPlatform = Object.entries(platformMap)
    .filter(([, v]) => v.earnings > 0)   // never show a platform at R$0.00
    .map(([platform, v]) => ({
      platform,
      earnings: Math.round(v.earnings * 100) / 100,
      trips:    v.trips,
    }))
    .sort((a, b) => b.earnings - a.earnings);

  // ── 3. By Day of Week — AVERAGE per weekday, not cumulative totals ─────────
  //
  // We track unique dates per weekday so we can divide totals by the number
  // of times that weekday actually appears in the data (avoiding inflated
  // numbers and division-by-zero on weekdays with no activity).

  const dowTotal: Record<number, { earnings: number; costs: number; trips: number }> = {};
  const dowDates: Record<number, Set<string>> = {};
  for (let i = 0; i < 7; i++) {
    dowTotal[i] = { earnings: 0, costs: 0, trips: 0 };
    dowDates[i] = new Set();
  }

  // Summary earnings
  for (const s of summaries) {
    const dow = new Date(s.date + "T12:00:00").getDay();
    dowTotal[dow].earnings += s.earnings;
    dowTotal[dow].trips    += s.trips;
    dowDates[dow].add(s.date);
  }

  // Extra earnings (add to earnings for that weekday)
  for (const e of extras) {
    const dow = new Date(e.date + "T12:00:00").getDay();
    dowTotal[dow].earnings += e.amount;
    dowDates[dow].add(e.date);
  }

  // Variable costs per weekday
  for (const c of variableCosts) {
    const dow = new Date(c.date + "T12:00:00").getDay();
    dowTotal[dow].costs += c.amount;
    // Don't add to dowDates here — a cost-only day with no earnings is not
    // a meaningful "active day" for the earnings average.
  }

  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => {
    const { earnings, costs, trips } = dowTotal[i];
    const n = dowDates[i].size; // number of unique days this weekday appears

    if (n === 0) {
      // No data for this weekday — return explicit zeros (frontend shows empty state)
      return { day: DAY_NAMES[i], earnings: 0, costs: 0, profit: 0, trips: 0 };
    }

    // Averages: total ÷ number of active dates
    const avgEarnings      = earnings / n;
    const avgVariableCosts = costs    / n;
    // Fixed cost quota is the same every day regardless of weekday
    const avgCosts  = avgVariableCosts + dailyFixedQuota;
    const avgProfit = avgEarnings - avgCosts;

    return {
      day:      DAY_NAMES[i],
      earnings: Math.round(avgEarnings * 100) / 100,
      costs:    Math.round(avgCosts    * 100) / 100,
      profit:   Math.round(avgProfit   * 100) / 100,
      trips:    Math.round((trips / n) * 10)  / 10,  // average trips per weekday
    };
  });

  // Temporary diagnostic — remove once charts confirmed working
  const nonNullDays = daily.filter(d => d.earnings !== null);
  console.log(
    `[reports/earnings] userId=${userId}` +
    ` | summaries=${summaries.length} extras=${extras.length} variableCosts=${variableCosts.length}` +
    ` | activeDates=${activeDates.size} | nonNullDays=${nonNullDays.length}` +
    ` | first=${nonNullDays[0]?.date ?? "—"} last=${nonNullDays[nonNullDays.length - 1]?.date ?? "—"}` +
    ` | platforms=${byPlatform.length}`
  );

  res.json({ daily, byPlatform, byDayOfWeek });
});

export default router;
