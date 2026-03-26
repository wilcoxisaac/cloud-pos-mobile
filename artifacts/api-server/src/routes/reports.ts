import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CLOUD_POS_URL = "https://cloud-po-s-wilcoxisaac.replit.app";

type CloudTxn = {
  id: string;
  timestamp: string;
  orderNumber: string;
  total: number;
  paymentMethod?: string | null;
  source?: string;
};

async function fetchCloudPOSTransactions(): Promise<CloudTxn[]> {
  try {
    const res = await fetch(`${CLOUD_POS_URL}/api/transactions`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = await res.json() as CloudTxn[];
    // Exclude transactions we pushed from mobile to avoid double-counting
    return data.filter((t) => t.source !== "mobile_pos");
  } catch {
    return [];
  }
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

router.get("/reports/summary", async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    // Fetch local (mobile POS) orders and Cloud POS transactions in parallel
    const [allOrders, cloudTxns] = await Promise.all([
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)),
      fetchCloudPOSTransactions(),
    ]);

    const paidOrders = allOrders.filter((o) => o.status === "paid");

    const todayOrders = paidOrders.filter((o) => o.paidAt && o.paidAt >= todayStart);
    const weekOrders = paidOrders.filter((o) => o.paidAt && o.paidAt >= weekStart);
    const monthOrders = paidOrders.filter((o) => o.paidAt && o.paidAt >= monthStart);

    const sum = (orders: typeof paidOrders) =>
      orders.reduce((s, o) => s + parseFloat(o.total), 0);

    const cashToday = todayOrders.filter((o) => o.paymentMethod === "cash");
    const cardToday = todayOrders.filter((o) => o.paymentMethod === "card");

    // Cloud POS transaction totals by time window (deduped from local)
    const cloudToday = cloudTxns.filter((t) => new Date(t.timestamp) >= todayStart);
    const cloudWeek = cloudTxns.filter((t) => new Date(t.timestamp) >= weekStart);
    const cloudMonth = cloudTxns.filter((t) => new Date(t.timestamp) >= monthStart);
    const cloudSum = (txns: CloudTxn[]) => txns.reduce((s, t) => s + (t.total ?? 0), 0);

    const cloudCashToday = cloudToday.filter((t) => t.paymentMethod === "cash");
    const cloudCardToday = cloudToday.filter((t) => t.paymentMethod === "card");

    const items = await db.select().from(orderItemsTable);
    const itemMap = items.reduce((acc, i) => {
      const key = i.productName;
      if (!acc[key]) acc[key] = { name: key, quantity: 0, revenue: 0 };
      acc[key].quantity += i.quantity;
      acc[key].revenue += parseFloat(i.subtotal);
      return acc;
    }, {} as Record<string, { name: string; quantity: number; revenue: number }>);

    const topProducts = Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const recentOrders = allOrders.slice(0, 10).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: parseFloat(o.total),
      paymentMethod: o.paymentMethod,
      source: "mobile_pos",
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    }));

    // Merge Cloud POS recent transactions into recent orders list
    const recentCloudOrders = cloudTxns
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        orderNumber: t.orderNumber,
        status: "paid" as const,
        total: t.total,
        paymentMethod: t.paymentMethod ?? null,
        source: "cloud_pos",
        createdAt: t.timestamp,
        paidAt: t.timestamp,
      }));

    const mergedRecent = [...recentOrders, ...recentCloudOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);

    res.json({
      today: {
        orders: todayOrders.length + cloudToday.length,
        revenue: sum(todayOrders) + cloudSum(cloudToday),
        cash: sum(cashToday) + cloudSum(cloudCashToday),
        card: sum(cardToday) + cloudSum(cloudCardToday),
        avgOrderValue:
          todayOrders.length + cloudToday.length > 0
            ? (sum(todayOrders) + cloudSum(cloudToday)) / (todayOrders.length + cloudToday.length)
            : 0,
        mobilePOS: { orders: todayOrders.length, revenue: sum(todayOrders) },
        cloudPOS: { orders: cloudToday.length, revenue: cloudSum(cloudToday) },
      },
      week: {
        orders: weekOrders.length + cloudWeek.length,
        revenue: sum(weekOrders) + cloudSum(cloudWeek),
        avgOrderValue:
          weekOrders.length + cloudWeek.length > 0
            ? (sum(weekOrders) + cloudSum(cloudWeek)) / (weekOrders.length + cloudWeek.length)
            : 0,
      },
      month: {
        orders: monthOrders.length + cloudMonth.length,
        revenue: sum(monthOrders) + cloudSum(cloudMonth),
        avgOrderValue:
          monthOrders.length + cloudMonth.length > 0
            ? (sum(monthOrders) + cloudSum(cloudMonth)) / (monthOrders.length + cloudMonth.length)
            : 0,
      },
      allTime: {
        orders: paidOrders.length + cloudTxns.length,
        revenue: sum(paidOrders) + cloudSum(cloudTxns),
        voidedOrders: allOrders.filter((o) => o.status === "voided").length,
      },
      topProducts,
      recentOrders: mergedRecent,
      sources: {
        mobilePOS: { connected: true },
        cloudPOS: { connected: cloudTxns.length >= 0, transactionCount: cloudTxns.length },
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to generate report");
    res.status(500).json({ error: "internal_error", message: "Failed to generate report" });
  }
});

export default router;
