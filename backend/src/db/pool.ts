import pg from "pg";
import { env } from "../lib/env.ts";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unerwarteter Fehler im PostgreSQL-Pool", err);
});
