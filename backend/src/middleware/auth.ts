import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { pool } from "../db/pool.ts";
import { ADMIN_COOKIE_NAME } from "../lib/env.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";

declare module "express-serve-static-core" {
  interface Request {
    adminUserId?: string;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export { hashToken };

/** Prüft die Admin-Session anhand des gehashten Session-Tokens (Cookie). */
export const requireAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Nicht angemeldet." });

  const tokenHash = hashToken(token);
  const result = await pool.query<{ admin_user_id: string; expires_at: Date }>(
    "SELECT admin_user_id, expires_at FROM admin_sessions WHERE token_hash = $1",
    [tokenHash]
  );
  const session = result.rows[0];
  if (!session || session.expires_at.getTime() < Date.now()) {
    return res.status(401).json({ error: "Sitzung abgelaufen." });
  }
  req.adminUserId = session.admin_user_id;
  next();
});
