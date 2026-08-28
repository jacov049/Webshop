import { readPage, pageResult } from "../../lib/pagination.ts";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.ts";
import { requireAdmin } from "../../middleware/auth.ts";
import { requireCsrf } from "../../middleware/csrf.ts";
import { decryptAtRest } from "../../services/crypto/atRest.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { changeOrderStatus, OrderStateError } from "../../services/stock.ts";

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
    let page;
    try { page = readPage(req.query); } catch { return res.status(400).json({ error: "Ungültige Seitenauswahl" }); }
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const { rows } = await pool.query(
      `SELECT o.id, order_token, encrypted_payload, payment_method, payment_address,
            amount_crypto, amount_eur, status, confirmations, required_confirmations,
            o.created_at, expires_at,
            COALESCE((SELECT json_agg(json_build_object('product_id', oi.product_id,
              'name', oi.product_name, 'unit_price_eur', oi.unit_price_eur::text, 'quantity', oi.quantity) ORDER BY oi.id)
              FROM order_items oi WHERE oi.order_id=o.id), '[]'::json) AS items
     FROM orders o
     WHERE ($1::text IS NULL OR status = $1)
       AND ($2::timestamptz IS NULL OR (o.created_at, o.id) < ($2::timestamptz, $3::uuid))
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT $4`,
      [statusFilter ?? null, page.at, page.id, page.limit + 1]
    );

    const orders = rows.map((row) => ({
      ...row,
      encrypted_payload: decryptAtRest(row.encrypted_payload)
    }));
    res.json(pageResult(orders, page.limit));
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
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: "Ungültige ID" });
    try { await changeOrderStatus(req.params.id as string, parsed.data.status); }
    catch (error) { if (error instanceof OrderStateError) return res.status(error.status).json({ error: error.message }); throw error; }
    res.json({ ok: true });
  })
);
