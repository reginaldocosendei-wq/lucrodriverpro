import { Router } from "express";
import { db, costsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { splitCosts } from "../lib/costSplit";

/** Normalise a date value from the PG driver to a plain "YYYY-MM-DD" string. */
function normDate(d: string | Date | unknown): string {
  if (d instanceof Date) return d.toISOString().split("T")[0];
  if (typeof d === "string") return d.split("T")[0];
  return String(d).split("T")[0];
}

const router = Router();

function getDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

router.get("/", async (req, res) => {
  const userId = req.userId!;

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
  // Use normDate() to safely coerce string-or-Date values from the PG driver.
  const safeSum = (arr: typeof variable) => arr.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0);
  const totalDay   = safeSum(variable.filter((c) => normDate(c.date) >= today));
  const totalWeek  = safeSum(variable.filter((c) => normDate(c.date) >= weekAgo));
  const totalMonth = safeSum(variable.filter((c) => normDate(c.date) >= monthAgo));

  // Fixed monthly totals — NOT date-filtered (recurring monthly amounts)
  const fixedMonthlyTotal   = safeSum(fixedMonthly);
  const dailyFixedCostQuota = fixedMonthlyTotal > 0 ? fixedMonthlyTotal / 30 : 0;

  // Month-to-date variable costs (for coverage display)
  const variableCostsThisMonth = safeSum(variable.filter((c) => normDate(c.date) >= monthStart));

  console.log("[costs] Costs loaded:", costs.length, "records");
  console.log("[costs] Total Costs today (variable):", totalDay);
  console.log("[costs] Fixed monthly total:", fixedMonthlyTotal, "| daily quota:", dailyFixedCostQuota.toFixed(2));

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

router.post("/", async (req, res) => {
  const userId = req.userId!;
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

router.delete("/:id", async (req, res) => {
  const userId = req.userId!;
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
