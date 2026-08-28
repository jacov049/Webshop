import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import argon2 from "argon2";
import { generateSecret, generateURI } from "otplib";
import { pool } from "../src/db/pool.ts";
import { encryptSecret } from "../src/services/crypto/secretBox.ts";

/**
 * CLI zum Anlegen eines Admin-Benutzers.
 * Aufruf: npm run create-admin
 * Gibt am Ende das TOTP-Secret + eine otpauth://-URL aus, die einmalig
 * in einer Authenticator-App hinterlegt werden muss.
 */
async function main() {
  const rl = createInterface({ input: stdin });
  const lines = rl[Symbol.asyncIterator]();

  async function ask(prompt: string): Promise<string> {
    stdout.write(prompt);
    const { value, done } = await lines.next();
    if (done) throw new Error("Eingabe unerwartet beendet.");
    return value.trim();
  }

  try {
    const username = await ask("Admin-Benutzername: ");
    const password = await ask("Admin-Passwort: ");
    if (!username || password.length < 12) {
      throw new Error("Benutzername darf nicht leer sein, Passwort muss >= 12 Zeichen haben.");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const totpSecret = generateSecret();
    const otpAuthUrl = generateURI({ issuer: "CryptoShop Admin", label: username, secret: totpSecret });

    await pool.query(
      `INSERT INTO admin_users (username, password_hash, totp_secret) VALUES ($1,$2,$3)`,
      [username, passwordHash, encryptSecret(totpSecret)]
    );

    console.log("\nAdmin-Benutzer angelegt.");
    console.log("TOTP-Secret (jetzt in Authenticator-App hinterlegen):", totpSecret);
    console.log("otpauth-URL (alternativ als QR-Code kodieren):", otpAuthUrl);
  } finally {
    rl.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fehler:", err instanceof Error ? err.message : err);
  process.exit(1);
});
