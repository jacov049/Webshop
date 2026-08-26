import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.ts";
import { logger } from "../lib/logger.ts";
import { SETTING_DEFINITIONS } from "../lib/siteSettings.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);

    // Redaktionelle Inhalte erstbefüllen. ON CONFLICT DO NOTHING sorgt
    // dafür, dass im Admin-Panel geänderte Texte bei einer erneuten
    // Migration nicht überschrieben werden.
    for (const definition of SETTING_DEFINITIONS) {
      await client.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [definition.key, definition.default]
      );
    }

    await client.query("COMMIT");
    logger.info(
      { seededSettings: SETTING_DEFINITIONS.length },
      "Migration erfolgreich angewendet"
    );
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Migration fehlgeschlagen");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
