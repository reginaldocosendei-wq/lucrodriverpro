import { pgTable, serial, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const extraEarningsTable = pgTable("extra_earnings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ExtraEarning = typeof extraEarningsTable.$inferSelect;
export type InsertExtraEarning = typeof extraEarningsTable.$inferInsert;
