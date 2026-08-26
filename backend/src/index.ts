import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "./lib/env.ts";
import { logger } from "./lib/logger.ts";
import { issueCsrfCookie } from "./middleware/csrf.ts";
import { productsRouter } from "./routes/products.ts";
import { checkoutRouter } from "./routes/checkout.ts";
import { ratesRouter } from "./routes/rates.ts";
import { ordersRouter } from "./routes/orders.ts";
import { contactRouter } from "./routes/contact.ts";
import { adminAuthRouter } from "./routes/admin/auth.ts";
import { adminProductsRouter } from "./routes/admin/products.ts";
import { adminOrdersRouter } from "./routes/admin/orders.ts";
import { adminContactRouter } from "./routes/admin/contact.ts";
import { startPaymentPoller } from "./services/payment/poller.ts";

// Letztes Sicherheitsnetz: alle Route-Handler und Middleware sind über
// asyncHandler() abgesichert (siehe lib/asyncHandler.ts), diese Hooks
// greifen daher im Normalbetrieb nie – sie verhindern nur, dass eine
// übersehene Stelle den gesamten Prozess mit ausstehenden Requests
// abstürzen lässt (DoS-Risiko). Docker/systemd starten den Prozess bei
// einem Exit ohnehin neu (restart: unless-stopped).
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unbehandelte Promise-Ablehnung – Prozess wird beendet");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Unbehandelte Ausnahme – Prozess wird beendet");
  process.exit(1);
});

const app = express();

// Kein "trust proxy" für X-Forwarded-For, da IP-Adressen bewusst nicht
// verarbeitet/geloggt werden (Datensparsamkeit, siehe docs/datenschutz.md).
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // kein 'unsafe-inline', kein CDN – alles self-hosted
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: "same-site" }
  })
);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(
  pinoHttp({
    logger,
    // Keine IP-Adressen, Cookies oder Query-Strings im Access-Log
    // (Datensparsamkeit) – nur Methode, Pfad (ohne Query) und Statuscode.
    customProps: (req: IncomingMessage) => ({ path: req.url?.split("?")[0] }),
    serializers: {
      req: (req: IncomingMessage) => ({ method: req.method, url: req.url?.split("?")[0] }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode })
    }
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads", { maxAge: "7d" }));

app.get("/api/csrf", (req, res) => {
  const token = issueCsrfCookie(req, res);
  res.json({ csrfToken: token });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/products", productsRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/rates", ratesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/contact", contactRouter);

app.use("/admin/auth", adminAuthRouter);
app.use("/admin/products", adminProductsRouter);
app.use("/admin/orders", adminOrdersRouter);
app.use("/admin/contact", adminContactRouter);

app.use((_req, res) => res.status(404).json({ error: "Nicht gefunden." }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unbehandelter Fehler");
  res.status(500).json({ error: "Interner Serverfehler." });
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "CryptoShop Backend gestartet");
  startPaymentPoller();
});
