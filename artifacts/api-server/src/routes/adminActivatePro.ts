/**
 * POST /api/admin/activate-pro
 *
 * Manually activates PRO for a user identified by email.
 * Protection: active session + x-admin-secret header must match ADMIN_SECRET env var.
 */

import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  // Must be authenticated
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  // Check x-admin-secret header
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: "ADMIN_SECRET não configurado no servidor" });
    return;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Campo email obrigatório" });
    return;
  }

  const normalised = email.trim().toLowerCase();

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalised))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: `Usuário não encontrado: ${normalised}` });
      return;
    }

    await db
      .update(usersTable)
      .set({ plan: "pro", trialStartDate: null })
      .where(eq(usersTable.id, user.id));

    console.log(`[AdminActivate] PRO activated for ${user.email} by session userId=${req.userId}`);

    res.json({ success: true, message: `PRO ativado para ${user.email}` });
  } catch (err: any) {
    console.error("[AdminActivate] error:", err?.message ?? err);
    res.status(500).json({ error: "Erro interno ao ativar PRO" });
  }
});

export default router;
