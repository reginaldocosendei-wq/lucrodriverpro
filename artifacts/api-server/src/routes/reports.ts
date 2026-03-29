import { Router } from "express";
import { db, dailySummariesTable, costsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

router.get("/earnings", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  // All user data lives in daily_summaries (CSV imports + manual entries)
  const summaries = await db
    .select()
    .from(dailySummariesTable)
    .where(eq(dailySummariesTable.userId, userId));

  const costs = await db
    .select()
    .from(costsTable)
    .where(eq(costsTable.userId, userId));

  // ── Daily (last 30 days) ────────────────────────────────────────────────
  const dailyMap: Record<string, { earnings: number; costs: number; trips: number }> = {};

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = { earnings: 0, costs: 0, trips: 0 };
  }

  for (const s of summaries) {
    if (dailyMap[s.date]) {
      dailyMap[s.date].earnings += s.earnings;
      dailyMap[s.date].trips   += s.trips;
    }
  }

  for (const c of costs) {
    const dateKey = typeof c.date === "string" ? c.date : (c.date as any).toISOString?.().split("T")[0] ?? String(c.date);
    if (dailyMap[dateKey]) {
      dailyMap[dateKey].costs += c.amount;
    }
  }

  const daily = Object.entries(dailyMap).map(([date, v]) => ({
    date,
    earnings: Math.round(v.earnings * 100) / 100,
    costs:    Math.round(v.costs    * 100) / 100,
    profit:   Math.round((v.earnings - v.costs) * 100) / 100,
    trips:    v.trips,
  }));

  // ── By Platform ─────────────────────────────────────────────────────────
  const platformMap: Record<string, { earnings: number; trips: number }> = {};

  for (const s of summaries) {
    const plat = (s.platform ?? "").trim() || "Outros";
    if (!platformMap[plat]) platformMap[plat] = { earnings: 0, trips: 0 };
    platformMap[plat].earnings += s.earnings;
    platformMap[plat].trips   += s.trips;
  }

  const byPlatform = Object.entries(platformMap)
    .map(([platform, v]) => ({
      platform,
      earnings: Math.round(v.earnings * 100) / 100,
      trips:    v.trips,
    }))
    .sort((a, b) => b.earnings - a.earnings);

  // ── By Day of Week ───────────────────────────────────────────────────────
  const dowMap: Record<number, { earnings: number; costs: number; trips: number }> = {};
  for (let i = 0; i < 7; i++) dowMap[i] = { earnings: 0, costs: 0, trips: 0 };

  for (const s of summaries) {
    // Use noon to avoid UTC midnight DST edge cases
    const dow = new Date(s.date + "T12:00:00").getDay();
    dowMap[dow].earnings += s.earnings;
    dowMap[dow].trips    += s.trips;
  }

  for (const c of costs) {
    const dateKey = typeof c.date === "string" ? c.date : (c.date as any).toISOString?.().split("T")[0] ?? String(c.date);
    const dow = new Date(dateKey + "T12:00:00").getDay();
    if (dowMap[dow]) dowMap[dow].costs += c.amount;
  }

  const byDayOfWeek = Object.entries(dowMap).map(([dow, v]) => ({
    day:      DAY_NAMES[parseInt(dow)],
    earnings: Math.round(v.earnings * 100) / 100,
    costs:    Math.round(v.costs    * 100) / 100,
    profit:   Math.round((v.earnings - v.costs) * 100) / 100,
    trips:    v.trips,
  }));

  res.json({ daily, byPlatform, byDayOfWeek });
});

export default router;
