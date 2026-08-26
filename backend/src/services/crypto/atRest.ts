import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { env } from "../../lib/env.ts";

/**
 * Verschlüsselung "at rest" auf DB-Spaltenebene (AES-256-GCM).
 *
 * Wichtig: Dies ersetzt NICHT die PGP-Verschlüsselung — der PGP-Blob
 * (nur mit dem privaten Betreiber-Key entschlüsselbar) ist bereits das,
 * was hier zusätzlich mit AES verschlüsselt wird. Ziel: Schutz falls
 * die Datenbank selbst kompromittiert/exfiltriert wird (Defense in Depth),
 * der AT_REST_KEY lebt nur im Backend-Prozessspeicher/Secret-Store.
 */

const ALGO = "aes-256-gcm";
const key = Buffer.from(env.AT_REST_KEY, "hex");

if (key.length !== 32) {
  throw new Error("AT_REST_KEY muss exakt 32 Byte (64 Hex-Zeichen) lang sein");
}

export function encryptAtRest(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptAtRest(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
