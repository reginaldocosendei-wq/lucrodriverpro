import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

function computeEffectivePlan(user: typeof usersTable.$inferSelect): {
  plan: "free" | "pro";
  trialActive: boolean;
  trialExpired: boolean;
  trialDaysLeft: number;
  trialEndDate: string | null;
} {
  const hasPaidPlan = user.plan === "pro" && !user.trialStartDate;
  if (hasPaidPlan) {
    return { plan: "pro", trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndDate: null };
  }

  if (user.trialStartDate) {
    const start = new Date(user.trialStartDate).getTime();
    const end = start + TRIAL_MS;
    const elapsed = Date.now() - start;
    const endDate = new Date(end).toISOString();

    if (elapsed < TRIAL_MS) {
      const daysLeft = Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000));
      return { plan: "pro", trialActive: true, trialExpired: false, trialDaysLeft: daysLeft, trialEndDate: endDate };
    }

    return { plan: "free", trialActive: false, trialExpired: true, trialDaysLeft: 0, trialEndDate: endDate };
  }

  if (user.plan === "pro") {
    return { plan: "pro", trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndDate: null };
  }

  return { plan: "free", trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndDate: null };
}

function userResponse(user: typeof usersTable.$inferSelect) {
  const effective = computeEffectivePlan(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: effective.plan,
    trialActive: effective.trialActive,
    trialExpired: effective.trialExpired,
    trialDaysLeft: effective.trialDaysLeft,
    trialEndDate: effective.trialEndDate,
    createdAt: user.createdAt,
  };
}

const router = Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "Todos os campos são obrigatórios" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email já cadastrado" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash, plan: "free" })
    .returning();
  req.session.userId = user.id;
  res.status(201).json({ user: userResponse(user), message: "Cadastro realizado com sucesso" });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Email ou senha incorretos" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou senha incorretos" });
    return;
  }
  req.session.userId = user.id;
  res.json({ user: userResponse(user), message: "Login realizado com sucesso" });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ message: "Logout realizado com sucesso" });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json(userResponse(user));
});

router.post("/trial/start", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  if (user.plan === "pro" && !user.trialStartDate) {
    res.status(400).json({ error: "Você já tem uma assinatura PRO ativa." });
    return;
  }

  if (user.trialStartDate) {
    const elapsed = Date.now() - new Date(user.trialStartDate).getTime();
    if (elapsed < TRIAL_MS) {
      res.status(400).json({ error: "Você já tem um período de teste ativo." });
      return;
    }
    res.status(400).json({ error: "Seu período de teste gratuito já foi utilizado. Faça upgrade para continuar." });
    return;
  }

  const now = new Date();
  await db.update(usersTable).set({ trialStartDate: now }).where(eq(usersTable.id, user.id));

  const updatedUser = { ...user, trialStartDate: now };
  const effective = computeEffectivePlan(updatedUser);

  res.json({
    message: "Seu teste gratuito de 7 dias foi ativado! Aproveite os recursos PRO.",
    plan: effective.plan,
    trialActive: effective.trialActive,
    trialExpired: effective.trialExpired,
    trialDaysLeft: effective.trialDaysLeft,
    trialEndDate: effective.trialEndDate,
  });
});

export default router;
