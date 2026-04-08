import { pgTable, serial, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const dailySummariesTable = pgTable("daily_summaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  earnings: real("earnings").notNull(),
  trips: integer("trips").notNull(),
  kmDriven: real("km_driven"),
  hoursWorked: real("hours_worked"),
  rating: real("rating"),
  platform: text("platform"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDailySummarySchema = createInsertSchema(dailySummariesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;
export type DailySummary = typeof dailySummariesTable.$inferSelect;
