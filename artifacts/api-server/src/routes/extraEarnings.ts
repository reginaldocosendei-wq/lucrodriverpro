import { Router } from "express";
import { db, extraEarningsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

// GET /api/extra-earnings?date=YYYY-MM-DD
router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { date } = req.query;

  const entries = await db
    .select()
    .from(extraEarningsTable)
    .where(
      date
        ? and(eq(extraEarningsTable.userId, userId), eq(extraEarningsTable.date, date as string))
        : eq(extraEarningsTable.userId, userId)
    )
    .orderBy(desc(extraEarningsTable.createdAt));

  res.json(entries);
});

// POST /api/extra-earnings
router.post("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { date, type, amount, note } = req.body;

  if (!date || !type || amount === undefined || amount === null || amount === "") {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
    return;
  }

  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    res.status(400).json({ error: "Valor inválido" });
    return;
  }

  const [entry] = await db
    .insert(extraEarningsTable)
    .values({ userId, date, type, amount: parsed, note: note || "" })
    .returning();

  res.status(201).json(entry);
});

// PATCH /api/extra-earnings/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const { type, amount, note } = req.body;

  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    res.status(400).json({ error: "Valor inválido" });
    return;
  }

  const [entry] = await db
    .update(extraEarningsTable)
    .set({
      ...(type !== undefined && { type }),
      ...(amount !== undefined && { amount: parsed }),
      ...(note !== undefined && { note }),
    })
    .where(and(eq(extraEarningsTable.id, id), eq(extraEarningsTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }

  res.json(entry);
});

// DELETE /api/extra-earnings/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  await db
    .delete(extraEarningsTable)
    .where(and(eq(extraEarningsTable.id, id), eq(extraEarningsTable.userId, userId)));

  res.json({ ok: true });
});

export default router;
