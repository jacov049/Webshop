import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export function issueCsrfCookie(req: Request, res: Response) {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (existing) return existing as string;
  const token = randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // muss von JS gelesen werden, um es als Header zu senden (Double-Submit-Cookie-Pattern)
    secure: true,
    sameSite: "strict",
    path: "/"
  });
  return token;
}

/** Double-Submit-Cookie CSRF-Schutz für alle state-changing Endpoints. */
export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.header(CSRF_HEADER);
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: "CSRF-Token fehlt." });
  }
  const a = Buffer.from(String(cookieToken));
  const b = Buffer.from(String(headerToken));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "CSRF-Token ungültig." });
  }
  next();
}
