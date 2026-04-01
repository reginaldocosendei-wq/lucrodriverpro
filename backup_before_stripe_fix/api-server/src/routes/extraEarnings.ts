import { Router } from "express";
import { db, extraEarningsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────
// Must stay in sync with EXTRA_EARNING_TYPES in useExtraEarnings.ts
const ALLOWED_TYPES = new Set([
  "cash_ride",
  "tip_pix",
  "tip_cash",
  "bonus",
  "adjustment",
  "other",
]);

const MAX_AMOUNT   = 50_000;  // R$ 50k sanity ceiling per entry
const MAX_NOTE_LEN = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

/** Returns true for a well-formed YYYY-MM-DD that is a real calendar date. */
function isValidDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

/** Parses amount and enforces >0 and ≤MAX_AMOUNT.  Returns null on failure. */
function parseAmount(raw: unknown): number | null {
  const n = parseFloat(raw as string);
  if (!isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return n;
}

function sanitizeNote(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_NOTE_LEN);
}

// ── GET /api/extra-earnings?date=YYYY-MM-DD ──────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { date } = req.query;

  if (date !== undefined && !isValidDate(date)) {
    res.status(400).json({ error: "Parâmetro de data inválido" });
    return;
  }

  const entries = await db
    .select()
    .from(extraEarningsTable)
    .where(
      date
        ? and(eq(extraEarningsTable.userId, userId), eq(extraEarningsTable.date, date as string))
        : eq(extraEarningsTable.userId, userId)
    )
    .orderBy(desc(extraEarningsTable.createdAt));

  res.json(entries);
});

// ── POST /api/extra-earnings ─────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { date, type, amount, note } = req.body;

  // Required fields present
  if (!date || !type || amount === undefined || amount === null || amount === "") {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
    return;
  }

  // Date must be a valid calendar date
  if (!isValidDate(date)) {
    res.status(400).json({ error: "Data inválida. Use o formato AAAA-MM-DD." });
    return;
  }

  // Type must be from the known list — no free-text types reach the DB
  if (!ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: "Tipo de ganho inválido" });
    return;
  }

  const parsed = parseAmount(amount);
  if (parsed === null) {
    res.status(400).json({
      error: `Valor inválido. Deve ser maior que R$ 0 e no máximo R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.`,
    });
    return;
  }

  const [entry] = await db
    .insert(extraEarningsTable)
    .values({
      userId,
      date,
      type,
      amount: parsed,
      note: sanitizeNote(note),
    })
    .returning();

  res.status(201).json(entry);
});

// ── PATCH /api/extra-earnings/:id ────────────────────────────────────────────
router.patch("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const { type, amount, note } = req.body;

  // At least one editable field must be present
  if (type === undefined && amount === undefined && note === undefined) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }

  // Validate type if provided
  if (type !== undefined && !ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: "Tipo de ganho inválido" });
    return;
  }

  // Validate amount if provided
  let parsed: number | undefined;
  if (amount !== undefined) {
    const p = parseAmount(amount);
    if (p === null) {
      res.status(400).json({
        error: `Valor inválido. Deve ser maior que R$ 0 e no máximo R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.`,
      });
      return;
    }
    parsed = p;
  }

  // Ownership is enforced by the WHERE clause (userId must match)
  const [entry] = await db
    .update(extraEarningsTable)
    .set({
      ...(type !== undefined   && { type }),
      ...(parsed !== undefined && { amount: parsed }),
      ...(note !== undefined   && { note: sanitizeNote(note) }),
    })
    .where(and(eq(extraEarningsTable.id, id), eq(extraEarningsTable.userId, userId)))
    .returning();

  if (!entry) {
    // Either not found or belongs to a different user — return 404 either way
    res.status(404).json({ error: "Não encontrado" });
    return;
  }

  res.json(entry);
});

// ── DELETE /api/extra-earnings/:id ───────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  // Ownership enforced by WHERE clause — a user can never delete another user's entry
  const deleted = await db
    .delete(extraEarningsTable)
    .where(and(eq(extraEarningsTable.id, id), eq(extraEarningsTable.userId, userId)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }

  res.json({ ok: true });
});

export default router;
