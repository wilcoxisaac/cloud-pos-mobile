import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  partyName: text("party_name").notNull(),
  partySize: integer("party_size").notNull().default(2),
  phone: text("phone"),
  reservationDate: text("reservation_date").notNull(),
  reservationTime: text("reservation_time").notNull(),
  tablePreference: text("table_preference"),
  notes: text("notes"),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Reservation = typeof reservationsTable.$inferSelect;
