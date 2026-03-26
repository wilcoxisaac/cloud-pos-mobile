import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import ordersRouter from "./orders";
import reportsRouter from "./reports";
import settingsRouter from "./settings";
import alertsRouter from "./alerts";
import tablesRouter from "./tables";
import appointmentsRouter from "./appointments";
import reservationsRouter from "./reservations";
import kitchenRouter from "./kitchen";
import modifiersRouter from "./modifiers";
import quotesRouter from "./quotes";
import invoicesRouter from "./invoices";
import portalRouter from "./portal";
import customersRouter from "./customers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(reportsRouter);
router.use(settingsRouter);
router.use(alertsRouter);
router.use(tablesRouter);
router.use(appointmentsRouter);
router.use(reservationsRouter);
router.use(kitchenRouter);
router.use(modifiersRouter);
router.use(quotesRouter);
router.use(invoicesRouter);
router.use(customersRouter);
router.use("/portal", portalRouter);

export default router;
