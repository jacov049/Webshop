import { pool } from "../../db/pool.ts";
import { logger } from "../../lib/logger.ts";
import { env } from "../../lib/env.ts";
import { releaseStockForOrder } from "../stock.ts";
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

interface PaymentSlice {
  amount: bigint;
  confirmations: number;
}

const UNDERPAYMENT_NUMERATOR = 995n;
const UNDERPAYMENT_DENOMINATOR = 1000n;
const EXPIRY_GRACE_MS = Math.max(60_000, env.PAYMENT_POLL_INTERVAL_MS * 2);

function decimalToUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Ungültiger Kryptobetrag: ${value}`);
  }
  const [wholeRaw, fraction = ""] = normalized.split(".");
  const whole = wholeRaw ?? "0";
  const padded = fraction.padEnd(decimals, "0");
  if (padded.length > decimals && /[1-9]/.test(padded.slice(decimals))) {
    throw new Error(`Kryptobetrag hat mehr als ${decimals} relevante Nachkommastellen.`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded.slice(0, decimals) || "0");
}

function toleratedTarget(amount: bigint): bigint {
  return (
    amount * UNDERPAYMENT_NUMERATOR + (UNDERPAYMENT_DENOMINATOR - 1n)
  ) / UNDERPAYMENT_DENOMINATOR;
}

function summarizePayments(payments: PaymentSlice[], target: bigint, requiredConfirmations: number) {
  const totalReceived = payments.reduce((sum, payment) => sum + payment.amount, 0n);
  const confirmedReceived = payments
    .filter((payment) => payment.confirmations >= requiredConfirmations)
    .reduce((sum, payment) => sum + payment.amount, 0n);

  let confirmations = 0;
  if (payments.length > 0) {
    const depths = [...new Set(payments.map((payment) => payment.confirmations))].sort((a, b) => b - a);
    for (const depth of depths) {
      const amountAtDepth = payments
        .filter((payment) => payment.confirmations >= depth)
        .reduce((sum, payment) => sum + payment.amount, 0n);
      if (amountAtDepth >= target) {
        confirmations = depth;
        break;
      }
    }
    if (confirmations === 0 && totalReceived < target) {
      confirmations = Math.max(...payments.map((payment) => payment.confirmations));
    }
  }

  return {
    anyReceived: totalReceived > 0n,
    confirmedEnough: confirmedReceived >= target,
    confirmations
  };
}

async function pollOrder(order: OpenOrder) {
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

async function expireOverdueOrders() {
  const graceSeconds = Math.ceil(EXPIRY_GRACE_MS / 1000);
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE orders
        SET status = 'expired', updated_at = now()
      WHERE status = 'pending'
        AND expires_at + ($1::int * interval '1 second') < now()
        AND last_payment_check_at IS NOT NULL
        AND last_payment_check_at >= expires_at
        AND last_payment_check_at >= now() - ($1::int * interval '1 second')
      RETURNING id`,
    [graceSeconds]
  );

  for (const order of rows) {
    try {
      await releaseStockForOrder(order.id);
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Lagerbestand-Rückbuchung fehlgeschlagen");
    }
  }

  if (rows.length > 0) {
    logger.info({ expiredOrders: rows.length }, "Abgelaufene Bestellungen zurückgesetzt");
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
    try {
      await pollOrder(order);
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Fehler beim Polling einer Bestellung");
    }
  }
}

async function runPollCycle() {
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
