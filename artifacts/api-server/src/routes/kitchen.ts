import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, and, ne, desc } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/kitchen", async (req, res) => {
  try {
    const orders = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.status, "open"), ne(ordersTable.kitchenStatus, "served")))
      .orderBy(desc(ordersTable.createdAt));

    const result = await Promise.all(
      orders.map(async (order) => {
        const items = await db
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, order.id));
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          guestCount: order.guestCount,
          customerName: order.customerName,
          kitchenStatus: order.kitchenStatus,
          total: parseFloat(order.total),
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          items: items.map((item) => ({
            id: item.id,
            productName: item.productName,
            quantity: item.quantity,
            notes: item.notes,
          })),
        };
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to fetch kitchen tickets");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch kitchen tickets" });
  }
});

export default router;
