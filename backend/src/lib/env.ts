import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET muss >= 32 Zeichen sein"),
  AT_REST_KEY: z
    .string()
    .min(64, "AT_REST_KEY muss ein 32-Byte-Hex-Key (64 Zeichen) sein"),
  ADMIN_COOKIE_NAME: z.string().default("__Host-cryptoshop_admin"),
  BTC_XPUB: z.string().optional(),
  BTC_ESPLORA_URL: z.string().default("https://blockstream.info/api"),
  BTC_REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(2),
  XMR_WALLET_RPC_URL: z.string().default("http://127.0.0.1:18083/json_rpc"),
  XMR_REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(10),
  PAYMENT_WINDOW_MINUTES: z.coerce.number().int().positive().default(30),
  ORDER_RETENTION_YEARS: z.coerce.number().int().positive().default(10),
  CONTACT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
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
