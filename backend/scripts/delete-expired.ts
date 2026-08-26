import { pool } from "../src/db/pool.ts";
import { logger } from "../src/lib/logger.ts";
import { env } from "../src/lib/env.ts";
import { runRetentionCleanup } from "../src/services/retention.ts";

/**
 * Manueller Anstoß des Löschkonzepts (Konzept Abschnitt 9).
 *
 * Im Normalbetrieb ist das nicht nötig: das Backend führt denselben
 * Löschlauf automatisch alle 6 Stunden aus (siehe
 * src/services/retention.ts). Dieses Skript dient für Ad-hoc-Läufe,
 * einen externen Cronjob oder zur Kontrolle:
 *   docker compose exec backend npm run delete-expired
 */
async function main() {
  const result = await runRetentionCleanup();
  logger.info({ ...result, retentionDays: env.DATA_RETENTION_DAYS }, "Löschjob abgeschlossen");
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, "Löschjob fehlgeschlagen");
  process.exit(1);
});
