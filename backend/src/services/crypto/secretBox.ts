import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../../lib/env.ts";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const key = Buffer.from(env.TOTP_ENCRYPTION_KEY, "hex");

if (key.length !== 32) {
  throw new Error("TOTP_ENCRYPTION_KEY muss exakt 32 Byte lang sein.");
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) {
    // Legacy-Klartext: nur für die automatische Migration bestehender
    // Admin-Konten. Neue Konten werden ausschließlich verschlüsselt angelegt.
    return value;
  }

  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (raw.length < 29) {
    throw new Error("Verschlüsseltes Secret ist beschädigt.");
  }

  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
