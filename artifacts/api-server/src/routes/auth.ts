import { Router } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { computeEffectivePlan, syncStripeStatusForUser, TRIAL_MS } from "../lib/planSync";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

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

// Regenerate the session ID and persist it before sending the response.
//
// Why regenerate (not just save)?
//   express-session only sends Set-Cookie ONCE — when the session is first
//   created (with rolling:false). If a browser has an old session cookie that
//   was set before a SameSite attribute change (e.g. None → Lax), that cookie's
//   attributes are never updated, so the browser may reject or ignore it.
//   Calling regenerate() destroys the old session, creates a brand-new ID, and
//   forces express-session to send a fresh Set-Cookie with current attributes
//   (SameSite=Lax in production). This fixes "stuck" old-cookie browsers.
//
// Security bonus: prevents session fixation attacks.
function regenerateAndSave(req: Parameters<Router>[0], userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

const router = Router();

router.post("/register", async (req, res) => {
  const rawEmail    = req.body.email    ?? "";
  const rawName     = req.body.name     ?? "";
  const rawPassword = req.body.password ?? "";

  const email    = normalizeEmail(rawEmail);
  const name     = rawName.trim();
  const password = rawPassword;

  console.log(`[auth/register] attempt — email: ${email} name: ${name ? "set" : "missing"}`);

  if (!name || !email || !password) {
    console.log(`[auth/register] missing fields — name:${!!name} email:${!!email} password:${!!password}`);
    res.status(400).json({ error: "Todos os campos são obrigatórios" });
    return;
  }

  try {
    // Case-insensitive duplicate check — catches "User@gmail.com" vs "user@gmail.com"
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${email}`)
      .limit(1);

    if (existing.length > 0) {
      console.log(`[auth/register] email already exists (case-insensitive): ${email}`);
      res.status(400).json({ error: "Email já cadastrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ name, email, passwordHash, plan: "free" })
      .returning();

    console.log(`[auth/register] user created — userId: ${user.id} email: ${email}`);
    await regenerateAndSave(req, user.id);
    const token = signToken(user.id);
    console.log(`[auth/register] session regenerated — userId: ${user.id} newSessionId: ${req.sessionID} token=issued`);
    res.status(201).json({ user: userResponse(user), token, message: "Cadastro realizado com sucesso" });
  } catch (err: any) {
    console.error("[auth/register] ERROR:", err.message, err.stack?.split("\n")[1] ?? "");
    res.status(500).json({ error: "Erro interno ao criar conta. Tente novamente." });
  }
});

router.post("/login", async (req, res) => {
  const rawEmail    = req.body.email    ?? "";
  const rawPassword = req.body.password ?? "";

  const email    = normalizeEmail(rawEmail);
  const password = rawPassword;

  console.log(`[auth/login] attempt — email: ${email}`);

  if (!email || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }

  try {
    // Case-insensitive lookup — handles users who registered with mixed-case email
    let [user] = await db.select().from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${email}`)
      .limit(1);

    console.log(`[auth/login] user found: ${!!user}`);

    if (!user) {
      console.log(`[auth/login] user not found for email: ${email}`);
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }

    // Google-only account — no password is set
    if (user.passwordHash === "GOOGLE_OAUTH_NO_PASSWORD") {
      console.log(`[auth/login] Google-only account, password login rejected — userId: ${user.id}`);
      res.status(401).json({ error: "Esta conta usa o login com Google. Use o botão 'Continuar com Google'." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log(`[auth/login] password match: ${valid}`);

    if (!valid) {
      console.log(`[auth/login] invalid password for userId: ${user.id}`);
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }

    // Silently repair stored email to normalized form if it differs
    // (fixes existing accounts that were registered with mixed-case or spaces)
    if (user.email !== email) {
      console.log(`[auth/login] repairing email case for userId: ${user.id} — stored: "${user.email}" → normalized: "${email}"`);
      await db.update(usersTable).set({ email }).where(eq(usersTable.id, user.id));
      user = { ...user, email };
    }

    user = await syncStripeStatusForUser(user);

    await regenerateAndSave(req, user.id);
    const token = signToken(user.id);
    console.log(`[auth/login] success — userId: ${user.id} newSessionId: ${req.sessionID} token=issued`);
    res.json({ user: userResponse(user), token, message: "Login realizado com sucesso" });
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

// ── POST /auth/google ──────────────────────────────────────────────────────────
// Receives a Google ID token from the frontend, verifies it, then finds or
// creates the user and sets the session — identical outcome to /auth/login.
//
// User lookup order:
//   1. By googleId                    — returning Google user
//   2. By email (case-insensitive)    — links an existing email/password account
//   3. Not found                      — create new account
router.post("/google", async (req, res) => {
  const { credential } = req.body ?? {};

  if (!credential || typeof credential !== "string") {
    res.status(400).json({ error: "Token do Google ausente ou inválido" });
    return;
  }

  if (!googleClient) {
    console.error("[auth/google] GOOGLE_CLIENT_ID not configured");
    res.status(503).json({ error: "Login com Google não configurado no servidor" });
    return;
  }

  try {
    // Verify the ID token signature and claims
    const ticket = await googleClient.verifyIdToken({
      idToken:  credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({ error: "Token do Google inválido" });
      return;
    }

    const googleId = payload.sub;
    const email    = normalizeEmail(payload.email ?? "");
    const name     = (payload.name ?? payload.email ?? "Usuário").trim();

    if (!email) {
      res.status(400).json({ error: "Email não disponível na conta Google" });
      return;
    }

    console.log(`[auth/google] verified — googleId=${googleId} email=${email}`);

    // ── 1. Find by googleId (fast path for returning users)
    let [user] = await db.select().from(usersTable)
      .where(eq(usersTable.googleId, googleId))
      .limit(1);

    if (user) {
      console.log(`[auth/google] found by googleId — userId=${user.id}`);
    }

    // ── 2. Find by email (links existing email/password account)
    if (!user) {
      const rows = await db.select().from(usersTable)
        .where(sql`lower(${usersTable.email}) = ${email}`)
        .limit(1);
      user = rows[0];

      if (user) {
        console.log(`[auth/google] found by email — userId=${user.id} — linking googleId`);
        // Link googleId so future logins hit the fast path
        await db.update(usersTable)
          .set({ googleId })
          .where(eq(usersTable.id, user.id));
        user = { ...user, googleId };
      }
    }

    // ── 3. Create new account
    if (!user) {
      console.log(`[auth/google] creating new user — email=${email}`);
      const [created] = await db.insert(usersTable).values({
        name,
        email,
        passwordHash: "GOOGLE_OAUTH_NO_PASSWORD",
        googleId,
        plan: "free",
      }).returning();
      user = created;
      console.log(`[auth/google] new user created — userId=${user.id}`);
    }

    user = await syncStripeStatusForUser(user);
    await regenerateAndSave(req, user.id);
    const token = signToken(user.id);
    console.log(`[auth/google] session regenerated — userId=${user.id} newSessionId=${req.sessionID} token=issued`);
    res.json({ user: userResponse(user), token, message: "Login realizado com sucesso" });
  } catch (err: any) {
    console.error("[auth/google] ERROR:", err.message);
    res.status(401).json({ error: "Falha na verificação do token Google. Tente novamente." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const uid = req.userId!;
  console.log(`[auth/me] loading user — userId=${uid}`);

  let [user] = await db.select().from(usersTable).where(eq(usersTable.id, uid)).limit(1);
  if (!user) {
    console.log(`[auth/me] user not found in DB — userId=${uid}`);
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  user = await syncStripeStatusForUser(user);
  const effective = computeEffectivePlan(user);
  console.log(`[auth/me] USER LOADED — userId=${user.id} plan=${effective.plan} planSource=${effective.planSource} trialActive=${effective.trialActive}`);

  res.json(userResponse(user));
});

router.post("/trial/start", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
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
