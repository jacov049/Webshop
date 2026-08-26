import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env, isProduction } from "./lib/env.ts";
import { logger } from "./lib/logger.ts";
import { issueCsrfCookie } from "./middleware/csrf.ts";
import { productsRouter } from "./routes/products.ts";
import { checkoutRouter } from "./routes/checkout.ts";
import { ratesRouter } from "./routes/rates.ts";
import { ordersRouter } from "./routes/orders.ts";
import { contactRouter } from "./routes/contact.ts";
import { settingsRouter } from "./routes/settings.ts";
import { adminAuthRouter } from "./routes/admin/auth.ts";
import { adminProductsRouter } from "./routes/admin/products.ts";
import { adminOrdersRouter } from "./routes/admin/orders.ts";
import { adminContactRouter } from "./routes/admin/contact.ts";
import { adminSettingsRouter } from "./routes/admin/settings.ts";
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

app.disable("x-powered-by");

// Hinter dem Reverse Proxy muss X-Forwarded-For ausgewertet werden, damit
// das Rate-Limiting die echte Client-IP unterscheidet (sonst gilt das
// Limit für alle Besucher gemeinsam und der erste Bot sperrt den ganzen
// Shop aus). Die IP wird ausschließlich transient fürs Rate-Limiting
// verwendet und niemals geloggt oder gespeichert. Ohne Proxy bleibt der
// Wert 0, damit Clients ihre Quell-IP nicht per Header fälschen können.
app.set("trust proxy", env.TRUST_PROXY_HOPS);

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
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: isProduction ? { maxAge: 63_072_000, includeSubDomains: true } : false
  })
);

// CORS nur für explizit konfigurierte Herkünfte (lokale Entwicklung).
// In Produktion laufen Shop, Admin-Panel und API jeweils same-origin
// hinter Caddy – CORS_ORIGINS bleibt dann leer und es werden gar keine
// CORS-Header gesetzt.
if (env.CORS_ORIGINS.length > 0) {
  app.use((req, res, next) => {
    const origin = req.get("origin");
    res.setHeader("Vary", "Origin");
    if (origin && env.CORS_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

/**
 * Pfade für das Log normalisieren: Bestell-Tokens und IDs sind
 * Capability-Tokens bzw. Identifikatoren und haben in Logs nichts zu
 * suchen (Datensparsamkeit, siehe docs/datenschutz.md).
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
function safePath(url: string | undefined): string {
  const withoutQuery = (url ?? "").split("?")[0] ?? "";
  return withoutQuery.replace(UUID_RE, ":id");
}

app.use(
  pinoHttp({
    logger,
    // Keine IP-Adressen, Cookies, Query-Strings oder Tokens im Access-Log.
    serializers: {
      req: (req: IncomingMessage) => ({ method: req.method, path: safePath(req.url) }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode })
    }
  })
);

// Kleines Standardlimit gegen Speicher-DoS; die Bild-Upload-Route im
// Admin-Bereich hebt es gezielt an (siehe routes/admin/products.ts).
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: "7d",
    // Uploads werden serverseitig zu .webp normalisiert; kein Ausliefern
    // von Verzeichnislisten oder Dotfiles.
    dotfiles: "ignore",
    index: false
  })
);

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
app.use("/api/settings", settingsRouter);

app.use("/admin/auth", adminAuthRouter);
app.use("/admin/products", adminProductsRouter);
app.use("/admin/orders", adminOrdersRouter);
app.use("/admin/contact", adminContactRouter);
app.use("/admin/settings", adminSettingsRouter);

app.use((_req, res) => res.status(404).json({ error: "Nicht gefunden." }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Body-Parser-Fehler (zu großer oder ungültiger JSON-Body) sind
  // Client-Fehler, kein Serverfehler.
  const status = (err as { status?: number; type?: string })?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ error: "Ungültige Anfrage." });
  }
  logger.error({ err }, "Unbehandelter Fehler");
  res.status(500).json({ error: "Interner Serverfehler." });
});

app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, trustProxyHops: env.TRUST_PROXY_HOPS },
    "CryptoShop Backend gestartet"
  );
  startPaymentPoller();
});
