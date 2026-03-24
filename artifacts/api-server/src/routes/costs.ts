import { Router } from "express";
import { db, costsTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";

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

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const costs = await db
    .select()
    .from(costsTable)
    .where(eq(costsTable.userId, userId))
    .orderBy(desc(costsTable.date));

  const today = getDateString(0);
  const weekAgo = getDateString(7);
  const monthAgo = getDateString(30);

  const totalDay = costs.filter((c) => c.date >= today).reduce((s, c) => s + c.amount, 0);
  const totalWeek = costs.filter((c) => c.date >= weekAgo).reduce((s, c) => s + c.amount, 0);
  const totalMonth = costs.filter((c) => c.date >= monthAgo).reduce((s, c) => s + c.amount, 0);

  res.json({ costs, totalDay, totalWeek, totalMonth });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { category, amount, description, date } = req.body;

  if (!category || !amount || !date) {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
    return;
  }

  const [cost] = await db
    .insert(costsTable)
    .values({ userId, category, amount, description: description || "", date })
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
