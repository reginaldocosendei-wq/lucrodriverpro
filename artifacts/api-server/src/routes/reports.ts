import { Router } from "express";
import { db, ridesTable, costsTable } from "@workspace/db";
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

  const rides = await db.select().from(ridesTable).where(eq(ridesTable.userId, userId));
  const costs = await db.select().from(costsTable).where(eq(costsTable.userId, userId));

  const dailyMap: Record<string, { earnings: number; costs: number; rides: number }> = {};

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = { earnings: 0, costs: 0, rides: 0 };
  }

  for (const r of rides) {
    const key = r.createdAt.toISOString().split("T")[0];
    if (dailyMap[key]) {
      dailyMap[key].earnings += r.netValue;
      dailyMap[key].rides += 1;
    }
  }

  for (const c of costs) {
    if (dailyMap[c.date]) {
      dailyMap[c.date].costs += c.amount;
    }
  }

  const daily = Object.entries(dailyMap).map(([date, v]) => ({
    date,
    earnings: v.earnings,
    costs: v.costs,
    profit: v.earnings - v.costs,
    rides: v.rides,
  }));

  const platformMap: Record<string, { earnings: number; rides: number }> = {};
  for (const r of rides) {
    if (!platformMap[r.platform]) platformMap[r.platform] = { earnings: 0, rides: 0 };
    platformMap[r.platform].earnings += r.netValue;
    platformMap[r.platform].rides += 1;
  }
  const byPlatform = Object.entries(platformMap).map(([platform, v]) => ({
    platform,
    earnings: v.earnings,
    rides: v.rides,
  }));

  const dowMap: Record<number, { earnings: number; costs: number; rides: number }> = {};
  for (let i = 0; i < 7; i++) dowMap[i] = { earnings: 0, costs: 0, rides: 0 };
  for (const r of rides) {
    const dow = new Date(r.createdAt).getDay();
    dowMap[dow].earnings += r.netValue;
    dowMap[dow].rides += 1;
  }
  const byDayOfWeek = Object.entries(dowMap).map(([dow, v]) => ({
    date: DAY_NAMES[parseInt(dow)],
    earnings: v.earnings,
    costs: v.costs,
    profit: v.earnings - v.costs,
    rides: v.rides,
  }));

  res.json({ daily, byPlatform, byDayOfWeek });
});

export default router;
