import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export class Storage {
  async getUser(id: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user ?? null;
  }

  async getUserByStripeCustomerId(customerId: string) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, customerId));
    return user ?? null;
  }

  async updateUserStripeInfo(
    userId: number,
    stripeInfo: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      plan?: string;
      trialStartDate?: string | null;
    },
  ) {
    const [user] = await db
      .update(usersTable)
      .set(stripeInfo)
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`,
    );
    return result.rows[0] ?? null;
  }

  async listProductsWithPrices() {
    const result = await db.execute(sql`
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active
        FROM stripe.products
        WHERE active = true
        ORDER BY id
        LIMIT 20
      )
      SELECT
        p.id          AS product_id,
        p.name        AS product_name,
        p.description AS product_description,
        p.active      AS product_active,
        p.metadata    AS product_metadata,
        pr.id         AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active     AS price_active
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.id, pr.unit_amount
    `);
    return result.rows;
  }

  async getActiveSubscriptionForCustomer(customerId: string) {
    const result = await db.execute(
      sql`
        SELECT * FROM stripe.subscriptions
        WHERE customer = ${customerId}
          AND status IN ('active', 'trialing')
        ORDER BY created DESC
        LIMIT 1
      `,
    );
    return result.rows[0] ?? null;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`,
    );
    return result.rows[0] ?? null;
  }
}

export const storage = new Storage();
