import { pgTable, serial, integer, real, timestamp, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const costsTable = pgTable("costs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull().default(""),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCostSchema = createInsertSchema(costsTable).omit({ id: true, createdAt: true });
export type InsertCost = z.infer<typeof insertCostSchema>;
export type Cost = typeof costsTable.$inferSelect;
