import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./seed";
import { runDailySim } from "./daily-sim";
import { syncPaidOrdersToCloudPOS } from "./cloud-pos-sync";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  seedIfEmpty()
    .then(() => runDailySim())
    .then(() => syncPaidOrdersToCloudPOS())
    .catch((err) => logger.error(err, "Startup data init failed"));
});
