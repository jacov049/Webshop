import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.ts";
import { logger } from "../lib/logger.ts";
import { env } from "../lib/env.ts";
import { requireCsrf } from "../middleware/csrf.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";
import { encryptAtRest } from "../services/crypto/atRest.ts";
import { deletionDueFromNow } from "../services/retention.ts";
import { deriveBtcAddress } from "../services/payment/btc.ts";
import { createXmrSubaddress } from "../services/payment/xmr.ts";
import { decimalToUnits, quoteCrypto, unitsToDecimal } from "../services/payment/amounts.ts";
import { fetchRates, RateUnavailableError } from "../services/payment/rates.ts";

export const checkoutRouter = Router();

const PGP_MESSAGE_RE = /^-----BEGIN PGP MESSAGE-----[\s\S]+-----END PGP MESSAGE-----\s*$/;

const checkoutSchema = z.object({
  // Name/Adresse/Artikel sind bereits clientseitig mit dem PGP-Public-Key
  // des Betreibers verschlüsselt worden (openpgp.js). Der Blob ist
  // verschlüsselt und integritätsgeschützt, aber nicht vom Kunden signiert.
  encryptedPayload: z.string().min(1).max(20_000).regex(PGP_MESSAGE_RE, "Kein gültiger PGP-Blob."),
  paymentMethod: z.enum(["BTC", "XMR"]),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(99)
      })
    )
    .min(1)
    .max(50)
    .refine(items => new Set(items.map(i => i.productId)).size === items.length, "Doppelte Artikel-ID")
});

checkoutRouter.post(
  "/",
  rateLimit({ windowMs: 60_000, max: 10 }),
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ungültige Anfrage.", details: parsed.error.flatten() });
    }
    const { encryptedPayload, paymentMethod, items } = parsed.data;

    // All carts lock products in the same order. No network call occurs while stock is locked.
    items.sort((a, b) => a.productId.localeCompare(b.productId));
    let rates;
    let sub;
    try {
      rates = await fetchRates();
      if (paymentMethod === "XMR") sub = await createXmrSubaddress(`order-${Date.now()}`);
    } catch {
      return res.status(503).json({ error: "Zahlungsdienst derzeit nicht verfügbar. Bitte später erneut versuchen." });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let cents = 0n;
      const snapshots: { productId: string; quantity: number; name: string; price: string }[] = [];
      for (const item of items) {
        const { rows } = await client.query(
          `SELECT name, price_eur, stock FROM products WHERE id = $1 AND active = true FOR UPDATE`,
          [item.productId]
        );
        const product = rows[0];
        if (!product) throw new HttpError(400, `Artikel ${item.productId} nicht verfügbar.`);
        if (product.stock < item.quantity) {
          throw new HttpError(409, "Nicht genügend Lagerbestand für einen Artikel.");
        }
        cents += decimalToUnits(product.price_eur, 2) * BigInt(item.quantity);
        snapshots.push({ ...item, name: product.name, price: product.price_eur });
        await client.query(`UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2`, [
          item.quantity,
          item.productId
        ]);
      }

      let paymentAddress: string;
      let derivationIndex: number | null = null;
      if (cents <= 0n || cents > 9999999999n) throw new HttpError(400, "Ungültiger Gesamtbetrag.");
      const amountEur = unitsToDecimal(cents, 2);
      let amountCrypto: string;

      if (paymentMethod === "BTC") {
        const seq = await client.query<{ nextval: string }>(
          "SELECT nextval('btc_derivation_index_seq')"
        );
        derivationIndex = Number(seq.rows[0]?.nextval ?? "0");
        paymentAddress = deriveBtcAddress(derivationIndex);
        amountCrypto = quoteCrypto(cents, rates.bitcoin.eur, 8);
      } else {
        if (!sub) throw new Error("XMR-Adresse fehlt");
        paymentAddress = sub.address;
        derivationIndex = sub.address_index;
        amountCrypto = quoteCrypto(cents, rates.monero.eur, 12);
      }

      const expiresAt = new Date(Date.now() + env.PAYMENT_WINDOW_MINUTES * 60_000);
      const deletionDue = deletionDueFromNow();

      const insert = await client.query<{ id: string; order_token: string }>(
        `INSERT INTO orders
        (encrypted_payload, payment_method, payment_address, derivation_index,
         amount_crypto, amount_eur, expires_at, deletion_due, required_confirmations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, order_token`,
        [
          encryptAtRest(encryptedPayload),
          paymentMethod,
          paymentAddress,
          derivationIndex,
          amountCrypto,
          amountEur,
          expiresAt,
          deletionDue,
          paymentMethod === "BTC" ? env.BTC_REQUIRED_CONFIRMATIONS : env.XMR_REQUIRED_CONFIRMATIONS
        ]
      );

      const order = insert.rows[0];
      if (!order) throw new Error("Bestellung konnte nicht angelegt werden.");

      for (const item of snapshots) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, product_name, unit_price_eur) VALUES ($1,$2,$3,$4,$5)`,
          [order.id, item.productId, item.quantity, item.name, item.price]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        orderToken: order.order_token,
        paymentAddress,
        amountCrypto,
        amountEur,
        paymentMethod,
        expiresAt
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      if (err instanceof RateUnavailableError) {
        logger.error({ err }, "Kursquelle nicht erreichbar – Checkout abgebrochen");
        return res.status(503).json({
          error: "Die Wechselkurse sind derzeit nicht abrufbar. Bitte später erneut versuchen."
        });
      }
      logger.error({ err }, "Checkout fehlgeschlagen");
      res.status(500).json({ error: "Bestellung konnte nicht angelegt werden." });
    } finally {
      client.release();
    }
  })
);

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
