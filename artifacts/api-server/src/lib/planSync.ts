import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const TRIAL_DAYS = 7;
export const TRIAL_MS   = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export type EffectivePlan = {
  plan:          "free" | "pro";
  planSource:    "stripe" | "pix_admin" | "trial" | "free";
  trialActive:   boolean;
  trialExpired:  boolean;
  trialDaysLeft: number;
  trialEndDate:  string | null;
};

/**
 * Computes the effective plan for a user without hitting the DB.
 * Priority:
 *   1. plan="pro" + no trialStartDate → paid PRO (Stripe or PIX/admin)
 *   2. trialStartDate set + within 7 days → trial PRO
 *   3. trialStartDate set + expired → free (trial used up)
 *   4. everything else → free
 */
export function computeEffectivePlan(user: typeof usersTable.$inferSelect): EffectivePlan {
  if (user.plan === "pro" && !user.trialStartDate) {
    const source = user.stripeSubscriptionId ? "stripe" : "pix_admin";
    return { plan: "pro", planSource: source, trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndDate: null };
  }

  if (user.trialStartDate) {
    const start   = new Date(user.trialStartDate).getTime();
    const end     = start + TRIAL_MS;
    const elapsed = Date.now() - start;
    const endDate = new Date(end).toISOString();

    if (elapsed < TRIAL_MS) {
      const daysLeft = Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000));
      return { plan: "pro", planSource: "trial", trialActive: true, trialExpired: false, trialDaysLeft: daysLeft, trialEndDate: endDate };
    }
    return { plan: "free", planSource: "free", trialActive: false, trialExpired: true, trialDaysLeft: 0, trialEndDate: endDate };
  }

  if (user.plan === "pro") {
    return { plan: "pro", planSource: "pix_admin", trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndDate: null };
  }

  return { plan: "free", planSource: "free", trialActive: false, trialExpired: false, trialDaysLeft: 0, trialEndDate: null };
}

/**
 * Syncs users.plan against Stripe subscription table.
 * Called at login / GET /me to catch any missed webhooks.
 *
 * Rules:
 *   Stripe active/trialing → plan = "pro"
 *   Stripe canceled/deleted/past_due/unpaid → plan = "free"
 *   No Stripe customer → no-op (plan managed by PIX / admin manually)
 */
export async function syncStripeStatusForUser(
  user: typeof usersTable.$inferSelect,
): Promise<typeof usersTable.$inferSelect> {
  if (!user.stripeCustomerId) return user;

  try {
    const result = await db.execute(
      sql`SELECT status FROM stripe.subscriptions WHERE customer = ${user.stripeCustomerId} ORDER BY created DESC LIMIT 1`,
    );
    const sub = result.rows[0] as { status: string } | undefined;
    if (!sub) return user;

    const shouldBePro = ["active", "trialing"].includes(sub.status);
    const targetPlan  = shouldBePro ? "pro" : "free";

    if (user.plan !== targetPlan) {
      const [updated] = await db
        .update(usersTable)
        .set({ plan: targetPlan, ...(targetPlan === "pro" ? { trialStartDate: null } : {}) })
        .where(eq(usersTable.id, user.id))
        .returning();
      console.log(`[PlanSync] ${user.email}: ${user.plan} → ${targetPlan} (Stripe: ${sub.status})`);
      return updated;
    }
  } catch {
    // stripe.subscriptions table may not be ready — silently skip
  }

  return user;
}

/**
 * Syncs users.plan when a Stripe webhook fires.
 * Called directly from WebhookHandlers with the already-known subscription status.
 */
export async function syncPlanByStripeCustomer(
  customerId: string,
  stripeStatus: string,
): Promise<void> {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, customerId))
      .limit(1);
    if (!user) return;

    const shouldBePro = ["active", "trialing"].includes(stripeStatus);
    const targetPlan  = shouldBePro ? "pro" : "free";

    if (user.plan !== targetPlan) {
      await db
        .update(usersTable)
        .set({ plan: targetPlan, ...(targetPlan === "pro" ? { trialStartDate: null } : {}) })
        .where(eq(usersTable.id, user.id));
      console.log(`[PlanSync] Webhook: ${user.email} → ${targetPlan} (Stripe status: ${stripeStatus})`);
    }
  } catch (err: any) {
    console.error("[PlanSync] syncPlanByStripeCustomer error:", err.message);
  }
}
