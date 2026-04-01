import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/preferences — return current user's preferences
router.get("/", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  try {
    const [user] = await db
      .select({ saveModeReplace: usersTable.saveModeReplace })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    res.json({ saveModeReplace: user.saveModeReplace ?? false });
  } catch (err) {
    console.error("GET preferences error:", err);
    res.status(500).json({ error: "Erro ao buscar preferências" });
  }
});

// PATCH /api/preferences — update user preferences
router.patch("/", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  const { saveModeReplace } = req.body;
  if (typeof saveModeReplace !== "boolean") {
    return res.status(400).json({ error: "saveModeReplace deve ser boolean" });
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ saveModeReplace })
      .where(eq(usersTable.id, userId))
      .returning({ saveModeReplace: usersTable.saveModeReplace });

    res.json({ saveModeReplace: updated.saveModeReplace });
  } catch (err) {
    console.error("PATCH preferences error:", err);
    res.status(500).json({ error: "Erro ao salvar preferências" });
  }
});

export default router;
