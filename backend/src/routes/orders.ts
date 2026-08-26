import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";

export const ordersRouter = Router();

const tokenSchema = z.string().uuid();

/**
 * Öffentlicher Bestellstatus-Abruf über den unerratbaren order_token.
 * Liefert bewusst NUR nicht-sensible Metadaten – niemals den
 * verschlüsselten Payload oder Klardaten.
 */
ordersRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const parsed = tokenSchema.safeParse(req.params.token);
    if (!parsed.success) return res.status(400).json({ error: "Ungültiger Bestell-Token." });

    const { rows } = await pool.query(
      `SELECT status, confirmations, required_confirmations, payment_method,
            payment_address, amount_crypto, amount_eur, expires_at, created_at
     FROM orders WHERE order_token = $1`,
      [parsed.data]
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
    res.json(order);
  })
);
