import { Router } from "express";
import { db, ridesTable } from "@workspace/db";
import { eq, desc, and, gte, lt } from "drizzle-orm";

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

router.post("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const {
    value,
    distanceKm = 0,
    durationMinutes = 0,
    platform,
    passengerRating,
    platformCommissionPct = 25,
  } = req.body;

  if (!value || !platform) {
    res.status(400).json({ error: "Valor e plataforma são obrigatórios" });
    return;
  }

  const commissionAmount = value * (platformCommissionPct / 100);
  const netValue = value - commissionAmount;
  const valuePerKm = distanceKm > 0 ? netValue / distanceKm : 0;

  const [ride] = await db
    .insert(ridesTable)
    .values({
      userId,
      value,
      distanceKm,
      durationMinutes,
      platform,
      passengerRating: passengerRating ?? 5,
      platformCommissionPct,
      netValue,
      valuePerKm,
      commissionAmount,
    })
    .returning();

  res.status(201).json(ride);
});

router.post("/daily", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const {
    earnings,
    trips,
    platform = "uber",
    commissionPct = 25,
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

  const perRide = totalEarnings / totalTrips;
  const commissionAmount = totalEarnings * (commissionPct / 100);
  const netValue = totalEarnings - commissionAmount;
  const netPerRide = netValue / totalTrips;

  const ridesData = Array.from({ length: totalTrips }, () => ({
    userId,
    value: parseFloat(perRide.toFixed(2)),
    distanceKm: 0,
    durationMinutes: 0,
    platform,
    passengerRating: 5,
    platformCommissionPct: commissionPct,
    netValue: parseFloat(netPerRide.toFixed(2)),
    valuePerKm: 0,
    commissionAmount: parseFloat(((commissionAmount) / totalTrips).toFixed(2)),
  }));

  const inserted = await db.insert(ridesTable).values(ridesData).returning();

  res.status(201).json({
    message: "Resumo do dia registrado com sucesso",
    ridesCreated: inserted.length,
    totalEarnings,
    netValue,
    platform,
  });
});

router.delete("/day/:dateStr", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
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

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
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
