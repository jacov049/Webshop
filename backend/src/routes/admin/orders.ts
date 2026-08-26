import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.ts";
import { requireAdmin } from "../../middleware/auth.ts";
import { requireCsrf } from "../../middleware/csrf.ts";
import { decryptAtRest } from "../../services/crypto/atRest.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { releaseStockForOrder } from "../../services/stock.ts";

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdmin);

/**
 * Liefert Bestellungen inkl. PGP-Blob (nach Entschlüsselung der
 * "at rest"-Schicht). Der PGP-Blob selbst bleibt für das Backend
 * unlesbar – die eigentliche Entschlüsselung passiert ausschließlich
 * lokal im Browser des Admins mit dessen privatem PGP-Key.
 */
adminOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const { rows } = await pool.query(
      `SELECT id, order_token, encrypted_payload, payment_method, payment_address,
            amount_crypto, amount_eur, status, confirmations, required_confirmations,
            created_at, expires_at
     FROM orders
     WHERE $1::text IS NULL OR status = $1
     ORDER BY created_at DESC
     LIMIT 200`,
      [statusFilter ?? null]
    );

    const orders = rows.map((row) => ({
      ...row,
      encrypted_payload: decryptAtRest(row.encrypted_payload)
    }));
    res.json(orders);
  })
);

const statusSchema = z.object({
  status: z.enum(["pending", "confirming", "paid", "expired", "shipped", "cancelled"])
});

adminOrdersRouter.patch(
  "/:id/status",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ungültiger Status." });
    const result = await pool.query(`UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`, [
      parsed.data.status,
      req.params.id
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Bestellung nicht gefunden." });

    // Bei Storno/Ablauf reservierten Lagerbestand zurückbuchen
    // (idempotent über orders.stock_released).
    if (parsed.data.status === "cancelled" || parsed.data.status === "expired") {
      await releaseStockForOrder(req.params.id as string);
    }

    res.json({ ok: true });
  })
);
