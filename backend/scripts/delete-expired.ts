import { pool } from "../src/db/pool.ts";
import { logger } from "../src/lib/logger.ts";

/**
 * Löschjob gemäß Datenlöschkonzept (Konzept Abschnitt 9): entfernt
 * Bestellungen und Kontaktanfragen, deren Aufbewahrungsfrist
 * (`deletion_due`) abgelaufen ist. Für den Produktivbetrieb als täglicher
 * Cronjob einplanen, z.B.:
 *   0 3 * * * cd /opt/cryptoshop/backend && node dist/../scripts/delete-expired.js
 * bzw. in Docker: `docker compose exec backend npm run delete-expired`.
 *
 * Bewahrt Bestellungen mit offener Zahlung (`deletion_due` erst nach
 * Anlage gesetzt, siehe checkout.ts) und respektiert damit die
 * steuerrechtliche Aufbewahrungspflicht (§ 147 AO) sowie die kurze
 * Nachfrist für abgeschlossene Kontaktanfragen.
 */
async function main() {
  const orders = await pool.query(
    `DELETE FROM orders WHERE deletion_due IS NOT NULL AND deletion_due < now()`
  );
  const contacts = await pool.query(
    `DELETE FROM contact_requests WHERE deletion_due IS NOT NULL AND deletion_due < now()`
  );
  // Abgelaufene Admin-Sessions sind wertlos und würden sonst unbegrenzt
  // in der Tabelle liegen bleiben.
  const sessions = await pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
  logger.info(
    {
      deletedOrders: orders.rowCount,
      deletedContacts: contacts.rowCount,
      deletedSessions: sessions.rowCount
    },
    "Löschjob abgeschlossen"
  );
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, "Löschjob fehlgeschlagen");
  process.exit(1);
});
