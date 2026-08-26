import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.ts";
import { logger } from "../lib/logger.ts";
import { env } from "../lib/env.ts";
import { requireCsrf } from "../middleware/csrf.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";
import { encryptAtRest } from "../services/crypto/atRest.ts";
import { deriveBtcAddress } from "../services/payment/btc.ts";
import { createXmrSubaddress } from "../services/payment/xmr.ts";
import { eurToBtc, eurToXmr, RateUnavailableError } from "../services/payment/rates.ts";

export const checkoutRouter = Router();

const PGP_MESSAGE_RE = /^-----BEGIN PGP MESSAGE-----[\s\S]+-----END PGP MESSAGE-----\s*$/;

const checkoutSchema = z.object({
  // Name/Adresse/Artikel sind bereits clientseitig mit dem PGP-Public-Key
  // des Betreibers verschlüsselt worden (openpgp.js) – das Backend sieht
  // hier nur einen undurchsichtigen, signierten Blob.
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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Preise NIE vom Client übernehmen – serverseitig neu berechnen und
      // gleichzeitig Lagerbestand atomar reservieren.
      let amountEur = 0;
      for (const item of items) {
        const { rows } = await client.query(
          `SELECT price_eur, stock FROM products WHERE id = $1 AND active = true FOR UPDATE`,
          [item.productId]
        );
        const product = rows[0];
        if (!product) throw new HttpError(400, `Artikel ${item.productId} nicht verfügbar.`);
        if (product.stock < item.quantity) {
          throw new HttpError(409, "Nicht genügend Lagerbestand für einen Artikel.");
        }
        amountEur += Number(product.price_eur) * item.quantity;
        await client.query(`UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2`, [
          item.quantity,
          item.productId
        ]);
      }

      let paymentAddress: string;
      let derivationIndex: number | null = null;
      let amountCrypto: number;

      if (paymentMethod === "BTC") {
        const seq = await client.query<{ nextval: string }>(
          "SELECT nextval('btc_derivation_index_seq')"
        );
        derivationIndex = Number(seq.rows[0]?.nextval ?? "0");
        paymentAddress = deriveBtcAddress(derivationIndex);
        amountCrypto = await eurToBtc(amountEur);
      } else {
        const sub = await createXmrSubaddress(`order-${Date.now()}`);
        paymentAddress = sub.address;
        derivationIndex = sub.address_index;
        amountCrypto = await eurToXmr(amountEur);
      }

      const expiresAt = new Date(Date.now() + env.PAYMENT_WINDOW_MINUTES * 60_000);
      const deletionDue = new Date(Date.now());
      deletionDue.setFullYear(deletionDue.getFullYear() + env.ORDER_RETENTION_YEARS);

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

      // Positionen ohne Personenbezug festhalten, damit reservierter
      // Lagerbestand bei Ablauf/Storno automatisch zurückgebucht werden
      // kann (siehe services/payment/poller.ts).
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1,$2,$3)`,
          [order.id, item.productId, item.quantity]
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
