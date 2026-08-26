import { pool } from "../db/pool.ts";
import { SETTING_DEFAULTS, SETTING_KEYS } from "../lib/siteSettings.ts";

/**
 * Liest die redaktionellen Website-Inhalte. Fehlende Schlüssel werden aus
 * den Defaults ergänzt, damit ein frisch migrierter oder teilweise
 * befüllter Shop nie mit leeren Rechtstexten ausgeliefert wird.
 * Unbekannte Schlüssel aus der DB werden ignoriert (Allowlist).
 */
export async function readSettings(): Promise<Record<string, string>> {
  const { rows } = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM site_settings WHERE key = ANY($1::text[])`,
    [SETTING_KEYS]
  );

  const settings: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

/** Schreibt geänderte Einstellungen (nur bekannte Schlüssel) atomar. */
export async function writeSettings(updates: Record<string, string>): Promise<void> {
  const entries = Object.entries(updates).filter(([key]) => SETTING_KEYS.includes(key));
  if (entries.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of entries) {
      await client.query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, value]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
