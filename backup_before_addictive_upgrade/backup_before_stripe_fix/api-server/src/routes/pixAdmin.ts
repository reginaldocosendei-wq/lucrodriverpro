import { Router } from "express";
import { db, usersTable, pixPaymentsTable } from "@workspace/db";
import { eq, desc, gte, and, ilike, or, sql } from "drizzle-orm";

const router = Router();

// ── requireAuth ────────────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

// ── requireAdmin ───────────────────────────────────────────────────────────────
async function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    res.status(403).json({ error: "Acesso negado: ADMIN_EMAIL não configurado" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  next();
}

// ── GET /api/admin/pix ─────────────────────────────────────────────────────────
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { filter = "all", search = "", page = "1" } = req.query as Record<string, string>;
    const limit  = 50;
    const offset = (parseInt(page) - 1) * limit;

    const now      = new Date();
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const conditions: any[] = [];

    if (filter === "pending")   conditions.push(eq(pixPaymentsTable.status, "pending"));
    if (filter === "confirmed") conditions.push(eq(pixPaymentsTable.status, "confirmed"));
    if (filter === "rejected")  conditions.push(eq(pixPaymentsTable.status, "rejected"));
    if (filter === "today")     conditions.push(gte(pixPaymentsTable.requestedAt, today));
    if (filter === "week")      conditions.push(gte(pixPaymentsTable.requestedAt, weekStart));

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(
        ilike(pixPaymentsTable.email, q),
        ilike(pixPaymentsTable.name,  q),
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id:          pixPaymentsTable.id,
        userId:      pixPaymentsTable.userId,
        email:       pixPaymentsTable.email,
        name:        pixPaymentsTable.name,
        amount:      pixPaymentsTable.amount,
        status:      pixPaymentsTable.status,
        requestedAt: pixPaymentsTable.requestedAt,
        confirmedAt: pixPaymentsTable.confirmedAt,
        rejectedAt:  pixPaymentsTable.rejectedAt,
        proofUrl:    pixPaymentsTable.proofUrl,
        notes:       pixPaymentsTable.notes,
        userPlan:    usersTable.plan,
        activatedAt: usersTable.activatedAt,
      })
      .from(pixPaymentsTable)
      .leftJoin(usersTable, eq(pixPaymentsTable.userId, usersTable.id))
      .where(where)
      .orderBy(desc(pixPaymentsTable.requestedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(pixPaymentsTable)
      .where(where);

    const pendingCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(pixPaymentsTable)
      .where(eq(pixPaymentsTable.status, "pending"));

    res.json({
      payments: rows,
      total:    Number(total),
      pending:  Number(pendingCount[0]?.count ?? 0),
    });
  } catch (err) {
    console.error("[ADMIN PIX] list error:", err);
    res.status(500).json({ error: "Erro ao listar pagamentos" });
  }
});

// ── POST /api/admin/pix/:id/confirm ───────────────────────────────────────────
// Only confirms payment receipt — does NOT activate PRO.
router.post("/:id/confirm", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [payment] = await db
      .select()
      .from(pixPaymentsTable)
      .where(eq(pixPaymentsTable.id, id))
      .limit(1);

    if (!payment) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }
    if (payment.status !== "pending") {
      res.status(409).json({ error: "Este pagamento já foi processado." });
      return;
    }

    await db
      .update(pixPaymentsTable)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(pixPaymentsTable.id, id));

    res.json({ message: "Pagamento confirmado." });
  } catch (err) {
    console.error("[ADMIN PIX] confirm error:", err);
    res.status(500).json({ error: "Não foi possível confirmar este pagamento." });
  }
});

// ── POST /api/admin/pix/:id/activate-pro ──────────────────────────────────────
// Activates PRO for the user linked to this PIX payment.
router.post("/:id/activate-pro", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [payment] = await db
      .select()
      .from(pixPaymentsTable)
      .where(eq(pixPaymentsTable.id, id))
      .limit(1);

    if (!payment) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }
    if (payment.status === "rejected") {
      res.status(409).json({ error: "Não é possível ativar um pagamento recusado." });
      return;
    }
    if (!payment.userId) {
      res.status(422).json({ error: "Nenhum usuário vinculado a este pagamento." });
      return;
    }

    const now = new Date();

    // Confirm payment if still pending, then activate PRO
    if (payment.status === "pending") {
      await db
        .update(pixPaymentsTable)
        .set({ status: "confirmed", confirmedAt: now })
        .where(eq(pixPaymentsTable.id, id));
    }

    await db
      .update(usersTable)
      .set({ plan: "pro", trialStartDate: null, activatedAt: now })
      .where(eq(usersTable.id, payment.userId));

    res.json({ message: "Acesso PRO ativado com sucesso." });
  } catch (err) {
    console.error("[ADMIN PIX] activate-pro error:", err);
    res.status(500).json({ error: "Não foi possível ativar o acesso PRO." });
  }
});

// ── POST /api/admin/pix/:id/reject ────────────────────────────────────────────
router.post("/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [payment] = await db
      .select()
      .from(pixPaymentsTable)
      .where(eq(pixPaymentsTable.id, id))
      .limit(1);

    if (!payment) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }

    await db
      .update(pixPaymentsTable)
      .set({ status: "rejected", rejectedAt: new Date() })
      .where(eq(pixPaymentsTable.id, id));

    res.json({ message: "Pagamento recusado." });
  } catch (err) {
    console.error("[ADMIN PIX] reject error:", err);
    res.status(500).json({ error: "Erro ao recusar pagamento" });
  }
});

// ── DELETE /api/admin/pix/:id ─────────────────────────────────────────────────
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(pixPaymentsTable).where(eq(pixPaymentsTable.id, id));
    res.json({ message: "Registro excluído." });
  } catch (err) {
    console.error("[ADMIN PIX] delete error:", err);
    res.status(500).json({ error: "Erro ao excluir registro" });
  }
});

export default router;
