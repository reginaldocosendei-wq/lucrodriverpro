import { Router } from "express";
import { db, dailySummariesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

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
  try {
    const summaries = await db
      .select()
      .from(dailySummariesTable)
      .where(eq(dailySummariesTable.userId, userId))
      .orderBy(desc(dailySummariesTable.date));
    res.json(summaries);
  } catch (err) {
    console.error("List daily summaries error:", err);
    res.status(500).json({ error: "Erro ao buscar resumos" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { date, earnings, trips, kmDriven, hoursWorked, rating, platform, notes } = req.body;

  if (!date || !earnings || !trips) {
    res.status(400).json({ error: "Data, ganhos e corridas são obrigatórios" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(dailySummariesTable)
      .where(and(eq(dailySummariesTable.userId, userId), eq(dailySummariesTable.date, date)))
      .limit(1);

    const payload = {
      userId,
      date,
      earnings: parseFloat(earnings),
      trips: parseInt(trips),
      kmDriven: kmDriven != null ? parseFloat(kmDriven) : null,
      hoursWorked: hoursWorked != null ? parseFloat(hoursWorked) : null,
      rating: rating != null ? parseFloat(rating) : null,
      platform: platform || null,
      notes: notes || null,
    };

    let result;
    if (existing.length > 0) {
      result = await db
        .update(dailySummariesTable)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(dailySummariesTable.id, existing[0].id))
        .returning();
    } else {
      result = await db.insert(dailySummariesTable).values(payload).returning();
    }

    res.status(201).json(result[0]);
  } catch (err) {
    console.error("Create daily summary error:", err);
    res.status(500).json({ error: "Erro ao salvar resumo" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id);
  const { earnings, trips, kmDriven, hoursWorked, rating, platform, notes } = req.body;

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(dailySummariesTable)
      .where(and(eq(dailySummariesTable.id, id), eq(dailySummariesTable.userId, userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Resumo não encontrado" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (earnings != null) updates.earnings = parseFloat(earnings);
    if (trips != null) updates.trips = parseInt(trips);
    if (kmDriven != null) updates.kmDriven = parseFloat(kmDriven);
    if (hoursWorked != null) updates.hoursWorked = parseFloat(hoursWorked);
    if (rating != null) updates.rating = parseFloat(rating);
    if (platform != null) updates.platform = platform;
    if (notes != null) updates.notes = notes;

    const [updated] = await db
      .update(dailySummariesTable)
      .set(updates)
      .where(eq(dailySummariesTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("Update daily summary error:", err);
    res.status(500).json({ error: "Erro ao atualizar resumo" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(dailySummariesTable)
      .where(and(eq(dailySummariesTable.id, id), eq(dailySummariesTable.userId, userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Resumo não encontrado" });
      return;
    }

    await db.delete(dailySummariesTable).where(eq(dailySummariesTable.id, id));
    res.json({ message: "Resumo removido com sucesso" });
  } catch (err) {
    console.error("Delete daily summary error:", err);
    res.status(500).json({ error: "Erro ao remover resumo" });
  }
});

export default router;
