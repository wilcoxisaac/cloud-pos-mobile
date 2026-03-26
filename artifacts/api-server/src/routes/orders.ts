import { db, ordersTable, orderItemsTable, productsTable, customersTable } from "@workspace/db";
import { eq, desc, and, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getTierInfo } from "./customers";
import { sendOrderReceiptEmail } from "../lib/email";

const TAX_RATE = 0.08; // 8% tax

const CLOUD_POS_URL = "https://cloud-po-s-wilcoxisaac.replit.app";

type OrderResponse = ReturnType<typeof toOrderResponse>;

async function pushToCloudPOS(order: OrderResponse): Promise<void> {
  try {
    const method =
      order.paymentMethod === "cash" ? "cash"
      : order.paymentMethod === "card" ? "card"
      : "digital";

    await fetch(`${CLOUD_POS_URL}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: order.items.map((i) => ({
          id: String(i.productId ?? `m${i.id}`),
          name: i.productName,
          price: i.productPrice,
          qty: i.quantity,
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        tip: 0,
        total: order.total,
        method,
        ...(order.tableNumber ? { table: order.tableNumber } : {}),
      }),
    });
  } catch {
    // Fire-and-forget — never block the payment response
  }
}

const router: IRouter = Router();

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `ORD-${date}-${rand}`;
}

async function getOrderWithItems(orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return null;
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  return toOrderResponse(order, items);
}

function toOrderResponse(
  order: typeof ordersTable.$inferSelect,
  items: (typeof orderItemsTable.$inferSelect)[]
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productPrice: parseFloat(item.productPrice),
      quantity: item.quantity,
      unitQuantity: item.unitQuantity ? parseFloat(item.unitQuantity) : null,
      notes: item.notes,
      selectedModifiers: item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [],
      subtotal: parseFloat(item.subtotal),
    })),
    subtotal: parseFloat(order.subtotal),
    tax: parseFloat(order.tax),
    total: parseFloat(order.total),
    paymentMethod: order.paymentMethod,
    amountTendered: order.amountTendered ? parseFloat(order.amountTendered) : null,
    changeDue: order.changeDue ? parseFloat(order.changeDue) : null,
    tableNumber: order.tableNumber,
    guestCount: order.guestCount,
    kitchenStatus: order.kitchenStatus,
    customerName: order.customerName,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
  };
}

async function recalcOrderTotals(orderId: number) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const subtotal = items.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  await db
    .update(ordersTable)
    .set({
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, orderId));
}

// List orders
router.get("/orders", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt((req.query.limit as string) || "50");

    let query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(limit);

    const orders = status
      ? await db
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.status, status as "open" | "paid" | "voided"))
          .orderBy(desc(ordersTable.createdAt))
          .limit(limit)
      : await query;

    const result = await Promise.all(
      orders.map(async (order) => {
        const items = await db
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, order.id));
        return toOrderResponse(order, items);
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to list orders");
    res.status(500).json({ error: "internal_error", message: "Failed to list orders" });
  }
});

// Create order
router.post("/orders", async (req, res) => {
  try {
    const createSchema = z.object({
      tableNumber: z.string().nullable().optional(),
      guestCount: z.number().int().nullable().optional(),
      customerName: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      items: z.array(
        z.object({
          productId: z.number().int(),
          quantity: z.number().int().min(1).default(1),
          unitQuantity: z.number().positive().nullable().optional(),
          notes: z.string().nullable().optional(),
          selectedModifiers: z.array(z.object({
            groupId: z.number().int(),
            groupName: z.string(),
            optionId: z.number().int(),
            optionName: z.string(),
            priceAdjustment: z.number(),
          })).optional(),
        })
      ).min(1),
    });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }

    const { items, ...orderData } = parsed.data;
    const orderNumber = generateOrderNumber();

    const [order] = await db
      .insert(ordersTable)
      .values({ ...orderData, orderNumber, status: "open" })
      .returning();

    // Add items
    for (const item of items) {
      const [product] = await db
        .select()
        .from(productsTable)
        .where(and(eq(productsTable.id, item.productId), eq(productsTable.isActive, true)));

      if (!product) {
        res.status(400).json({
          error: "bad_request",
          message: `Product ${item.productId} not found or inactive`,
        });
        return;
      }

      const basePrice = parseFloat(product.price);
      const modifierTotal = (item.selectedModifiers ?? []).reduce(
        (sum, m) => sum + m.priceAdjustment,
        0
      );
      const unitPrice = basePrice + modifierTotal;
      const effectiveQty = item.unitQuantity ?? item.quantity;
      const subtotal = unitPrice * effectiveQty;

      await db.insert(orderItemsTable).values({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        productPrice: unitPrice.toFixed(2),
        quantity: item.quantity,
        unitQuantity: item.unitQuantity ? String(item.unitQuantity) : null,
        notes: item.notes ?? null,
        selectedModifiers: item.selectedModifiers ? JSON.stringify(item.selectedModifiers) : null,
        subtotal: subtotal.toFixed(2),
      });
    }

    await recalcOrderTotals(order.id);
    const result = await getOrderWithItems(order.id);
    res.status(201).json(result);
  } catch (err) {
    req.log.error(err, "Failed to create order");
    res.status(500).json({ error: "internal_error", message: "Failed to create order" });
  }
});

// Get order
router.get("/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
      return;
    }
    const order = await getOrderWithItems(id);
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    res.json(order);
  } catch (err) {
    req.log.error(err, "Failed to get order");
    res.status(500).json({ error: "internal_error", message: "Failed to get order" });
  }
});

// Update order metadata
router.patch("/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
      return;
    }

    const updateSchema = z.object({
      tableNumber: z.string().nullable().optional(),
      guestCount: z.number().int().nullable().optional(),
      customerName: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }

    await db
      .update(ordersTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(ordersTable.id, id), eq(ordersTable.status, "open")));

    const result = await getOrderWithItems(id);
    if (!result) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to update order");
    res.status(500).json({ error: "internal_error", message: "Failed to update order" });
  }
});

// Update kitchen status
router.patch("/orders/:id/kitchen", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
      return;
    }
    const validStatuses = ["new", "preparing", "ready", "served"];
    const { kitchenStatus } = req.body as { kitchenStatus: string };
    if (!kitchenStatus || !validStatuses.includes(kitchenStatus)) {
      res.status(400).json({ error: "bad_request", message: "Valid kitchenStatus required: new, preparing, ready, served" });
      return;
    }
    await db.update(ordersTable).set({ kitchenStatus, updatedAt: new Date() }).where(eq(ordersTable.id, id));
    const result = await getOrderWithItems(id);
    if (!result) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to update kitchen status");
    res.status(500).json({ error: "internal_error", message: "Failed to update kitchen status" });
  }
});

// Void order
router.post("/orders/:id/void", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
      return;
    }

    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    if (existing.status !== "open") {
      res.status(400).json({ error: "bad_request", message: "Only open orders can be voided" });
      return;
    }

    await db
      .update(ordersTable)
      .set({ status: "voided", updatedAt: new Date() })
      .where(eq(ordersTable.id, id));

    const result = await getOrderWithItems(id);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to void order");
    res.status(500).json({ error: "internal_error", message: "Failed to void order" });
  }
});

// Pay order
router.post("/orders/:id/pay", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
      return;
    }

    const paySchema = z.object({
      method: z.enum(["cash", "card"]),
      amountTendered: z.number().nullable().optional(),
    });

    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }

    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    if (existing.status !== "open") {
      res.status(400).json({ error: "bad_request", message: "Order is not open" });
      return;
    }

    const total = parseFloat(existing.total);
    const amountTendered = parsed.data.amountTendered ?? total;
    const changeDue = parsed.data.method === "cash" ? Math.max(0, amountTendered - total) : 0;

    await db
      .update(ordersTable)
      .set({
        status: "paid",
        paymentMethod: parsed.data.method,
        amountTendered: amountTendered.toFixed(2),
        changeDue: changeDue.toFixed(2),
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, id));

    const result = await getOrderWithItems(id);

    // Fire-and-forget: push paid order to Cloud POS for unified reporting
    if (result) pushToCloudPOS(result);

    res.json({
      order: result,
      changeDue: changeDue > 0 ? changeDue : null,
      success: true,
      message: `Payment of $${total.toFixed(2)} received via ${parsed.data.method}`,
    });
  } catch (err) {
    req.log.error(err, "Failed to process payment");
    res.status(500).json({ error: "internal_error", message: "Failed to process payment" });
  }
});

// Backfill: push all paid orders to Cloud POS (useful after server restarts)
router.post("/sync/push-to-cloud", async (req, res) => {
  try {
    const allPaid = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "paid"));

    let pushed = 0;
    let failed = 0;

    for (const order of allPaid) {
      // Skip orders already synced from Cloud POS to avoid round-trips
      if (order.notes?.startsWith("synced_from:")) continue;

      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));

      try {
        const method =
          order.paymentMethod === "cash" ? "cash"
          : order.paymentMethod === "card" ? "card"
          : "digital";

        const r = await fetch(`${CLOUD_POS_URL}/api/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({
              id: String(i.productId ?? `m${i.id}`),
              name: i.productName,
              price: parseFloat(i.productPrice),
              qty: i.quantity,
            })),
            subtotal: parseFloat(order.subtotal),
            tax: parseFloat(order.tax),
            tip: 0,
            total: parseFloat(order.total),
            method,
            ...(order.tableNumber ? { table: order.tableNumber } : {}),
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) pushed++;
        else failed++;
      } catch {
        failed++;
      }
    }

    res.json({ success: true, pushed, failed, total: allPaid.length });
  } catch (err) {
    req.log.error(err, "Failed to backfill Cloud POS");
    res.status(500).json({ error: "internal_error", message: "Failed to backfill" });
  }
});

// Inbound webhook: Cloud POS pushes its paid orders here so mobile reports stay in sync
router.post("/sync/receive-transaction", async (req, res) => {
  try {
    const schema = z.object({
      orderNumber: z.string(),
      total: z.number(),
      subtotal: z.number().optional(),
      tax: z.number().optional(),
      paymentMethod: z.enum(["cash", "card"]).nullable().optional(),
      source: z.string().optional(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.number(),
        price: z.number().optional(),
        subtotal: z.number().optional(),
      })).optional(),
      tableNumber: z.string().nullable().optional(),
      customerName: z.string().nullable().optional(),
      timestamp: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }

    const data = parsed.data;
    const total = data.total;
    const subtotal = data.subtotal ?? total / 1.08;
    const tax = data.tax ?? total - subtotal;
    const paidAt = data.timestamp ? new Date(data.timestamp) : new Date();

    const [order] = await db
      .insert(ordersTable)
      .values({
        orderNumber: data.orderNumber,
        status: "paid",
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: data.paymentMethod ?? "card",
        amountTendered: total.toFixed(2),
        changeDue: "0.00",
        tableNumber: data.tableNumber ?? null,
        customerName: data.customerName ?? null,
        notes: `synced_from:${data.source ?? "cloud_pos"}`,
        paidAt,
      })
      .returning();

    // Items are not inserted for synced orders since productId is required
    // The order total is what matters for unified reporting

    res.json({ success: true, id: order.id, orderNumber: order.orderNumber });
  } catch (err) {
    req.log.error(err, "Failed to receive transaction from Cloud POS");
    res.status(500).json({ error: "internal_error", message: "Failed to receive transaction" });
  }
});

// Add item to order
router.post("/orders/:id/items", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
      return;
    }

    const addItemSchema = z.object({
      productId: z.number().int(),
      quantity: z.number().int().min(1),
      notes: z.string().nullable().optional(),
    });

    const parsed = addItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    if (order.status !== "open") {
      res.status(400).json({ error: "bad_request", message: "Cannot add items to a closed order" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, parsed.data.productId), eq(productsTable.isActive, true)));

    if (!product) {
      res.status(400).json({ error: "bad_request", message: "Product not found or inactive" });
      return;
    }

    const price = parseFloat(product.price);
    const subtotal = price * parsed.data.quantity;

    await db.insert(orderItemsTable).values({
      orderId: id,
      productId: product.id,
      productName: product.name,
      productPrice: price.toFixed(2),
      quantity: parsed.data.quantity,
      notes: parsed.data.notes ?? null,
      subtotal: subtotal.toFixed(2),
    });

    await recalcOrderTotals(id);
    const result = await getOrderWithItems(id);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to add order item");
    res.status(500).json({ error: "internal_error", message: "Failed to add item" });
  }
});

// Remove item from order
router.delete("/orders/:id/items/:itemId", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    if (isNaN(id) || isNaN(itemId)) {
      res.status(400).json({ error: "bad_request", message: "Invalid ID" });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    if (order.status !== "open") {
      res.status(400).json({ error: "bad_request", message: "Cannot modify a closed order" });
      return;
    }

    await db
      .delete(orderItemsTable)
      .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, id)));

    await recalcOrderTotals(id);
    const result = await getOrderWithItems(id);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to remove order item");
    res.status(500).json({ error: "internal_error", message: "Failed to remove item" });
  }
});

// ── Receipt + loyalty enrollment ────────────────────────────────────────────

router.post("/orders/:id/receipt", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

    const { method, name, contact, enrollLoyalty } = req.body as {
      method: "email" | "sms";
      name: string;
      contact: string;
      enrollLoyalty: boolean;
    };

    const order = await getOrderWithItems(id);
    if (!order) { res.status(404).json({ error: "not_found" }); return; }

    let loyalty: {
      isNew: boolean;
      pointsEarned: number;
      customer: { id: number; name: string; loyaltyPoints: number; tier: string; tierColor: string };
    } | null = null;

    if (enrollLoyalty && name?.trim()) {
      const nameClean = name.trim();
      const emailClean = method === "email" ? contact?.trim().toLowerCase() || null : null;
      const phoneClean = method === "sms" ? contact?.trim() || null : null;
      const pointsEarned = Math.floor(order.total);
      const today = new Date().toISOString().slice(0, 10);

      let existing: typeof customersTable.$inferSelect | null = null;
      if (emailClean) {
        const [found] = await db.select().from(customersTable).where(ilike(customersTable.email, emailClean)).limit(1);
        existing = found ?? null;
      }
      if (!existing && phoneClean) {
        const [found] = await db.select().from(customersTable).where(ilike(customersTable.phone, phoneClean)).limit(1);
        existing = found ?? null;
      }
      if (!existing) {
        const [found] = await db.select().from(customersTable).where(ilike(customersTable.name, nameClean)).limit(1);
        existing = found ?? null;
      }

      let customer: typeof customersTable.$inferSelect;
      let isNew: boolean;

      if (existing) {
        const [updated] = await db
          .update(customersTable)
          .set({
            loyaltyPoints: existing.loyaltyPoints + pointsEarned,
            visits: existing.visits + 1,
            lastVisit: today,
            email: emailClean ?? existing.email,
            phone: phoneClean ?? existing.phone,
            updatedAt: new Date(),
          })
          .where(eq(customersTable.id, existing.id))
          .returning();
        customer = updated;
        isNew = false;
      } else {
        const [created] = await db
          .insert(customersTable)
          .values({ name: nameClean, email: emailClean, phone: phoneClean, loyaltyPoints: pointsEarned, visits: 1, lastVisit: today })
          .returning();
        customer = created;
        isNew = true;
      }

      const tier = getTierInfo(customer.loyaltyPoints);
      loyalty = { isNew, pointsEarned, customer: { id: customer.id, name: customer.name, loyaltyPoints: customer.loyaltyPoints, tier: tier.tier, tierColor: tier.color } };
    }

    let sent = false;
    if (method === "email" && contact?.includes("@")) {
      try {
        sent = await sendOrderReceiptEmail({
          to: contact.trim(),
          name: name?.trim() || "Valued Customer",
          orderNumber: order.orderNumber,
          total: order.total,
          subtotal: order.subtotal,
          tax: order.tax,
          items: order.items,
          paymentMethod: order.paymentMethod,
          entryMethod: order.paymentMethod === "cash" ? "cash" : "contactless",
          transactionAt: new Date(),
        });
      } catch {}
    }

    res.json({ sent, loyalty });
  } catch (err) {
    req.log?.error(err, "Failed to process receipt");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
