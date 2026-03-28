import { Router } from "express";
import { db, dailySummariesTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

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
    // 1. Fetch real daily summaries
    const summaries = await db
      .select()
      .from(dailySummariesTable)
      .where(eq(dailySummariesTable.userId, userId))
      .orderBy(desc(dailySummariesTable.date));

    // Dates already covered by a real summary (no need to add rides for these)
    const coveredDates = new Set(summaries.map((s) => s.date));

    // 2. Aggregate rides by calendar date for any dates not already covered
    const ridesAgg = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD')          AS date,
        ROUND(SUM(value)::numeric, 2)               AS earnings,
        COUNT(*)::int                               AS trips,
        NULLIF(ROUND(SUM(distance_km)::numeric, 2), 0)  AS km_driven,
        NULLIF(ROUND((SUM(duration_minutes) / 60.0)::numeric, 2), 0) AS hours_worked,
        ROUND(AVG(passenger_rating)::numeric, 2)   AS rating,
        MAX(platform)                               AS platform
      FROM rides
      WHERE user_id = ${userId}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY date DESC
    `);

    // 3. Build synthetic entries for uncovered dates
    const ridesEntries = (ridesAgg.rows as any[])
      .filter((r) => !coveredDates.has(r.date))
      .map((r) => ({
        id: null,
        source: "rides" as const,
        date: r.date,
        earnings: parseFloat(r.earnings),
        trips: parseInt(r.trips),
        kmDriven: r.km_driven ? parseFloat(r.km_driven) : null,
        hoursWorked: r.hours_worked ? parseFloat(r.hours_worked) : null,
        rating: r.rating ? parseFloat(r.rating) : null,
        platform: r.platform || null,
        notes: null,
      }));

    // 4. Tag real summaries with their source
    const summaryEntries = summaries.map((s) => ({ ...s, source: "summary" as const }));

    // 5. Merge and sort newest first
    const all = [...summaryEntries, ...ridesEntries].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    res.json(all);
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

    const newEarnings   = parseFloat(earnings);
    const newTrips      = parseInt(trips);
    const newKm         = kmDriven    != null ? parseFloat(kmDriven)    : null;
    const newHours      = hoursWorked != null ? parseFloat(hoursWorked) : null;
    const newRating     = rating      != null ? parseFloat(rating)      : null;
    const newPlatform   = platform || null;
    const newNotes      = notes    || null;

    let result;
    let merged = false;

    if (existing.length > 0) {
      const prev = existing[0];

      const mergedPayload = {
        earnings:    prev.earnings    + newEarnings,
        trips:       prev.trips       + newTrips,
        platform:    newPlatform ?? prev.platform,
        notes:       newNotes    ?? prev.notes,
        kmDriven:    (prev.kmDriven    != null || newKm    != null) ? (prev.kmDriven    ?? 0) + (newKm    ?? 0) : null,
        hoursWorked: (prev.hoursWorked != null || newHours != null) ? (prev.hoursWorked ?? 0) + (newHours ?? 0) : null,
        rating:      newRating ?? prev.rating,
        updatedAt:   new Date(),
      };

      result = await db
        .update(dailySummariesTable)
        .set(mergedPayload)
        .where(eq(dailySummariesTable.id, prev.id))
        .returning();
      merged = true;
    } else {
      result = await db.insert(dailySummariesTable).values({
        userId, date,
        earnings: newEarnings, trips: newTrips,
        kmDriven: newKm, hoursWorked: newHours,
        rating: newRating, platform: newPlatform, notes: newNotes,
      }).returning();
    }

    res.status(201).json({ ...result[0], merged });
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
