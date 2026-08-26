import { z } from "zod";

const csvToArray = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET muss >= 32 Zeichen sein"),
  AT_REST_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "AT_REST_KEY muss ein 32-Byte-Hex-Key (64 Hex-Zeichen) sein"),
  // Anzahl der Reverse-Proxy-Hops vor der Anwendung. Hinter Caddy: 1.
  // 0 = direkt exponiert (X-Forwarded-For wird dann NICHT ausgewertet,
  // da sonst jeder Client seine Quell-IP fürs Rate-Limiting fälschen könnte).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  // Erlaubte Cross-Origin-Herkünfte (kommasepariert). Produktion: leer
  // lassen – Shop, Admin-Panel und API laufen dann jeweils same-origin
  // (siehe infra/Caddyfile), CORS wird nicht benötigt.
  CORS_ORIGINS: z.string().default("").transform(csvToArray),
  // Kursquelle EUR -> BTC/XMR (öffentliche API, ohne Nutzerbezug).
  // Austauschbar, z.B. gegen eine selbst gehostete Preisquelle.
  RATES_API_URL: z
    .string()
    .url()
    .default("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero&vs_currencies=eur"),
  BTC_XPUB: z.string().optional(),
  BTC_ESPLORA_URL: z.string().default("https://blockstream.info/api"),
  BTC_REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(2),
  XMR_WALLET_RPC_URL: z.string().default("http://127.0.0.1:18083/json_rpc"),
  XMR_REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(10),
  PAYMENT_WINDOW_MINUTES: z.coerce.number().int().positive().default(30),
  ORDER_RETENTION_YEARS: z.coerce.number().int().positive().default(10),
  CONTACT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  PGP_PUBLIC_KEY_FINGERPRINT: z.string().optional()
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Ungültige Umgebungsvariablen:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment-Validierung fehlgeschlagen");
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";

/**
 * Cookie-Optionen für Session-/CSRF-Cookies.
 *
 * In Produktion: Secure + "__Host-"-Präfix (bindet das Cookie an genau
 * diesen Origin, kein Domain-Attribut, Path=/). In der lokalen Entwicklung
 * über http:// wäre ein Secure-Cookie vom Browser abgelehnt worden –
 * deshalb dort ohne Secure und ohne "__Host-"-Präfix.
 */
export const ADMIN_COOKIE_NAME = isProduction
  ? "__Host-cryptoshop_admin"
  : "cryptoshop_admin_dev";

export const CSRF_COOKIE_NAME = isProduction ? "__Host-cryptoshop_csrf" : "cryptoshop_csrf_dev";

export const secureCookies = isProduction;
