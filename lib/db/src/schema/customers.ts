import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  visits: integer("visits").notNull().default(0),
  lastVisit: text("last_visit"),
  cloudPosId: text("cloud_pos_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Customer = typeof customersTable.$inferSelect;
