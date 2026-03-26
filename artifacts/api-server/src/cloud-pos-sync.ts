import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

const CLOUD_POS_URL = "https://cloud-po-s-wilcoxisaac.replit.app";

export async function syncPaidOrdersToCloudPOS(): Promise<void> {
  try {
    const allPaid = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "paid"));

    let pushed = 0;
    let failed = 0;

    for (const order of allPaid) {
      if (order.notes?.startsWith("synced_from:")) continue;

      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));

      const method =
        order.paymentMethod === "cash" ? "cash"
        : order.paymentMethod === "card" ? "card"
        : "digital";

      try {
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

    logger.info({ pushed, failed, total: allPaid.length }, "[cloud-pos-sync] Startup sync complete");
  } catch (err) {
    logger.error(err, "[cloud-pos-sync] Startup sync failed");
  }
}
