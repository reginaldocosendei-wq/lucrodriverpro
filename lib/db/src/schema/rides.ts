import { pgTable, serial, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ridesTable = pgTable("rides", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  value: real("value").notNull(),
  distanceKm: real("distance_km").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  platform: text("platform").notNull(),
  passengerRating: real("passenger_rating").notNull(),
  platformCommissionPct: real("platform_commission_pct").notNull(),
  netValue: real("net_value").notNull(),
  valuePerKm: real("value_per_km").notNull(),
  commissionAmount: real("commission_amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRideSchema = createInsertSchema(ridesTable).omit({ id: true, createdAt: true });
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof ridesTable.$inferSelect;
