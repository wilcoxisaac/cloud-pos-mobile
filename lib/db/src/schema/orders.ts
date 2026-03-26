import { integer, numeric, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const orderStatusEnum = pgEnum("order_status", ["open", "paid", "voided"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("open"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: paymentMethodEnum("payment_method"),
  amountTendered: numeric("amount_tendered", { precision: 10, scale: 2 }),
  changeDue: numeric("change_due", { precision: 10, scale: 2 }),
  tableNumber: text("table_number"),
  guestCount: integer("guest_count"),
  kitchenStatus: text("kitchen_status").notNull().default("new"),
  customerName: text("customer_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  productPrice: numeric("product_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitQuantity: numeric("unit_quantity", { precision: 10, scale: 2 }),
  notes: text("notes"),
  selectedModifiers: text("selected_modifiers"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  subtotal: true,
  tax: true,
  total: true,
  orderNumber: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({
  id: true,
  subtotal: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
