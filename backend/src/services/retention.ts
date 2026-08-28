import { repairReleasedStock } from "./stock.ts";
import { pool } from "../db/pool.ts";
import { env } from "../lib/env.ts";
import { logger } from "../lib/logger.ts";

/**
 * Automatisches Löschkonzept.
 *
 * Alle kundenbezogenen Shop-Datensätze werden nach DATA_RETENTION_DAYS
 * Tagen gelöscht, gerechnet ab `created_at`. Dadurch wirkt eine geänderte
 * Frist auch auf bereits vorhandene Datensätze.
 *
 * WICHTIG: Dieser operative Löschjob ist kein Ersatz für eine gesetzlich
 * erforderliche Buchführungs-/Rechnungsarchivierung. Stand 2026 gelten für
 * Buchungsbelege und Rechnungen regelmäßig 8 Jahre (§ 147 AO, § 257 HGB,
 * § 14b UStG), für bestimmte andere Unterlagen weiterhin längere oder
 * kürzere Fristen. Fristbeginn und konkret aufzubewahrende Daten sind
 * gesondert zu prüfen; siehe docs/datenschutz.md.
 */
export interface RetentionResult {
  deletedOrders: number;
  deletedContacts: number;
  deletedSessions: number;
}

export async function runRetentionCleanup(): Promise<RetentionResult> {
  const days = env.DATA_RETENTION_DAYS;

  await repairReleasedStock();
  // Unresolved orders must be reconciled, not silently deleted with reserved inventory.
  const orders = await pool.query(
    `DELETE FROM orders WHERE created_at < now() - ($1 * INTERVAL '1 day')
       AND (status='shipped' OR (status IN ('expired','cancelled') AND stock_released))`,
    [days]
  );

  const contacts = await pool.query(
    `DELETE FROM contact_requests
      WHERE created_at < now() - ($1 * INTERVAL '1 day')
         OR (status = 'answered' AND deletion_due IS NOT NULL AND deletion_due < now())`,
    [days]
  );

  const sessions = await pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);

  return {
    deletedOrders: orders.rowCount ?? 0,
    deletedContacts: contacts.rowCount ?? 0,
    deletedSessions: sessions.rowCount ?? 0
  };
}

export function deletionDueFromNow(): Date {
  return new Date(Date.now() + env.DATA_RETENTION_DAYS * 86_400_000);
}

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await runRetentionCleanup();
    if (result.deletedOrders > 0 || result.deletedContacts > 0 || result.deletedSessions > 0) {
      logger.info({ ...result, retentionDays: env.DATA_RETENTION_DAYS }, "Löschjob ausgeführt");
    }
  } catch (err) {
    logger.error({ err }, "Löschjob fehlgeschlagen");
  } finally {
    running = false;
  }
}

export function startRetentionScheduler(intervalMs = 6 * 60 * 60 * 1000) {
  if (timer) return;
  setTimeout(tick, 10_000).unref();
  timer = setInterval(tick, intervalMs);
  timer.unref();
  logger.info(
    { intervalMs, retentionDays: env.DATA_RETENTION_DAYS },
    "Automatischer Löschjob gestartet"
  );
}

export function stopRetentionScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
