/**
 * costSplit.ts — Single source of truth for classifying cost records.
 *
 * DOUBLE-COUNTING GUARANTEE
 * ─────────────────────────
 * Every cost record belongs to exactly one bucket:
 *   • variable  — one-off daily expense (fuel, food, toll, wash …)
 *   • fixed     — recurring monthly cost (car rental, insurance, tracker …)
 *
 * Rules enforced here:
 *   1. `variable` costs are date-filtered when used in daily/weekly/monthly totals.
 *   2. `fixed` costs are summed WITHOUT a date filter — their `amount` is a monthly
 *      figure that is then divided by 30 for a daily quota.
 *   3. A record CANNOT appear in both arrays (the predicate is a strict partition).
 *   4. Legacy records with no `costType` value default to "variable" — they are
 *      treated identically to records explicitly marked "variable".
 *   5. A runtime assertion verifies that variable.length + fixed.length === total,
 *      catching any future bug that might skip or duplicate records.
 *
 * DATE SAFETY NOTE
 * ────────────────
 * PostgreSQL `date` columns may be returned as a JavaScript `Date` object by the
 * node-pg driver before drizzle-orm applies its parser.  To prevent silent failures
 * from `Date >= string` comparisons (which evaluate to `NaN >= NaN = false`),
 * `normDateStr()` always coerces the value to an ISO "YYYY-MM-DD" string.
 */

export interface CostLike {
  id: number;
  costType?: string | null;
  amount: number;
  date: string | Date;       // accepts both — normalised internally
  [key: string]: unknown;
}

/**
 * Safely normalise whatever the DB driver gives us for a `date` column to a
 * plain "YYYY-MM-DD" string so lexicographic comparisons are always reliable.
 */
function normDateStr(d: string | Date | unknown): string {
  if (d instanceof Date) return d.toISOString().split("T")[0];
  if (typeof d === "string") {
    // Already an ISO string — may include time part if the driver returns TIMESTAMP
    return d.split("T")[0];
  }
  // Unexpected type — stringify and take the first 10 chars as a best-effort fallback
  return String(d).split("T")[0];
}

/** Returns true only for records explicitly marked as fixed_monthly. */
export function isFixedMonthlyCost(c: CostLike): boolean {
  const t = c.costType ?? "variable";
  return t === "fixed_monthly";
}

export interface CostSplit<T extends CostLike> {
  variable: T[];
  fixed: T[];
}

/**
 * Split a flat array of cost records into two mutually-exclusive, collectively-
 * exhaustive arrays.  Throws (dev) / warns (prod) if the assertion fails.
 */
export function splitCosts<T extends CostLike>(costs: T[]): CostSplit<T> {
  const variable: T[] = [];
  const fixed: T[]    = [];

  for (const c of costs) {
    if (isFixedMonthlyCost(c)) {
      fixed.push(c);
    } else {
      variable.push(c);
    }
  }

  // ── Runtime assertion: every record ends up in exactly one bucket ──────────
  if (variable.length + fixed.length !== costs.length) {
    const msg = `[costSplit] ASSERTION FAILED: variable(${variable.length}) + fixed(${fixed.length}) ≠ total(${costs.length}). Possible double-counting.`;
    if (process.env.NODE_ENV !== "production") {
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }

  // ── Dev warning: log any record with an unrecognised costType ─────────────
  if (process.env.NODE_ENV !== "production") {
    const known = new Set(["variable", "fixed_monthly"]);
    for (const c of costs) {
      const t = c.costType ?? "variable";
      if (!known.has(t)) {
        console.warn(`[costSplit] Unknown costType "${t}" on cost id=${c.id} — treated as variable.`);
      }
    }
  }

  return { variable, fixed };
}

/**
 * Derive the three numbers that are safe to use in profit calculations.
 * Calling this is the ONLY place `fixedMonthlyTotal` and `dailyFixedCostQuota`
 * should be computed from raw records — keeping the arithmetic in one spot
 * prevents accidental re-derivation elsewhere.
 */
export function computeCostMetrics<T extends CostLike>(
  costs: T[],
  todayStr: string,
  monthStartStr: string,
): {
  variableCostsToday:  number;
  variableCostsMonth:  number;
  fixedMonthlyTotal:   number;
  dailyFixedCostQuota: number;
} {
  const { variable, fixed } = splitCosts(costs);

  const safeSum = (arr: T[]) =>
    arr.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0);

  // Use normDateStr() on every record's date to handle both string and Date objects
  // that the PG driver may return depending on the version of node-pg / drizzle-orm.
  const variableCostsToday  = safeSum(variable.filter((c) => normDateStr(c.date) >= todayStr));
  const variableCostsMonth  = safeSum(variable.filter((c) => normDateStr(c.date) >= monthStartStr));
  const fixedMonthlyTotal   = safeSum(fixed); // NOT date-filtered — recurring amount
  const dailyFixedCostQuota = fixedMonthlyTotal > 0 ? fixedMonthlyTotal / 30 : 0;

  // ── Debug logging ─────────────────────────────────────────────────────────
  console.log("[costSplit] Costs loaded:", costs.length, "records");
  console.log("[costSplit]   variable:", variable.length, "| fixed:", fixed.length);
  console.log("[costSplit]   todayStr:", todayStr, "| monthStart:", monthStartStr);
  if (variable.length > 0) {
    console.log("[costSplit]   variable dates (normalised):",
      variable.map((c) => normDateStr(c.date)).join(", "));
  }
  console.log("[costSplit] Total Costs (variable today):", variableCostsToday);
  console.log("[costSplit] Fixed monthly total:", fixedMonthlyTotal, "| daily quota:", dailyFixedCostQuota.toFixed(2));

  return { variableCostsToday, variableCostsMonth, fixedMonthlyTotal, dailyFixedCostQuota };
}
