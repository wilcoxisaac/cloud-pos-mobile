import { db, reservationsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

function toReservationResponse(r: typeof reservationsTable.$inferSelect) {
  return {
    id: r.id,
    partyName: r.partyName,
    partySize: r.partySize,
    phone: r.phone,
    reservationDate: r.reservationDate,
    reservationTime: r.reservationTime,
    tablePreference: r.tablePreference,
    notes: r.notes,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/reservations", async (req, res) => {
  try {
    const date = req.query.date as string | undefined;
    const month = req.query.month as string | undefined;
    let rows;
    if (month) {
      rows = await db.select().from(reservationsTable)
        .where(like(reservationsTable.reservationDate, `${month}%`))
        .orderBy(reservationsTable.reservationDate, reservationsTable.reservationTime);
    } else if (date) {
      rows = await db.select().from(reservationsTable)
        .where(eq(reservationsTable.reservationDate, date))
        .orderBy(reservationsTable.reservationTime);
    } else {
      rows = await db.select().from(reservationsTable)
        .orderBy(reservationsTable.reservationDate, reservationsTable.reservationTime);
    }
    res.json(rows.map(toReservationResponse));
  } catch (err) {
    req.log.error(err, "Failed to list reservations");
    res.status(500).json({ error: "internal_error", message: "Failed to list reservations" });
  }
});

router.post("/reservations", async (req, res) => {
  try {
    const { partyName, partySize, phone, reservationDate, reservationTime, tablePreference, notes } =
      req.body as {
        partyName: string;
        partySize?: number;
        phone?: string;
        reservationDate: string;
        reservationTime: string;
        tablePreference?: string;
        notes?: string;
      };
    if (!partyName || !reservationDate || !reservationTime) {
      res.status(400).json({ error: "validation_error", message: "partyName, reservationDate and reservationTime are required" });
      return;
    }
    const [row] = await db
      .insert(reservationsTable)
      .values({ partyName, partySize: partySize ?? 2, phone, reservationDate, reservationTime, tablePreference, notes, status: "confirmed" })
      .returning();
    res.status(201).json(toReservationResponse(row));
  } catch (err) {
    req.log.error(err, "Failed to create reservation");
    res.status(500).json({ error: "internal_error", message: "Failed to create reservation" });
  }
});

router.patch("/reservations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid reservation ID" });
      return;
    }
    const validStatuses = ["pending", "confirmed", "seated", "no-show", "cancelled"];
    const { status, notes, tablePreference } = req.body as { status?: string; notes?: string; tablePreference?: string };
    if (status !== undefined && !validStatuses.includes(status)) {
      res.status(400).json({ error: "bad_request", message: "Invalid status" });
      return;
    }
    const updates: Partial<typeof reservationsTable.$inferInsert> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (tablePreference !== undefined) updates.tablePreference = tablePreference;

    const [row] = await db.update(reservationsTable).set(updates).where(eq(reservationsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Reservation not found" });
      return;
    }
    res.json(toReservationResponse(row));
  } catch (err) {
    req.log.error(err, "Failed to update reservation");
    res.status(500).json({ error: "internal_error", message: "Failed to update reservation" });
  }
});

router.delete("/reservations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid reservation ID" });
      return;
    }
    await db.delete(reservationsTable).where(eq(reservationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete reservation");
    res.status(500).json({ error: "internal_error", message: "Failed to delete reservation" });
  }
});

export default router;
