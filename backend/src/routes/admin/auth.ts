import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
import { verify as verifyOtp } from "otplib";
import { pool } from "../../db/pool.ts";
import { ADMIN_COOKIE_NAME, secureCookies } from "../../lib/env.ts";
import { logger } from "../../lib/logger.ts";
import { rateLimit } from "../../middleware/rateLimit.ts";
import { requireCsrf } from "../../middleware/csrf.ts";
import { hashToken, requireAdmin } from "../../middleware/auth.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "../../services/crypto/secretBox.ts";

export const adminAuthRouter = Router();

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const dummyHashPromise = argon2.hash(randomBytes(32).toString("hex"), { type: argon2.argon2id });

const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const USERNAME_WINDOW_MS = 15 * 60 * 1000;
const USERNAME_MAX_FAILURES = 10;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failedAttempts) {
    if (entry.resetAt < now) failedAttempts.delete(key);
  }
}, 60_000).unref();

function isUsernameLocked(username: string): boolean {
  const entry = failedAttempts.get(username);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    failedAttempts.delete(username);
    return false;
  }
  return entry.count >= USERNAME_MAX_FAILURES;
}

function recordFailure(username: string) {
  const now = Date.now();
  const entry = failedAttempts.get(username);
  if (!entry || entry.resetAt < now) {
    failedAttempts.set(username, { count: 1, resetAt: now + USERNAME_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

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

    if (isUsernameLocked(username)) {
      logger.warn("Admin-Login vorübergehend gesperrt (zu viele Fehlversuche)");
      return res.status(429).json({ error: "Zu viele Fehlversuche. Bitte später erneut versuchen." });
    }

    const { rows } = await pool.query<{
      id: string;
      password_hash: string;
      totp_secret: string;
    }>(`SELECT id, password_hash, totp_secret FROM admin_users WHERE username = $1`, [username]);
    const user = rows[0];

    const passwordOk = await argon2
      .verify(user?.password_hash ?? (await dummyHashPromise), password)
      .catch(() => false);

    let totpSecret: string | null = null;
    if (user) {
      try {
        totpSecret = decryptSecret(user.totp_secret);
      } catch (err) {
        logger.error({ err, adminUserId: user.id }, "TOTP-Secret konnte nicht entschlüsselt werden");
      }
    }

    const totpOk = totpSecret
      ? await verifyOtp({ secret: totpSecret, token: totpCode })
          .then((r) => r.valid)
          .catch(() => false)
      : false;

    if (!user || !passwordOk || !totpOk) {
      recordFailure(username);
      logger.warn("Fehlgeschlagener Admin-Login-Versuch");
      return res.status(401).json({ error: "Anmeldung fehlgeschlagen." });
    }

    // Bestehende Installationen können noch Klartext-TOTP-Secrets besitzen.
    // Nach einer erfolgreichen Zwei-Faktor-Anmeldung werden sie atomar in
    // das neue verschlüsselte Format überführt.
    if (!isEncryptedSecret(user.totp_secret) && totpSecret) {
      await pool.query(`UPDATE admin_users SET totp_secret = $1 WHERE id = $2 AND totp_secret = $3`, [
        encryptSecret(totpSecret),
        user.id,
        user.totp_secret
      ]);
    }

    failedAttempts.delete(username);

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await pool.query(
      `INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
      [user.id, hashToken(token), expiresAt]
    );

    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: secureCookies,
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
    const token = req.cookies?.[ADMIN_COOKIE_NAME];
    if (token) {
      await pool.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [hashToken(token)]);
    }
    res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
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
