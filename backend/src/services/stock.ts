import type { PoolClient } from "pg";
import { pool } from "../db/pool.ts";

export const transitions: Record<string, readonly string[]> = {
  pending: ["cancelled"], confirming: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"], shipped: [], expired: [], cancelled: []
};
export class OrderStateError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

/** Caller owns the order lock and transaction. SUM also repairs legacy duplicate items. */
export async function releaseStock(client: PoolClient, orderId: string): Promise<void> {
  await client.query(`SELECT id FROM products WHERE id IN
    (SELECT product_id FROM order_items WHERE order_id=$1) ORDER BY id FOR UPDATE`, [orderId]);
  await client.query(`UPDATE products p SET stock=p.stock+q.quantity, updated_at=now()
    FROM (SELECT product_id, SUM(quantity)::int AS quantity FROM order_items
          WHERE order_id=$1 GROUP BY product_id) q WHERE p.id=q.product_id`, [orderId]);
  await client.query("UPDATE orders SET stock_released=true WHERE id=$1", [orderId]);
}

/** Status and inventory commit together. Terminal orders cannot silently be reopened. */
export async function changeOrderStatus(id: string, next: string, expiryGraceSeconds?: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT status, stock_released,
      (expires_at + ($2::int * interval '1 second') < now()
       AND last_payment_check_at >= expires_at
       AND last_payment_check_at >= now()-($2::int * interval '1 second')) AS may_expire
      FROM orders WHERE id=$1 FOR UPDATE`, [id, expiryGraceSeconds ?? 0]);
    const order = rows[0];
    if (!order) throw new OrderStateError("Bestellung nicht gefunden", 404);
    if (expiryGraceSeconds !== undefined) {
      if (next !== "expired" || order.status !== "pending" || !order.may_expire) {
        await client.query("COMMIT"); return false;
      }
    } else if (order.status !== next && !transitions[order.status]?.includes(next)) {
      throw new OrderStateError("Statuswechsel nicht erlaubt. Neue Bestellung statt Wiederöffnung anlegen.");
    }
    if ((next === "expired" || next === "cancelled") && !order.stock_released) await releaseStock(client, id);
    await client.query("UPDATE orders SET status=$2, updated_at=now() WHERE id=$1", [id, next]);
    await client.query("COMMIT"); return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

/** Retry historical interrupted releases before retention deletes their item records. */
export async function repairReleasedStock(): Promise<void> {
  const { rows } = await pool.query("SELECT id, status FROM orders WHERE status IN ('expired','cancelled') AND NOT stock_released");
  for (const row of rows) await changeOrderStatus(row.id, row.status);
}
