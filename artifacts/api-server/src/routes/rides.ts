import { Router } from "express";
import { db, ridesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
  const limit = parseInt(req.query.limit as string) || 50;
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
  const { value, distanceKm, durationMinutes, platform, passengerRating, platformCommissionPct } = req.body;

  if (!value || !distanceKm || !durationMinutes || !platform) {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
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
      platformCommissionPct: platformCommissionPct ?? 25,
      netValue,
      valuePerKm,
      commissionAmount,
    })
    .returning();

  res.status(201).json(ride);
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
