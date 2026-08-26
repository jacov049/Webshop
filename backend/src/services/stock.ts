import type { PoolClient } from "pg";
import { pool } from "../db/pool.ts";

/**
 * Bucht den bei der Bestellung reservierten Lagerbestand zurück.
 *
 * Wird aufgerufen, wenn eine Bestellung abläuft oder storniert wird.
 * `stock_released` verhindert doppelte Rückbuchung (z.B. wenn eine
 * abgelaufene Bestellung später zusätzlich manuell storniert wird);
 * die Zeile wird dafür per FOR UPDATE gesperrt.
 *
 * @returns true, wenn tatsächlich zurückgebucht wurde
 */
export async function releaseStockForOrder(orderId: string): Promise<boolean> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ stock_released: boolean }>(
      `SELECT stock_released FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = rows[0];
    if (!order || order.stock_released) {
      await client.query("COMMIT");
      return false;
    }

    await client.query(
      `UPDATE products p
         SET stock = p.stock + oi.quantity, updated_at = now()
       FROM order_items oi
       WHERE oi.order_id = $1 AND oi.product_id = p.id`,
      [orderId]
    );
    await client.query(`UPDATE orders SET stock_released = true WHERE id = $1`, [orderId]);

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
