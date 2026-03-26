import { db, appointmentsTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

function toAppointmentResponse(a: typeof appointmentsTable.$inferSelect) {
  return {
    id: a.id,
    clientName: a.clientName,
    clientPhone: a.clientPhone,
    serviceName: a.serviceName,
    staffName: a.staffName,
    appointmentDate: a.appointmentDate,
    appointmentTime: a.appointmentTime,
    durationMinutes: a.durationMinutes,
    status: a.status,
    notes: a.notes,
    orderId: a.orderId,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

router.get("/appointments", async (req, res) => {
  try {
    const month = req.query.month as string | undefined;
    const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

    let rows;
    if (month) {
      rows = await db
        .select()
        .from(appointmentsTable)
        .where(like(appointmentsTable.appointmentDate, `${month}%`))
        .orderBy(appointmentsTable.appointmentDate, appointmentsTable.appointmentTime);
    } else {
      rows = await db
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.appointmentDate, date))
        .orderBy(appointmentsTable.appointmentTime);
    }
    res.json(rows.map(toAppointmentResponse));
  } catch (err) {
    req.log.error(err, "Failed to list appointments");
    res.status(500).json({ error: "internal_error", message: "Failed to list appointments" });
  }
});

router.post("/appointments", async (req, res) => {
  try {
    const { clientName, clientPhone, serviceName, staffName, appointmentDate, appointmentTime, durationMinutes, notes } =
      req.body as {
        clientName: string;
        clientPhone?: string;
        serviceName: string;
        staffName?: string;
        appointmentDate: string;
        appointmentTime: string;
        durationMinutes?: number;
        notes?: string;
      };
    if (!clientName || !serviceName || !appointmentDate || !appointmentTime) {
      res.status(400).json({ error: "validation_error", message: "clientName, serviceName, appointmentDate and appointmentTime are required" });
      return;
    }
    const [row] = await db
      .insert(appointmentsTable)
      .values({ clientName, clientPhone, serviceName, staffName, appointmentDate, appointmentTime, durationMinutes: durationMinutes ?? 60, notes, status: "confirmed" })
      .returning();
    res.status(201).json(toAppointmentResponse(row));
  } catch (err) {
    req.log.error(err, "Failed to create appointment");
    res.status(500).json({ error: "internal_error", message: "Failed to create appointment" });
  }
});

router.patch("/appointments/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid appointment ID" });
      return;
    }
    const validStatuses = ["pending", "confirmed", "in-progress", "completed", "no-show"];
    const { status, orderId, staffName, notes } = req.body as {
      status?: string;
      orderId?: number | null;
      staffName?: string;
      notes?: string;
    };
    if (status !== undefined && !validStatuses.includes(status)) {
      res.status(400).json({ error: "bad_request", message: "Invalid status" });
      return;
    }
    const updates: Partial<typeof appointmentsTable.$inferInsert> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (orderId !== undefined) updates.orderId = orderId ?? undefined;
    if (staffName !== undefined) updates.staffName = staffName;
    if (notes !== undefined) updates.notes = notes;

    const [row] = await db
      .update(appointmentsTable)
      .set(updates)
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "not_found", message: "Appointment not found" });
      return;
    }
    res.json(toAppointmentResponse(row));
  } catch (err) {
    req.log.error(err, "Failed to update appointment");
    res.status(500).json({ error: "internal_error", message: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid appointment ID" });
      return;
    }
    await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete appointment");
    res.status(500).json({ error: "internal_error", message: "Failed to delete appointment" });
  }
});

export default router;
