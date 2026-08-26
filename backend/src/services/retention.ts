import { pool } from "../db/pool.ts";
import { env } from "../lib/env.ts";
import { logger } from "../lib/logger.ts";

/**
 * Automatisches Löschkonzept (Konzept Abschnitt 9).
 *
 * Alle kundenbezogenen Daten werden nach DATA_RETENTION_DAYS Tagen
 * unwiderruflich gelöscht – gerechnet ab `created_at`, nicht anhand des
 * beim Anlegen gespeicherten `deletion_due`. Dadurch wirkt eine geänderte
 * Frist sofort auch auf bereits vorhandene Datensätze, statt erst für
 * künftige zu greifen.
 *
 * Nicht betroffen sind Artikelstammdaten und die im Admin-Panel
 * gepflegten Website-Texte: das sind Inhalte des Betreibers, keine
 * Kundendaten. Würden sie mitgelöscht, wäre der Shop nach zwei Wochen
 * leer.
 *
 * Rechtlicher Hinweis: § 147 AO / § 257 HGB verlangen für Rechnungsdaten
 * 10 Jahre Aufbewahrung. Siehe docs/datenschutz.md.
 */
export interface RetentionResult {
  deletedOrders: number;
  deletedContacts: number;
  deletedSessions: number;
}

export async function runRetentionCleanup(): Promise<RetentionResult> {
  const days = env.DATA_RETENTION_DAYS;

  // order_items hängen per ON DELETE CASCADE an orders und verschwinden
  // damit automatisch mit der Bestellung.
  const orders = await pool.query(
    `DELETE FROM orders WHERE created_at < now() - ($1 * INTERVAL '1 day')`,
    [days]
  );

  // Kontaktanfragen zusätzlich früher, sobald sie beantwortet wurden und
  // die kurze Nachfrist abgelaufen ist.
  const contacts = await pool.query(
    `DELETE FROM contact_requests
      WHERE created_at < now() - ($1 * INTERVAL '1 day')
         OR (status = 'answered' AND deletion_due IS NOT NULL AND deletion_due < now())`,
    [days]
  );

  // Abgelaufene Admin-Sessions sind wertlos und würden sonst unbegrenzt
  // in der Tabelle liegen bleiben.
  const sessions = await pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);

  return {
    deletedOrders: orders.rowCount ?? 0,
    deletedContacts: contacts.rowCount ?? 0,
    deletedSessions: sessions.rowCount ?? 0
  };
}

/** Zeitpunkt, zu dem ein jetzt angelegter Datensatz gelöscht wird. */
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

/**
 * Startet den automatischen Löschjob im Backend-Prozess. Damit greift das
 * Löschkonzept auch ohne extern eingerichteten Cronjob; das CLI-Skript
 * `npm run delete-expired` bleibt für manuelle Läufe verfügbar.
 */
export function startRetentionScheduler(intervalMs = 6 * 60 * 60 * 1000) {
  if (timer) return;
  // Erster Lauf kurz nach dem Start, damit überfällige Daten nicht bis
  // zum ersten Intervall liegen bleiben (z.B. nach längerem Stillstand).
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
