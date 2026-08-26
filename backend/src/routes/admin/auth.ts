import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
import { verify as verifyOtp } from "otplib";
import { pool } from "../../db/pool.ts";
import { env } from "../../lib/env.ts";
import { logger } from "../../lib/logger.ts";
import { rateLimit } from "../../middleware/rateLimit.ts";
import { requireCsrf } from "../../middleware/csrf.ts";
import { hashToken, requireAdmin } from "../../middleware/auth.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";

export const adminAuthRouter = Router();

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4h Session-Timeout

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  totpCode: z.string().regex(/^\d{6}$/, "TOTP-Code muss 6-stellig sein.")
});

adminAuthRouter.post(
  "/login",
  rateLimit({ windowMs: 60_000, max: 5 }),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ungültige Anfrage." });
    const { username, password, totpCode } = parsed.data;

    const { rows } = await pool.query(
      `SELECT id, password_hash, totp_secret FROM admin_users WHERE username = $1`,
      [username]
    );
    const user = rows[0];

    // Konstante Fehlerantwort unabhängig davon, ob Username existiert
    // (kein User-Enumeration-Leak). Dummy-Hash-Verify hält die Timing-Kosten
    // vergleichbar.
    const dummyHash =
      "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const passwordOk = await argon2.verify(user?.password_hash ?? dummyHash, password).catch(() => false);
    const totpOk = user
      ? await verifyOtp({ secret: user.totp_secret, token: totpCode })
          .then((r) => r.valid)
          .catch(() => false)
      : false;

    if (!user || !passwordOk || !totpOk) {
      logger.warn("Fehlgeschlagener Admin-Login-Versuch");
      return res.status(401).json({ error: "Anmeldung fehlgeschlagen." });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await pool.query(
      `INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
      [user.id, hashToken(token), expiresAt]
    );

    res.cookie(env.ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      expires: expiresAt
    });
    res.json({ ok: true });
  })
);

adminAuthRouter.post(
  "/logout",
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[env.ADMIN_COOKIE_NAME];
    if (token) {
      await pool.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [hashToken(token)]);
    }
    res.clearCookie(env.ADMIN_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  })
);

adminAuthRouter.get(
  "/me",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ ok: true });
  })
);
