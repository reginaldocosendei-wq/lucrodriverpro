import { Router } from "express";
import { db, usersTable, pixPaymentsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { computeEffectivePlan, TRIAL_MS } from "../lib/planSync";

const router = Router();

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
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (!user || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  next();
}

function enrichUser(user: typeof usersTable.$inferSelect) {
  const ep = computeEffectivePlan(user);
  return {
    id:               user.id,
    name:             user.name,
    email:            user.email,
    plan:             ep.plan,
    planSource:       ep.planSource,
    trialActive:      ep.trialActive,
    trialExpired:     ep.trialExpired,
    trialDaysLeft:    ep.trialDaysLeft,
    trialEndDate:     ep.trialEndDate,
    trialStartDate:   user.trialStartDate,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubId:      user.stripeSubscriptionId,
    createdAt:        user.createdAt,
  };
}

// ── GET /api/admin/users/stats ─────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const allUsers = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

    const now = Date.now();
    let totalPro    = 0;
    let totalTrial  = 0;
    let totalFree   = 0;

    for (const u of allUsers) {
      const ep = computeEffectivePlan(u);
      if (ep.plan === "pro" && !ep.trialActive) totalPro++;
      else if (ep.trialActive)                  totalTrial++;
      else                                      totalFree++;
    }

    const [pixRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(pixPaymentsTable)
      .where(eq(pixPaymentsTable.status, "pending"));

    res.json({
      total:      allUsers.length,
      totalPro,
      totalTrial,
      totalFree,
      pendingPix: Number(pixRow?.count ?? 0),
    });
  } catch (err) {
    console.error("[AdminUsers] stats error:", err);
    res.status(500).json({ error: "Erro ao carregar estatísticas" });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────────
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { filter = "all", search = "", page = "1" } = req.query as Record<string, string>;
    const limit  = 40;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const allUsers = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    // Enrich all with effective plan, then filter in JS (avoids complex SQL for computed fields)
    let enriched = allUsers.map(enrichUser);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      enriched = enriched.filter(
        (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
      );
    }

    if (filter === "pro")   enriched = enriched.filter((u) => u.plan === "pro" && !u.trialActive);
    if (filter === "trial") enriched = enriched.filter((u) => u.trialActive);
    if (filter === "free")  enriched = enriched.filter((u) => u.plan === "free" && !u.trialActive);

    const total = enriched.length;
    const users = enriched.slice(offset, offset + limit);

    res.json({ users, total });
  } catch (err) {
    console.error("[AdminUsers] list error:", err);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

// ── POST /api/admin/users/:id/activate-pro ────────────────────────────────────
router.post("/:id/activate-pro", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    await db.update(usersTable)
      .set({ plan: "pro", trialStartDate: null })
      .where(eq(usersTable.id, id));

    res.json({ message: `Acesso PRO ativado para ${user.email}` });
  } catch (err) {
    console.error("[AdminUsers] activate-pro error:", err);
    res.status(500).json({ error: "Erro ao ativar PRO" });
  }
});

// ── POST /api/admin/users/:id/remove-pro ─────────────────────────────────────
router.post("/:id/remove-pro", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    await db.update(usersTable)
      .set({ plan: "free", trialStartDate: null, stripeSubscriptionId: null })
      .where(eq(usersTable.id, id));

    res.json({ message: `Acesso PRO removido de ${user.email}` });
  } catch (err) {
    console.error("[AdminUsers] remove-pro error:", err);
    res.status(500).json({ error: "Erro ao remover PRO" });
  }
});

// ── POST /api/admin/users/:id/start-trial ─────────────────────────────────────
router.post("/:id/start-trial", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    if (user.plan === "pro" && !user.trialStartDate) {
      res.status(400).json({ error: "Usuário já possui PRO ativo" });
      return;
    }

    await db.update(usersTable)
      .set({ plan: "free", trialStartDate: new Date() })
      .where(eq(usersTable.id, id));

    res.json({ message: `Trial de 7 dias iniciado para ${user.email}` });
  } catch (err) {
    console.error("[AdminUsers] start-trial error:", err);
    res.status(500).json({ error: "Erro ao iniciar trial" });
  }
});

// ── POST /api/admin/users/:id/end-trial ──────────────────────────────────────
router.post("/:id/end-trial", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    if (!user.trialStartDate) {
      res.status(400).json({ error: "Usuário não possui trial ativo" });
      return;
    }

    // Set trialStartDate to 8 days ago so computeEffectivePlan sees it as expired
    const expired = new Date(Date.now() - TRIAL_MS - 1000);
    await db.update(usersTable)
      .set({ plan: "free", trialStartDate: expired })
      .where(eq(usersTable.id, id));

    res.json({ message: `Trial encerrado para ${user.email}` });
  } catch (err) {
    console.error("[AdminUsers] end-trial error:", err);
    res.status(500).json({ error: "Erro ao encerrar trial" });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const adminEmail = process.env.ADMIN_EMAIL!;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    if (user.email.toLowerCase() === adminEmail.toLowerCase()) {
      res.status(400).json({ error: "Não é possível excluir o administrador" });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ message: `Usuário ${user.email} excluído` });
  } catch (err) {
    console.error("[AdminUsers] delete error:", err);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

export default router;
