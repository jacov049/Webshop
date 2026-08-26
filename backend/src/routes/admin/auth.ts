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

export const adminAuthRouter = Router();

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4h Session-Timeout

/**
 * Vergleichs-Hash für nicht existierende Benutzernamen. Wird beim Start
 * mit den aktuellen argon2-Standardparametern erzeugt, damit der
 * Verifikationsaufwand exakt dem eines echten Treffers entspricht – ein
 * fest kodierter Hash mit abweichenden Kostenparametern wäre messbar
 * schneller und würde Benutzernamen-Enumeration über Timing erlauben.
 */
const dummyHashPromise = argon2.hash(randomBytes(32).toString("hex"), { type: argon2.argon2id });

/**
 * Zusätzliche Drosselung pro Benutzername (ergänzt das IP-Rate-Limit,
 * das ein Angreifer mit wechselnden IPs umgehen könnte).
 */
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
      return res
        .status(429)
        .json({ error: "Zu viele Fehlversuche. Bitte später erneut versuchen." });
    }

    const { rows } = await pool.query(
      `SELECT id, password_hash, totp_secret FROM admin_users WHERE username = $1`,
      [username]
    );
    const user = rows[0];

    // Konstante Fehlerantwort unabhängig davon, ob der Username existiert
    // (kein User-Enumeration-Leak). Beide Faktoren werden immer geprüft,
    // damit auch die Laufzeit vergleichbar bleibt.
    const passwordOk = await argon2
      .verify(user?.password_hash ?? (await dummyHashPromise), password)
      .catch(() => false);
    const totpOk = user
      ? await verifyOtp({ secret: user.totp_secret, token: totpCode })
          .then((r) => r.valid)
          .catch(() => false)
      : false;

    if (!user || !passwordOk || !totpOk) {
      recordFailure(username);
      logger.warn("Fehlgeschlagener Admin-Login-Versuch");
      return res.status(401).json({ error: "Anmeldung fehlgeschlagen." });
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
