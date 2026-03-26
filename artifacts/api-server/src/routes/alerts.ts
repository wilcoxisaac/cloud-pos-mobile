import { Router } from "express";
import { db, ordersTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";

const router = Router();

export type AlertSeverity = "high" | "medium" | "low";
export type AlertType =
  | "stale_open_order"
  | "high_void_rate"
  | "no_sales_today"
  | "multiple_open_orders";

export interface PosAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionData?: Record<string, unknown>;
  createdAt: string;
}

router.get("/alerts", async (_req, res, next) => {
  try {
    const now = new Date();
    const alerts: PosAlert[] = [];

    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const staleOrders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "open"),
          lt(ordersTable.createdAt, thirtyMinutesAgo)
        )
      );

    for (const order of staleOrders) {
      const ageMinutes = Math.floor(
        (now.getTime() - new Date(order.createdAt).getTime()) / 60000
      );
      const ageLabel =
        ageMinutes >= 60
          ? `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m`
          : `${ageMinutes}m`;
      const severity: AlertSeverity = ageMinutes > 60 ? "high" : "medium";
      alerts.push({
        id: `stale-${order.id}`,
        type: "stale_open_order",
        severity,
        title: "Stale Open Order",
        message: `${order.orderNumber}${order.tableNumber ? ` (Table ${order.tableNumber})` : ""} has been open for ${ageLabel}.`,
        actionLabel: "View Order",
        actionData: { orderId: order.id, orderNumber: order.orderNumber },
        createdAt: now.toISOString(),
      });
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [voidStats] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        voided: sql<number>`sum(case when status = 'voided' then 1 else 0 end)`.mapWith(Number),
      })
      .from(ordersTable)
      .where(sql`created_at >= ${todayStart}`);

    if (voidStats && voidStats.total >= 5 && voidStats.voided / voidStats.total > 0.2) {
      alerts.push({
        id: `void-rate-${now.toDateString()}`,
        type: "high_void_rate",
        severity: "high",
        title: "High Void Rate",
        message: `${voidStats.voided} of ${voidStats.total} orders today have been voided (${Math.round((voidStats.voided / voidStats.total) * 100)}%).`,
        createdAt: now.toISOString(),
      });
    }

    const [todaySales] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(ordersTable)
      .where(
        and(
          sql`created_at >= ${todayStart}`,
          eq(ordersTable.status, "paid")
        )
      );

    const hourOfDay = now.getHours();
    if (hourOfDay >= 10 && (todaySales?.count ?? 0) === 0) {
      alerts.push({
        id: `no-sales-${now.toDateString()}`,
        type: "no_sales_today",
        severity: "medium",
        title: "No Sales Today",
        message: "No completed sales have been recorded today.",
        createdAt: now.toISOString(),
      });
    }

    const openOrders = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(ordersTable)
      .where(eq(ordersTable.status, "open"));

    const openCount = openOrders[0]?.count ?? 0;
    if (openCount >= 10) {
      alerts.push({
        id: `open-orders-${openCount}`,
        type: "multiple_open_orders",
        severity: openCount >= 20 ? "high" : "medium",
        title: "Many Open Orders",
        message: `There are ${openCount} open orders. Consider processing payments.`,
        actionLabel: "View Orders",
        actionData: { filter: "open" },
        createdAt: now.toISOString(),
      });
    }

    alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.post("/alerts/:id/dismiss", async (req, res, next) => {
  try {
    res.json({ dismissed: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;
