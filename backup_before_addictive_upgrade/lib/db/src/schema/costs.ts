import { pgTable, serial, integer, real, timestamp, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const costsTable = pgTable("costs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  // "variable"     — one-off daily expense (fuel, food, toll, wash …)
  // "fixed_monthly" — recurring monthly cost (car rental, insurance, tracker …)
  // All records created before this column was added default to "variable".
  costType: text("cost_type").notNull().default("variable"),
  amount: real("amount").notNull(),
  description: text("description").notNull().default(""),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCostSchema = createInsertSchema(costsTable).omit({ id: true, createdAt: true });
export type InsertCost = z.infer<typeof insertCostSchema>;
export type Cost = typeof costsTable.$inferSelect;
