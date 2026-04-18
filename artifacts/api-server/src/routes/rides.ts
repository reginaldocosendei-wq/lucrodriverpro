import { Router } from "express";
import { db, ridesTable } from "@workspace/db";
import { eq, desc, and, gte, lt } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const userId = req.userId!;
  const limit = parseInt(req.query.limit as string) || 200;
  const offset = parseInt(req.query.offset as string) || 0;

  const rides = await db
    .select()
    .from(ridesTable)
    .where(eq(ridesTable.userId, userId))
    .orderBy(desc(ridesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const allRides = await db.select().from(ridesTable).where(eq(ridesTable.userId, userId));

  res.json({ rides, total: allRides.length });
});

router.post("/", async (req, res) => {
  const userId = req.userId!;
  const {
    value,
    distanceKm = 0,
    durationMinutes = 0,
    platform,
    passengerRating,
  } = req.body;

  if (!value || !platform) {
    res.status(400).json({ error: "Valor e plataforma são obrigatórios" });
    return;
  }

  const valuePerKm = distanceKm > 0 ? value / distanceKm : 0;

  const [ride] = await db
    .insert(ridesTable)
    .values({
      userId,
      value,
      distanceKm,
      durationMinutes,
      platform,
      passengerRating: passengerRating ?? 5,
      valuePerKm,
    })
    .returning();

  res.status(201).json(ride);
});

router.post("/daily", async (req, res) => {
  const userId = req.userId!;
  const {
    earnings,
    trips,
    platform = "uber",
  } = req.body;

  if (!earnings || !trips) {
    res.status(400).json({ error: "Ganhos e número de corridas são obrigatórios" });
    return;
  }

  const totalEarnings = parseFloat(earnings);
  const totalTrips = parseInt(trips);

  if (isNaN(totalEarnings) || totalEarnings <= 0) {
    res.status(400).json({ error: "Valor de ganhos inválido" });
    return;
  }
  if (isNaN(totalTrips) || totalTrips <= 0) {
    res.status(400).json({ error: "Número de corridas inválido" });
    return;
  }

  const perRide = parseFloat((totalEarnings / totalTrips).toFixed(2));

  const ridesData = Array.from({ length: totalTrips }, () => ({
    userId,
    value: perRide,
    distanceKm: 0,
    durationMinutes: 0,
    platform,
    passengerRating: 5,
    valuePerKm: 0,
  }));

  const inserted = await db.insert(ridesTable).values(ridesData).returning();

  res.status(201).json({
    message: "Resumo do dia registrado com sucesso",
    ridesCreated: inserted.length,
    totalEarnings,
    platform,
  });
});

router.delete("/day/:dateStr", async (req, res) => {
  const userId = req.userId!;
  const { dateStr } = req.params;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    res.status(400).json({ error: "Data inválida" });
    return;
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  await db
    .delete(ridesTable)
    .where(
      and(
        eq(ridesTable.userId, userId),
        gte(ridesTable.createdAt, dayStart),
        lt(ridesTable.createdAt, dayEnd)
      )
    );

  res.json({ message: "Registros do dia removidos" });
});

router.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id);

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id)).limit(1);
  if (!ride || ride.userId !== userId) {
    res.status(404).json({ error: "Corrida não encontrada" });
    return;
  }

  await db.delete(ridesTable).where(eq(ridesTable.id, id));
  res.json({ message: "Corrida deletada com sucesso" });
});

export default router;
