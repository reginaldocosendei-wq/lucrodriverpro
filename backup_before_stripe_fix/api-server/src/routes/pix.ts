import { Router } from "express";
import { db, usersTable, pixPaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

// ── POST /api/pix/request ──────────────────────────────────────────────────────
// Records a PIX payment intent. Accepts optional proofData (base64 data URL).
router.post("/request", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { proofData } = req.body ?? {};

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    // Validate base64 data URL if present (must be image, max ~5 MB uncompressed)
    if (proofData !== undefined && proofData !== null) {
      if (typeof proofData !== "string" || !proofData.startsWith("data:image/")) {
        res.status(400).json({ error: "Comprovante inválido" });
        return;
      }
      const approxBytes = Math.ceil((proofData.length * 3) / 4);
      if (approxBytes > 5 * 1024 * 1024) {
        res.status(400).json({ error: "Comprovante muito grande (máx 5 MB)" });
        return;
      }
    }

    const [record] = await db
      .insert(pixPaymentsTable)
      .values({
        userId:   user.id,
        email:    user.email,
        name:     user.name,
        amount:   "19.90",
        status:   "pending",
        proofUrl: proofData ?? null,
      })
      .returning();

    res.status(201).json({ id: record.id, message: "Solicitação PIX registrada" });
  } catch (err) {
    console.error("[PIX] request error:", err);
    res.status(500).json({ error: "Erro ao registrar solicitação PIX" });
  }
});

export default router;
