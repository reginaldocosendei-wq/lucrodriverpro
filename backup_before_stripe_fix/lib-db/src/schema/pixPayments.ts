import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pixPaymentsTable = pgTable("pix_payments", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  email:       text("email").notNull(),
  name:        text("name").notNull().default(""),
  amount:      text("amount").notNull().default("19.90"),
  status:      text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  rejectedAt:  timestamp("rejected_at"),
  proofUrl:    text("proof_url"),
  notes:       text("notes"),
});

export type PixPayment = typeof pixPaymentsTable.$inferSelect;
