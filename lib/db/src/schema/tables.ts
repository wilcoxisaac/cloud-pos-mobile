import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const restaurantTablesTable = pgTable("restaurant_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(4),
  section: text("section").notNull().default("Main"),
  status: text("status").notNull().default("available"),
  currentOrderId: integer("current_order_id"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RestaurantTable = typeof restaurantTablesTable.$inferSelect;
