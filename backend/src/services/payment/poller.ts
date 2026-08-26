import { pool } from "../../db/pool.ts";
import { logger } from "../../lib/logger.ts";
import { env } from "../../lib/env.ts";
import { getBtcPaymentStatus, satsToBtc } from "./btc.ts";
import { getXmrPaymentStatus, atomicToXmr } from "./xmr.ts";

interface OpenOrder {
  id: string;
  payment_method: "BTC" | "XMR";
  payment_address: string;
  derivation_index: number | null;
  amount_crypto: string;
  required_confirmations: number;
  expires_at: Date;
}

async function pollOrder(order: OpenOrder) {
  try {
    let confirmations = 0;
    let receivedEnough = false;

    if (order.payment_method === "BTC") {
      const { receivedSats, confirmations: conf } = await getBtcPaymentStatus(
        order.payment_address
      );
      confirmations = conf;
      receivedEnough = satsToBtc(receivedSats) >= Number(order.amount_crypto) * 0.995; // 0.5% Toleranz
    } else {
      const { receivedAtomic, confirmations: conf } = await getXmrPaymentStatus(
        order.derivation_index ?? 0
      );
      confirmations = conf;
      receivedEnough = atomicToXmr(receivedAtomic) >= Number(order.amount_crypto) * 0.995;
    }

    let status: string | null = null;
    if (receivedEnough && confirmations >= order.required_confirmations) {
      status = "paid";
    } else if (receivedEnough || confirmations > 0) {
      status = "confirming";
    } else if (order.expires_at.getTime() < Date.now()) {
      status = "expired";
    }

    if (status) {
      await pool.query(
        `UPDATE orders SET confirmations = $1, status = $2, updated_at = now()
         WHERE id = $3 AND status NOT IN ('paid','shipped','cancelled')`,
        [confirmations, status, order.id]
      );
    } else {
      await pool.query(
        `UPDATE orders SET confirmations = $1, updated_at = now()
         WHERE id = $2 AND status NOT IN ('paid','shipped','cancelled')`,
        [confirmations, order.id]
      );
    }
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Fehler beim Polling einer Bestellung");
  }
}

async function pollOpenOrders() {
  const { rows } = await pool.query<OpenOrder>(
    `SELECT id, payment_method, payment_address, derivation_index, amount_crypto,
            required_confirmations, expires_at
     FROM orders
     WHERE status IN ('pending','confirming')`
  );
  for (const order of rows) {
    // sequentiell, um öffentliche Nodes/APIs nicht zu überlasten
    await pollOrder(order);
  }
}

let pollTimer: NodeJS.Timeout | null = null;

export function startPaymentPoller(intervalMs = 30_000) {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    pollOpenOrders().catch((err) => logger.error({ err }, "Poller-Durchlauf fehlgeschlagen"));
  }, intervalMs);
  pollTimer.unref();
  logger.info({ intervalMs, btcConf: env.BTC_REQUIRED_CONFIRMATIONS }, "Zahlungs-Poller gestartet");
}

export function stopPaymentPoller() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
