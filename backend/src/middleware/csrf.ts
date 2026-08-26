import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { CSRF_COOKIE_NAME, secureCookies, env } from "../lib/env.ts";

const CSRF_HEADER = "x-csrf-token";

export function issueCsrfCookie(req: Request, res: Response): string {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === "string" && existing.length >= 32) return existing;

  const token = randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE_NAME, token, {
    // Muss von JS lesbar sein, um als Header mitgeschickt zu werden
    // (Double-Submit-Cookie-Pattern). Der Wert ist kein Geheimnis im
    // Sinne einer Sitzung – er beweist nur, dass die Anfrage von einer
    // Seite desselben Origins stammt.
    httpOnly: false,
    secure: secureCookies,
    sameSite: "strict",
    path: "/"
  });
  return token;
}

/** Erlaubte Herkünfte für zustandsändernde Anfragen. */
function isAllowedOrigin(origin: string, req: Request): boolean {
  if (env.CORS_ORIGINS.includes(origin)) return true;
  // Same-Origin: Host-Header der Anfrage mit dem Origin vergleichen.
  const host = req.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * CSRF-Schutz für alle zustandsändernden Endpoints, zwei Schichten:
 *
 * 1. Origin-Prüfung: Browser setzen bei POST/PUT/PATCH/DELETE immer einen
 *    Origin-Header und dieser ist von Angreiferseite nicht fälschbar.
 * 2. Double-Submit-Token: Cookie-Wert muss mit dem X-CSRF-Token-Header
 *    übereinstimmen. Eine fremde Seite kann das Cookie nicht auslesen und
 *    den Header daher nicht korrekt setzen.
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && !isAllowedOrigin(origin, req)) {
    return res.status(403).json({ error: "Herkunft der Anfrage nicht erlaubt." });
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER);
  if (typeof cookieToken !== "string" || typeof headerToken !== "string") {
    return res.status(403).json({ error: "CSRF-Token fehlt." });
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "CSRF-Token ungültig." });
  }
  next();
}
