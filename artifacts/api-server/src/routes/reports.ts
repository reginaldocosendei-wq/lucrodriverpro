import { Router } from "express";
import { db, dailySummariesTable, costsTable, extraEarningsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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

/** Normalise a cost record's date to a plain YYYY-MM-DD string. */
function normaliseCostDate(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

/**
 * Merge daily_summaries rows with per-date aggregates from the rides table.
 *
 * Priority rule: if a date already has a manual daily_summary, that record
 * wins (it may have been hand-corrected). Rides-only dates fill in the gaps.
 *
 * This mirrors the same logic used in GET /api/daily-summaries so that
 * reports and the home screen always draw from the same merged dataset.
 */
async function getMergedSummaries(userId: number): Promise<Array<{
  date: string;
  earnings: number;
  trips: number;
  platform: string | null;
}>> {
  // 1. All manual daily summaries
  const summaries = await db
    .select()
    .from(dailySummariesTable)
    .where(eq(dailySummariesTable.userId, userId));

  const coveredDates = new Set(summaries.map((s) => s.date));

  // 2. Aggregate rides by (date, platform) for dates not already covered by a
  //    manual daily_summary. Grouping by platform ensures all platforms appear
  //    separately in the "By Platform" chart even when added on the same day.
  const ridesAgg = await db.execute(sql`
    SELECT
      TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      ROUND(SUM(value)::numeric, 2)                        AS earnings,
      COUNT(*)::int                                        AS trips,
      COALESCE(NULLIF(TRIM(platform), ''), 'Outros')       AS platform
    FROM rides
    WHERE user_id = ${userId}
    GROUP BY
      TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      COALESCE(NULLIF(TRIM(platform), ''), 'Outros')
    ORDER BY date DESC
  `);

  // 3. Build synthetic entries for uncovered dates (one row per date+platform)
  const ridesEntries = (ridesAgg.rows as any[])
    .filter((r) => !coveredDates.has(r.date as string))
    .map((r) => ({
      date:     r.date as string,
      earnings: parseFloat(r.earnings as string),
      trips:    parseInt(r.trips as string, 10),
      platform: (r.platform as string | null) || null,
    }));

  // 4. Tag manual summaries with the same shape
  const summaryEntries = summaries.map((s) => ({
    date:     s.date,
    earnings: s.earnings,
    trips:    s.trips,
    platform: s.platform ?? null,
  }));

  console.log(`[reports/earnings] userId=${userId} summaries=${summaryEntries.length} ridesAggDates=${ridesEntries.length} total=${summaryEntries.length + ridesEntries.length}`);

  return [...summaryEntries, ...ridesEntries];
}

router.get("/earnings", requireAuth, async (req, res) => {
  const userId = req.userId!;

  try {
    // ── Load all data sources in parallel ─────────────────────────────────────
    const [allSummaries, allCosts, extras] = await Promise.all([
      getMergedSummaries(userId),
      db.select().from(costsTable).where(eq(costsTable.userId, userId)),
      db.select().from(extraEarningsTable).where(eq(extraEarningsTable.userId, userId)),
    ]);

    // The merged list is what we call "summaries" for the rest of the computation
    const summaries = allSummaries;

    // Normalise cost dates and split into variable vs fixed
    const normalisedCosts = allCosts.map(c => ({
      ...c,
      date: normaliseCostDate(c.date),
    }));
    const { variable: variableCosts, fixed: fixedCosts } = splitCosts(normalisedCosts);

    // Fixed monthly costs → flat daily quota
    const fixedMonthlyTotal = fixedCosts.reduce((s, c) => s + c.amount, 0);
    const dailyFixedQuota   = fixedMonthlyTotal > 0 ? fixedMonthlyTotal / 30 : 0;

    // ── 1. Daily chart — last 30 calendar days ──────────────────────────────
    const dailyMap: Record<string, { earnings: number; costs: number; trips: number }> = {};

    // Seed with 30 keys so no day is missing
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { earnings: 0, costs: dailyFixedQuota, trips: 0 };
    }

    for (const s of summaries) {
      if (dailyMap[s.date] !== undefined) {
        dailyMap[s.date].earnings += s.earnings;
        dailyMap[s.date].trips   += s.trips;
      }
    }

    for (const e of extras) {
      if (dailyMap[e.date] !== undefined) {
        dailyMap[e.date].earnings += e.amount;
      }
    }

    for (const c of variableCosts) {
      if (dailyMap[c.date] !== undefined) {
        dailyMap[c.date].costs += c.amount;
      }
    }

    // Track which dates have at least one real record
    const activeDates = new Set<string>();
    for (const s of summaries)     { if (dailyMap[s.date] !== undefined) activeDates.add(s.date); }
    for (const e of extras)        { if (dailyMap[e.date] !== undefined) activeDates.add(e.date); }
    for (const c of variableCosts) { if (dailyMap[c.date] !== undefined) activeDates.add(c.date); }

    const daily = Object.entries(dailyMap).map(([date, v]) => {
      if (!activeDates.has(date)) {
        return { date, earnings: null, costs: null, profit: null, trips: 0 };
      }
      const earnings = Math.round(v.earnings * 100) / 100;
      const costs    = Math.round(v.costs    * 100) / 100;
      const profit   = earnings > 0 ? Math.round((earnings - costs) * 100) / 100 : null;
      return { date, earnings, costs, profit, trips: v.trips };
    });

    // ── 2. By Platform — totals across ALL history ──────────────────────────
    const platformMap: Record<string, { earnings: number; trips: number }> = {};

    for (const s of summaries) {
      const plat = (s.platform ?? "").trim() || "Outros";
      if (!platformMap[plat]) platformMap[plat] = { earnings: 0, trips: 0 };
      platformMap[plat].earnings += s.earnings;
      platformMap[plat].trips   += s.trips;
    }

    const extraTotal = extras.reduce((s, e) => s + e.amount, 0);
    if (extraTotal > 0) {
      const key = "Bônus / Extras";
      if (!platformMap[key]) platformMap[key] = { earnings: 0, trips: 0 };
      platformMap[key].earnings += extraTotal;
    }

    const byPlatform = Object.entries(platformMap)
      .filter(([, v]) => v.earnings > 0)
      .map(([platform, v]) => ({
        platform,
        earnings: Math.round(v.earnings * 100) / 100,
        trips:    v.trips,
      }))
      .sort((a, b) => b.earnings - a.earnings);

    console.log(`[reports/earnings] byPlatform=${JSON.stringify(byPlatform)}`);

    // ── 3. By Day of Week — AVERAGE per weekday ─────────────────────────────
    const dowTotal: Record<number, { earnings: number; costs: number; trips: number }> = {};
    const dowDates: Record<number, Set<string>> = {};
    for (let i = 0; i < 7; i++) {
      dowTotal[i] = { earnings: 0, costs: 0, trips: 0 };
      dowDates[i] = new Set();
    }

    for (const s of summaries) {
      const dow = new Date(s.date + "T12:00:00").getDay();
      dowTotal[dow].earnings += s.earnings;
      dowTotal[dow].trips    += s.trips;
      dowDates[dow].add(s.date);
    }

    for (const e of extras) {
      const dow = new Date(e.date + "T12:00:00").getDay();
      dowTotal[dow].earnings += e.amount;
      dowDates[dow].add(e.date);
    }

    for (const c of variableCosts) {
      const dow = new Date(c.date + "T12:00:00").getDay();
      dowTotal[dow].costs += c.amount;
    }

    const byDayOfWeek = Array.from({ length: 7 }, (_, i) => {
      const { earnings, costs, trips } = dowTotal[i];
      const n = dowDates[i].size;

      if (n === 0) {
        return { day: DAY_NAMES[i], earnings: 0, costs: 0, profit: 0, trips: 0 };
      }

      const avgEarnings      = earnings / n;
      const avgVariableCosts = costs    / n;
      const avgCosts         = avgVariableCosts + dailyFixedQuota;
      const avgProfit        = avgEarnings - avgCosts;

      return {
        day:      DAY_NAMES[i],
        earnings: Math.round(avgEarnings * 100) / 100,
        costs:    Math.round(avgCosts    * 100) / 100,
        profit:   Math.round(avgProfit   * 100) / 100,
        trips:    Math.round((trips / n) * 10)  / 10,
      };
    });

    res.json({ daily, byPlatform, byDayOfWeek });

  } catch (err: any) {
    console.error("[reports/earnings] error:", err.message, err.stack);
    res.status(500).json({ error: "Erro ao gerar relatório" });
  }
});

// ── Debug endpoint — returns raw merged data for the logged-in user ──────────
// Useful for verifying that rides + summaries are both included.
router.get("/debug", requireAuth, async (req, res) => {
  const userId = req.userId!;
  try {
    const [summaries, ridesAgg, extras] = await Promise.all([
      db.select().from(dailySummariesTable).where(eq(dailySummariesTable.userId, userId)),
      db.execute(sql`
        SELECT
          TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          ROUND(SUM(value)::numeric, 2)                        AS earnings,
          COUNT(*)::int                                        AS trips,
          COALESCE(NULLIF(TRIM(platform), ''), 'Outros')       AS platform
        FROM rides WHERE user_id = ${userId}
        GROUP BY
          TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
          COALESCE(NULLIF(TRIM(platform), ''), 'Outros')
        ORDER BY date DESC
      `),
      db.select().from(extraEarningsTable).where(eq(extraEarningsTable.userId, userId)),
    ]);
    res.json({
      userId,
      dailySummariesCount: summaries.length,
      dailySummaries:      summaries,
      ridesAggregatedDates: ridesAgg.rows.length,
      ridesAggregated:     ridesAgg.rows,
      extraEarningsCount:  extras.length,
      extraEarnings:       extras,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
