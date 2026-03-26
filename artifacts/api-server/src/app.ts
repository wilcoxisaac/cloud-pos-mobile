import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apple Pay domain verification (must be at root, before /api prefix)
app.get("/.well-known/apple-pay-merchant-id-domain-association", (_req, res) => {
  const content = process.env.APPLE_PAY_DOMAIN_ASSOCIATION;
  if (!content) { res.status(404).end(); return; }
  res.type("text/plain").send(content);
});

app.use("/api", router);

export default app;
