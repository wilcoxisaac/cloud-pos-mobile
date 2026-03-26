/**
 * daily-sim.ts
 *
 * Generates realistic daily operations data each time the server starts.
 * Safe to call repeatedly — checks for today's existing records before inserting.
 * Creates: restaurant tables (if empty), today's reservations, today's appointments,
 * and a handful of live open orders.
 */

import { db } from "@workspace/db";
import {
  reservationsTable,
  appointmentsTable,
  ordersTable,
  orderItemsTable,
  productsTable,
  restaurantTablesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

function pad(n: number) { return String(n).padStart(2, "0"); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Standard floor plan (matches https://cloud-po-s-wilcoxisaac.replit.app) ──
const STANDARD_TABLES = [
  { name: "T1",    capacity: 2, section: "Main", status: "available" as const },
  { name: "T2",    capacity: 2, section: "Main", status: "available" as const },
  { name: "T3",    capacity: 4, section: "Main", status: "available" as const },
  { name: "T4",    capacity: 4, section: "Main", status: "available" as const },
  { name: "T5",    capacity: 6, section: "Main", status: "available" as const },
  { name: "T6",    capacity: 4, section: "Main", status: "available" as const },
  { name: "T7",    capacity: 8, section: "Main", status: "available" as const },
  { name: "T8",    capacity: 2, section: "Main", status: "available" as const },
  { name: "T9",    capacity: 4, section: "Main", status: "available" as const },
  { name: "T10",   capacity: 6, section: "Main", status: "available" as const },
  { name: "Bar 1", capacity: 2, section: "Bar",  status: "available" as const },
  { name: "Bar 2", capacity: 2, section: "Bar",  status: "available" as const },
];

// ── Reservation pool ──────────────────────────────────────────────────────────
const RESERVATIONS_TODAY = [
  { partyName: "Johnson Family", partySize: 4, phone: "555-0101", time: "6:00 PM",  tablePreference: "Main",  notes: "Anniversary dinner", status: "confirmed" },
  { partyName: "Smith Party",    partySize: 6, phone: "555-0102", time: "6:30 PM",  tablePreference: "Main",  notes: null, status: "confirmed" },
  { partyName: "Rodriguez",      partySize: 2, phone: "555-0103", time: "7:00 PM",  tablePreference: null,    notes: "Window seat preferred", status: "confirmed" },
  { partyName: "Chen Group",     partySize: 8, phone: "555-0104", time: "7:30 PM",  tablePreference: "Main",  notes: "Business dinner", status: "confirmed" },
  { partyName: "Williams",       partySize: 3, phone: "555-0105", time: "8:00 PM",  tablePreference: null,    notes: null, status: "pending" },
  { partyName: "Davis",          partySize: 2, phone: "555-0106", time: "5:30 PM",  tablePreference: "Bar",   notes: null, status: "seated" },
  { partyName: "Martinez",       partySize: 5, phone: "555-0107", time: "7:00 PM",  tablePreference: "Main",  notes: "Vegetarian options needed", status: "confirmed" },
  { partyName: "Thompson",       partySize: 4, phone: "555-0108", time: "8:30 PM",  tablePreference: null,    notes: null, status: "confirmed" },
];

const RESERVATIONS_TOMORROW = [
  { partyName: "Kim Party",      partySize: 5, phone: "555-0201", time: "6:00 PM",  tablePreference: "Main",  notes: null, status: "confirmed" },
  { partyName: "Thompson",       partySize: 4, phone: "555-0202", time: "7:00 PM",  tablePreference: null,    notes: null, status: "confirmed" },
  { partyName: "Garcia Family",  partySize: 3, phone: "555-0203", time: "7:30 PM",  tablePreference: null,    notes: "High chair needed", status: "pending" },
  { partyName: "Nguyen",         partySize: 2, phone: "555-0204", time: "6:30 PM",  tablePreference: "Bar",   notes: null, status: "confirmed" },
  { partyName: "Patel Party",    partySize: 6, phone: "555-0205", time: "7:00 PM",  tablePreference: "Main",  notes: "Birthday celebration", status: "confirmed" },
];

// ── Appointment pool ──────────────────────────────────────────────────────────
const APPOINTMENTS_TODAY = [
  { clientName: "Sarah Chen",    clientPhone: "555-1001", serviceName: "Haircut",          staffName: "Jordan Lee",   time: "9:00 AM",  duration: 45,  status: "completed",    notes: null },
  { clientName: "Maria Torres",  clientPhone: "555-1002", serviceName: "Color Treatment",  staffName: "Jordan Lee",   time: "10:00 AM", duration: 90,  status: "in-progress",  notes: "Full highlights" },
  { clientName: "Emma Wilson",   clientPhone: "555-1003", serviceName: "Massage (60 min)", staffName: "Morgan Scott", time: "10:30 AM", duration: 60,  status: "confirmed",    notes: null },
  { clientName: "Lisa Park",     clientPhone: "555-1004", serviceName: "Manicure",         staffName: "Taylor Kim",   time: "11:30 AM", duration: 30,  status: "confirmed",    notes: "Gel polish" },
  { clientName: "Rachel Brown",  clientPhone: "555-1005", serviceName: "Manicure",         staffName: "Taylor Kim",   time: "12:00 PM", duration: 30,  status: "confirmed",    notes: null },
  { clientName: "Amy Johnson",   clientPhone: "555-1006", serviceName: "Massage (60 min)", staffName: "Morgan Scott", time: "1:00 PM",  duration: 60,  status: "no-show",      notes: null },
  { clientName: "Christine Lee", clientPhone: "555-1007", serviceName: "Haircut",          staffName: "Jordan Lee",   time: "2:00 PM",  duration: 45,  status: "pending",      notes: "Trim only" },
  { clientName: "Tanya Patel",   clientPhone: "555-1008", serviceName: "Massage (60 min)", staffName: "Morgan Scott", time: "3:30 PM",  duration: 60,  status: "pending",      notes: "Deep tissue preferred" },
  { clientName: "Nicole Kim",    clientPhone: "555-1009", serviceName: "Color Treatment",  staffName: "Jordan Lee",   time: "4:30 PM",  duration: 90,  status: "pending",      notes: "Balayage" },
  { clientName: "Grace Wang",    clientPhone: "555-1010", serviceName: "Manicure",         staffName: "Alex Rivera",  time: "2:30 PM",  duration: 30,  status: "pending",      notes: null },
];

// ── Open order templates (restaurant — live activity) ─────────────────────────
const OPEN_ORDER_TEMPLATES = [
  { skus: ["BURG-001", "BEV-001"], table: "T3", guests: 2, kitchenStatus: "preparing" },
  { skus: ["PIZ-001", "BEV-002", "SAL-001"], table: "T5", guests: 3, kitchenStatus: "ready" },
  { skus: ["FISH-001", "BEV-003"], table: "Bar 1", guests: 2, kitchenStatus: "new" },
  { skus: ["BURG-001", "BURG-001", "BEV-001", "BEV-001", "DES-001"], table: "T7", guests: 4, kitchenStatus: "preparing" },
];

const TABLE_STATUS_MAP: Record<string, string> = {
  T3: "occupied", T5: "occupied", "Bar 1": "occupied", T7: "occupied",
  T4: "reserved", T10: "reserved",
};

const TAX_RATE = 0.08875;

export async function runDailySim() {
  const today = todayStr();
  const tomorrow = tomorrowStr();

  // ── 0. Ensure floor-plan tables exist ─────────────────────────────────────
  const existingTables = await db.select({ id: restaurantTablesTable.id })
    .from(restaurantTablesTable)
    .limit(1);

  if (existingTables.length === 0) {
    await db.insert(restaurantTablesTable).values(STANDARD_TABLES);
    console.log(`[daily-sim] Created ${STANDARD_TABLES.length} standard floor-plan tables`);
  }

  // ── 1. Reservations ────────────────────────────────────────────────────────
  const existingRes = await db.select({ id: reservationsTable.id })
    .from(reservationsTable)
    .where(eq(reservationsTable.reservationDate, today))
    .limit(1);

  if (existingRes.length === 0) {
    await db.insert(reservationsTable).values(
      RESERVATIONS_TODAY.map(r => ({
        partyName: r.partyName,
        partySize: r.partySize,
        phone: r.phone,
        reservationDate: today,
        reservationTime: r.time,
        tablePreference: r.tablePreference,
        notes: r.notes,
        status: r.status,
      }))
    );

    await db.insert(reservationsTable).values(
      RESERVATIONS_TOMORROW.map(r => ({
        partyName: r.partyName,
        partySize: r.partySize,
        phone: r.phone,
        reservationDate: tomorrow,
        reservationTime: r.time,
        tablePreference: r.tablePreference,
        notes: r.notes,
        status: r.status,
      }))
    );
    console.log(`[daily-sim] Created ${RESERVATIONS_TODAY.length} reservations for today + ${RESERVATIONS_TOMORROW.length} for tomorrow`);
  }

  // ── 2. Appointments ────────────────────────────────────────────────────────
  const existingAppt = await db.select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.appointmentDate, today))
    .limit(1);

  if (existingAppt.length === 0) {
    await db.insert(appointmentsTable).values(
      APPOINTMENTS_TODAY.map(a => ({
        clientName: a.clientName,
        clientPhone: a.clientPhone,
        serviceName: a.serviceName,
        staffName: a.staffName,
        appointmentDate: today,
        appointmentTime: a.time,
        durationMinutes: a.duration,
        status: a.status,
        notes: a.notes,
      }))
    );
    console.log(`[daily-sim] Created ${APPOINTMENTS_TODAY.length} appointments for today`);
  }

  // ── 3. Live open orders ────────────────────────────────────────────────────
  const existingOpen = await db.select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.status, "open"))
    .limit(1);

  if (existingOpen.length === 0) {
    const products = await db.select().from(productsTable);
    const bySkuMap = new Map(products.map(p => [p.sku, p]));

    let orderCounter = Date.now() % 10000;

    for (const tpl of OPEN_ORDER_TEMPLATES) {
      let subtotal = 0;
      const lines: Array<{ sku: string; qty: number; name: string; price: string; total: number }> = [];

      const skuCounts = new Map<string, number>();
      for (const sku of tpl.skus) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);

      for (const [sku, qty] of skuCounts) {
        const product = bySkuMap.get(sku);
        if (!product) continue;
        const total = parseFloat(product.price) * qty;
        subtotal += total;
        lines.push({ sku, qty, name: product.name, price: product.price, total });
      }

      const tax = subtotal * TAX_RATE;
      const total = subtotal + tax;
      orderCounter++;

      const [order] = await db.insert(ordersTable).values({
        orderNumber: `ORD-SIM-${orderCounter}`,
        status: "open",
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        tableNumber: tpl.table,
        guestCount: tpl.guests,
        kitchenStatus: tpl.kitchenStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      for (const line of lines) {
        const product = bySkuMap.get(line.sku)!;
        await db.insert(orderItemsTable).values({
          orderId: order.id,
          productId: product.id,
          productName: line.name,
          productPrice: line.price,
          quantity: line.qty,
          subtotal: line.total.toFixed(2),
        });
      }
    }

    // Update table statuses to match open orders
    for (const [tableName, status] of Object.entries(TABLE_STATUS_MAP)) {
      await db.update(restaurantTablesTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(restaurantTablesTable.name, tableName));
    }

    console.log(`[daily-sim] Created ${OPEN_ORDER_TEMPLATES.length} live open orders`);
  }

  console.log(`[daily-sim] Daily operations ready for ${today}`);
}
