import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeEffectivePlan, syncStripeStatusForUser, TRIAL_MS } from "../lib/planSync";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

function userResponse(user: typeof usersTable.$inferSelect) {
  const effective = computeEffectivePlan(user);
  return {
    id:            user.id,
    name:          user.name,
    email:         user.email,
    plan:          effective.plan,
    planSource:    effective.planSource,
    trialActive:   effective.trialActive,
    trialExpired:  effective.trialExpired,
    trialDaysLeft: effective.trialDaysLeft,
    trialEndDate:  effective.trialEndDate,
    createdAt:     user.createdAt,
  };
}

// Wait for the session to be fully persisted in PostgreSQL BEFORE sending the
// response. Without this, the browser fires GET /api/auth/me immediately after
// the login 200, and that request can arrive at the server BEFORE the session
// row is written — causing a spurious 401 and the login redirect loop.
function saveSession(req: Parameters<Router>[0]): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

const router = Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  console.log(`[auth/register] attempt — email: ${email} name: ${name ? "set" : "missing"}`);
  if (!name || !email || !password) {
    console.log(`[auth/register] missing fields — name:${!!name} email:${!!email} password:${!!password}`);
    res.status(400).json({ error: "Todos os campos são obrigatórios" });
    return;
  }
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      console.log(`[auth/register] email already exists: ${email}`);
      res.status(400).json({ error: "Email já cadastrado" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ name, email, passwordHash, plan: "free" })
      .returning();
    console.log(`[auth/register] user created — userId: ${user.id}`);
    req.session.userId = user.id;
    await saveSession(req);
    console.log(`[auth/register] session saved — userId: ${user.id}`);
    res.status(201).json({ user: userResponse(user), message: "Cadastro realizado com sucesso" });
  } catch (err: any) {
    console.error("[auth/register] ERROR:", err.message, err.stack?.split("\n")[1] ?? "");
    res.status(500).json({ error: "Erro interno ao criar conta. Tente novamente." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(`[auth/login] attempt — email: ${email}`);
  if (!email || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }
  try {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      console.log(`[auth/login] user not found: ${email}`);
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.log(`[auth/login] invalid password for: ${email}`);
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }

    user = await syncStripeStatusForUser(user);

    req.session.userId = user.id;
    await saveSession(req);
    console.log(`[auth/login] success — userId: ${user.id} sessionId: ${req.sessionID}`);
    res.json({ user: userResponse(user), message: "Login realizado com sucesso" });
  } catch (err: any) {
    console.error("[auth/login] ERROR:", err.message, err.stack?.split("\n")[1] ?? "");
    res.status(500).json({ error: "Erro interno ao fazer login. Tente novamente." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logout realizado com sucesso" });
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  let [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  user = await syncStripeStatusForUser(user);

  const effective = computeEffectivePlan(user);
  console.log(`[auth/me] userId=${user.id} plan=${effective.plan} planSource=${effective.planSource} trialActive=${effective.trialActive}`);

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
  const effective   = computeEffectivePlan(updatedUser);

  res.json({
    message:       "Seu teste gratuito de 7 dias foi ativado! Aproveite os recursos PRO.",
    plan:          effective.plan,
    planSource:    effective.planSource,
    trialActive:   effective.trialActive,
    trialExpired:  effective.trialExpired,
    trialDaysLeft: effective.trialDaysLeft,
    trialEndDate:  effective.trialEndDate,
  });
});

export default router;
