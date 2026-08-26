import pino from "pino";
import { env } from "./env.ts";

/**
 * Datensparsames Logging: IP-Adressen, Cookies und Authorization-Header
 * werden nie geloggt (siehe docs/datenschutz.md, Abschnitt Logging).
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.remoteAddress",
      "req.remotePort",
      "res.headers['set-cookie']"
    ],
    remove: true
  }
});
