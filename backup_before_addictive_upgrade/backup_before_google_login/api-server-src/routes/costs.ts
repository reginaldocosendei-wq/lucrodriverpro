import { Router } from "express";
import { db, costsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { splitCosts } from "../lib/costSplit";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

function getDateString(daysAgo: number): string {
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

  const costs = await db
    .select()
    .from(costsTable)
    .where(eq(costsTable.userId, userId))
    .orderBy(desc(costsTable.date));

  const today    = getDateString(0);
  const weekAgo  = getDateString(7);
  const monthAgo = getDateString(30);
  const monthStart = startOfMonth();

  // ── Split by type — canonical split, no double-counting possible ──────────
  // splitCosts() asserts variable.length + fixed.length === costs.length at runtime.
  const { variable, fixed: fixedMonthly } = splitCosts(costs);

  // Variable totals (date-filtered — one-off daily expenses)
  const safeSum = (arr: typeof variable) => arr.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0);
  const totalDay   = safeSum(variable.filter((c) => c.date >= today));
  const totalWeek  = safeSum(variable.filter((c) => c.date >= weekAgo));
  const totalMonth = safeSum(variable.filter((c) => c.date >= monthAgo));

  // Fixed monthly totals — NOT date-filtered (recurring monthly amounts)
  const fixedMonthlyTotal   = safeSum(fixedMonthly);
  const dailyFixedCostQuota = fixedMonthlyTotal > 0 ? fixedMonthlyTotal / 30 : 0;

  // Month-to-date variable costs (for coverage display)
  const variableCostsThisMonth = safeSum(variable.filter((c) => c.date >= monthStart));

  res.json({
    costs,
    totalDay,
    totalWeek,
    totalMonth,
    fixedMonthlyTotal,
    dailyFixedCostQuota,
    variableCostsThisMonth,
  });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { category, amount, description, date, costType } = req.body;

  if (!category || !amount || !date) {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
    return;
  }

  const safeType = costType === "fixed_monthly" ? "fixed_monthly" : "variable";

  const [cost] = await db
    .insert(costsTable)
    .values({
      userId,
      category,
      amount,
      description: description || "",
      date,
      costType: safeType,
    })
    .returning();

  res.status(201).json(cost);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id);

  const [cost] = await db.select().from(costsTable).where(eq(costsTable.id, id)).limit(1);
  if (!cost || cost.userId !== userId) {
    res.status(404).json({ error: "Custo não encontrado" });
    return;
  }

  await db.delete(costsTable).where(eq(costsTable.id, id));
  res.json({ message: "Custo deletado com sucesso" });
});

export default router;
