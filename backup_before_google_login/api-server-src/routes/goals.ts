import { Router } from "express";
import { db, goalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).limit(1);
  res.json({ daily: goal?.daily ?? 0, weekly: goal?.weekly ?? 0, monthly: goal?.monthly ?? 0 });
});

router.put("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { daily, weekly, monthly } = req.body;

  const existing = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(goalsTable)
      .set({ daily: daily ?? 0, weekly: weekly ?? 0, monthly: monthly ?? 0, updatedAt: new Date() })
      .where(eq(goalsTable.userId, userId))
      .returning();
    res.json({ daily: updated.daily, weekly: updated.weekly, monthly: updated.monthly });
  } else {
    const [created] = await db
      .insert(goalsTable)
      .values({ userId, daily: daily ?? 0, weekly: weekly ?? 0, monthly: monthly ?? 0 })
      .returning();
    res.json({ daily: created.daily, weekly: created.weekly, monthly: created.monthly });
  }
});

export default router;
