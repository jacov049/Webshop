import { decimalToUnits, toleratedTarget, summarizePayments } from "./amounts.ts";
import { pool } from "../../db/pool.ts";
import { logger } from "../../lib/logger.ts";
import { env } from "../../lib/env.ts";
import { changeOrderStatus, repairReleasedStock } from "../stock.ts";
import { getBtcPayments } from "./btc.ts";
import { getXmrPayments } from "./xmr.ts";

interface OpenOrder {
  id: string;
  payment_method: "BTC" | "XMR";
  payment_address: string;
  derivation_index: number | null;
  amount_crypto: string;
  required_confirmations: number;
  expires_at: Date;
}

const EXPIRY_GRACE_MS = Math.max(60_000, env.PAYMENT_POLL_INTERVAL_MS * 2);

export async function pollOrder(order: OpenOrder) {
  let summary;

  if (order.payment_method === "BTC") {
    const target = toleratedTarget(decimalToUnits(order.amount_crypto, 8));
    const payments = await getBtcPayments(order.payment_address);
    summary = summarizePayments(
      payments.map((payment) => ({ amount: payment.amountSats, confirmations: payment.confirmations })),
      target,
      order.required_confirmations
    );
  } else {
    if (order.derivation_index === null) {
      throw new Error(`XMR-Bestellung ${order.id} hat keinen Subadressindex.`);
    }
    const target = toleratedTarget(decimalToUnits(order.amount_crypto, 12));
    const payments = await getXmrPayments(order.derivation_index);
    summary = summarizePayments(
      payments.map((payment) => ({ amount: payment.amountAtomic, confirmations: payment.confirmations })),
      target,
      order.required_confirmations
    );
  }

  let status: string | null = null;
  if (summary.confirmedEnough) {
    status = "paid";
  } else if (summary.anyReceived) {
    status = "confirming";
  }

  await pool.query(
    `UPDATE orders
        SET confirmations = $1,
            status = COALESCE($2, status),
            last_payment_check_at = now(),
            updated_at = now()
      WHERE id = $3 AND status NOT IN ('paid','shipped','cancelled','expired')`,
    [summary.confirmations, status, order.id]
  );
}

export async function expireOverdueOrders() {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM orders WHERE status='pending' AND expires_at < now()");
  for (const order of rows) await changeOrderStatus(order.id, "expired", Math.ceil(EXPIRY_GRACE_MS / 1000));
}

async function pollOpenOrders() {
  const { rows } = await pool.query<OpenOrder>(
    `SELECT id, payment_method, payment_address, derivation_index, amount_crypto,
            required_confirmations, expires_at
     FROM orders
     WHERE status IN ('pending','confirming')`
  );

  for (const order of rows) {
    try {
      await pollOrder(order);
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Fehler beim Polling einer Bestellung");
    }
  }
}

export async function runPollCycle() {
  await repairReleasedStock();
  await pollOpenOrders();
  await expireOverdueOrders();
}

let pollTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;

export function startPaymentPoller(intervalMs = 30_000) {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (cycleRunning) return;
    cycleRunning = true;
    runPollCycle()
      .catch((err) => logger.error({ err }, "Poller-Durchlauf fehlgeschlagen"))
      .finally(() => {
        cycleRunning = false;
      });
  }, intervalMs);
  pollTimer.unref();
  logger.info(
    { intervalMs, btcConf: env.BTC_REQUIRED_CONFIRMATIONS, expiryGraceMs: EXPIRY_GRACE_MS },
    "Zahlungs-Poller gestartet"
  );
}

export function stopPaymentPoller() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
