import { db, restaurantTablesTable, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/tables", async (req, res) => {
  try {
    const tables = await db.select().from(restaurantTablesTable).orderBy(restaurantTablesTable.id);
    const openOrders = await db
      .select({ id: ordersTable.id, tableNumber: ordersTable.tableNumber, total: ordersTable.total, createdAt: ordersTable.createdAt, customerName: ordersTable.customerName, guestCount: ordersTable.guestCount })
      .from(ordersTable)
      .where(eq(ordersTable.status, "open"));

    res.json(
      tables.map((t) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        section: t.section,
        status: t.status,
        currentOrderId: t.currentOrderId,
        currentOrder: t.currentOrderId ? (openOrders.find((o) => o.id === t.currentOrderId) ?? null) : null,
        updatedAt: t.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err, "Failed to list tables");
    res.status(500).json({ error: "internal_error", message: "Failed to list tables" });
  }
});

router.post("/tables", async (req, res) => {
  try {
    const { name, capacity, section } = req.body as { name?: string; capacity?: number; section?: string };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "bad_request", message: "Table name is required" });
      return;
    }
    const cap = Number(capacity);
    if (!cap || cap < 1 || cap > 50) {
      res.status(400).json({ error: "bad_request", message: "Capacity must be between 1 and 50" });
      return;
    }
    const validSections = ["Main", "Bar", "Patio", "Private", "Outdoor"];
    const tableSection = section && validSections.includes(section) ? section : "Main";

    const [table] = await db
      .insert(restaurantTablesTable)
      .values({ name: name.trim(), capacity: cap, section: tableSection, status: "available", updatedAt: new Date() })
      .returning();

    res.status(201).json({
      id: table.id,
      name: table.name,
      capacity: table.capacity,
      section: table.section,
      status: table.status,
      currentOrderId: null,
      currentOrder: null,
      updatedAt: table.updatedAt.toISOString(),
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "conflict", message: "A table with that name already exists" });
      return;
    }
    req.log.error(err, "Failed to create table");
    res.status(500).json({ error: "internal_error", message: "Failed to create table" });
  }
});

router.patch("/tables/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid table ID" });
      return;
    }
    const { status, currentOrderId, name, capacity, section } = req.body as {
      status?: string;
      currentOrderId?: number | null;
      name?: string;
      capacity?: number;
      section?: string;
    };
    const validStatuses = ["available", "occupied", "reserved", "cleaning"];
    if (status !== undefined && !validStatuses.includes(status)) {
      res.status(400).json({ error: "bad_request", message: "Invalid status" });
      return;
    }
    const updates: Partial<typeof restaurantTablesTable.$inferInsert> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (currentOrderId !== undefined) updates.currentOrderId = currentOrderId ?? undefined;
    if (name !== undefined && name.trim().length > 0) updates.name = name.trim();
    if (capacity !== undefined && Number(capacity) >= 1) updates.capacity = Number(capacity);
    if (section !== undefined) updates.section = section;

    const [table] = await db
      .update(restaurantTablesTable)
      .set(updates)
      .where(eq(restaurantTablesTable.id, id))
      .returning();

    if (!table) {
      res.status(404).json({ error: "not_found", message: "Table not found" });
      return;
    }
    res.json({ id: table.id, name: table.name, capacity: table.capacity, section: table.section, status: table.status, currentOrderId: table.currentOrderId, updatedAt: table.updatedAt.toISOString() });
  } catch (err) {
    req.log.error(err, "Failed to update table");
    res.status(500).json({ error: "internal_error", message: "Failed to update table" });
  }
});

router.delete("/tables/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid table ID" });
      return;
    }
    const [table] = await db.select().from(restaurantTablesTable).where(eq(restaurantTablesTable.id, id));
    if (!table) {
      res.status(404).json({ error: "not_found", message: "Table not found" });
      return;
    }
    if (table.status === "occupied") {
      res.status(409).json({ error: "conflict", message: "Cannot delete an occupied table" });
      return;
    }
    await db.delete(restaurantTablesTable).where(eq(restaurantTablesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete table");
    res.status(500).json({ error: "internal_error", message: "Failed to delete table" });
  }
});

export default router;
