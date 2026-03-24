import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
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
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan, createdAt: user.createdAt },
    message: "Cadastro realizado com sucesso",
  });
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
  res.json({
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan, createdAt: user.createdAt },
    message: "Login realizado com sucesso",
  });
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
  res.json({ id: user.id, name: user.name, email: user.email, plan: user.plan, createdAt: user.createdAt });
});

export default router;
