import { Router } from "express";
import { db, dailySummariesTable, costsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";

const router = Router();

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

const PT_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PT_DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

router.get("/", async (req, res) => {
  const userId = req.userId!;

  try {
    const today = getDateStr(0);
    const yesterday = getDateStr(1);
    const d7ago = getDateStr(7);

    const [summaries, costs] = await Promise.all([
      db
        .select()
        .from(dailySummariesTable)
        .where(
          and(
            eq(dailySummariesTable.userId, userId),
            gte(dailySummariesTable.date, d7ago),
          ),
        ),
      db
        .select()
        .from(costsTable)
        .where(
          and(eq(costsTable.userId, userId), gte(costsTable.date, d7ago)),
        ),
    ]);

    // Group costs by date
    const costsByDate: Record<string, number> = {};
    for (const c of costs) {
      costsByDate[c.date] = (costsByDate[c.date] ?? 0) + c.amount;
    }

    // Build daily objects with profit
    const days = summaries
      .filter((s) => s.date <= today) // exclude future
      .map((s) => {
        const dayCosts = costsByDate[s.date] ?? 0;
        const profit = s.earnings - dayCosts;
        const jsDate = new Date(s.date + "T12:00:00");
        const dayOfWeek = jsDate.getDay();
        const label =
          s.date === today
            ? "Hoje"
            : s.date === yesterday
              ? "Ontem"
              : PT_DAYS[dayOfWeek];
        return {
          date: s.date,
          label,
          dayFull: PT_DAYS_FULL[dayOfWeek],
          earnings: s.earnings,
          costs: dayCosts,
          profit,
          trips: s.trips,
          hours: s.hoursWorked ?? null,
          km: s.kmDriven ?? null,
          isToday: s.date === today,
          isYesterday: s.date === yesterday,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // most recent first

    if (days.length === 0) {
      res.json({ days: [], bestDay: null, worstDay: null, avgProfit: null, avgEarnings: null, totalProfit: null });
      return;
    }

    // Rankings — only consider days with earnings > 0
    const activeDays = days.filter((d) => d.earnings > 0);
    const bestDay = activeDays.length > 0
      ? activeDays.reduce((a, b) => (b.profit > a.profit ? b : a))
      : null;
    const worstDay = activeDays.length > 1
      ? activeDays.reduce((a, b) => (b.profit < a.profit ? b : a))
      : null;

    const avgProfit = activeDays.length > 0
      ? activeDays.reduce((s, d) => s + d.profit, 0) / activeDays.length
      : null;
    const avgEarnings = activeDays.length > 0
      ? activeDays.reduce((s, d) => s + d.earnings, 0) / activeDays.length
      : null;
    const totalProfit = days.reduce((s, d) => s + d.profit, 0);

    res.json({ days, bestDay, worstDay, avgProfit, avgEarnings, totalProfit });
  } catch (err: any) {
    console.error("Weekly performance error:", err);
    res.status(500).json({ error: "Erro ao buscar performance semanal" });
  }
});

export default router;
