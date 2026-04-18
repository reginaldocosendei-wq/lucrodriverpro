import { pgTable, serial, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const offerCapturesTable = pgTable("offer_captures", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  price: real("price"),
  distanceKm: real("distance_km"),
  estimatedMinutes: integer("estimated_minutes"),
  pickup: text("pickup"),
  destination: text("destination"),
  platform: text("platform"),
  profitPerKm: real("profit_per_km"),
  profitPerHour: real("profit_per_hour"),
  netProfit: real("net_profit"),
  verdict: text("verdict"),
  decision: text("decision"),
  rawExtracted: text("raw_extracted"),
});

export type OfferCapture = typeof offerCapturesTable.$inferSelect;
