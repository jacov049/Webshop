import { pool } from "../../db/pool.ts";
import { logger } from "../../lib/logger.ts";
import { env } from "../../lib/env.ts";
import { releaseStockForOrder } from "../stock.ts";
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

/** Akzeptierte Unterzahlung (Kursschwankung/Gebührenrundung des Kunden). */
const UNDERPAYMENT_TOLERANCE = 0.995;

async function pollOrder(order: OpenOrder) {
  let confirmations = 0;
  let receivedEnough = false;

  if (order.payment_method === "BTC") {
    const { receivedSats, confirmations: conf } = await getBtcPaymentStatus(order.payment_address);
    confirmations = conf;
    receivedEnough = satsToBtc(receivedSats) >= Number(order.amount_crypto) * UNDERPAYMENT_TOLERANCE;
  } else {
    const { receivedAtomic, confirmations: conf } = await getXmrPaymentStatus(
      order.derivation_index ?? 0
    );
    confirmations = conf;
    receivedEnough =
      atomicToXmr(receivedAtomic) >= Number(order.amount_crypto) * UNDERPAYMENT_TOLERANCE;
  }

  let status: string | null = null;
  if (receivedEnough && confirmations >= order.required_confirmations) {
    status = "paid";
  } else if (receivedEnough || confirmations > 0) {
    status = "confirming";
  }

  await pool.query(
    `UPDATE orders
        SET confirmations = $1,
            status = COALESCE($2, status),
            updated_at = now()
      WHERE id = $3 AND status NOT IN ('paid','shipped','cancelled')`,
    [confirmations, status, order.id]
  );
}

/**
 * Läuft unabhängig von externen APIs: Bestellungen, deren Zahlungsfenster
 * abgelaufen ist und bei denen bislang KEIN Zahlungseingang erkannt wurde
 * (status 'pending', 0 Bestätigungen), werden auf 'expired' gesetzt und
 * ihr reservierter Lagerbestand zurückgebucht.
 *
 * Bewusst nicht an den Erfolg der Blockchain-Abfrage gekoppelt: sonst
 * würde ein Ausfall des öffentlichen Nodes dazu führen, dass Bestände
 * dauerhaft blockiert bleiben. Bestellungen im Status 'confirming'
 * (Zahlung bereits gesehen) laufen nie automatisch ab – die klärt der
 * Betreiber manuell.
 */
async function expireOverdueOrders() {
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE orders
        SET status = 'expired', updated_at = now()
      WHERE status = 'pending'
        AND confirmations = 0
        AND expires_at < now()
      RETURNING id`
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
    // Sequentiell, um öffentliche Nodes/APIs nicht zu überlasten. Ein
    // Fehler bei einer Bestellung darf die übrigen nicht überspringen.
    try {
      await pollOrder(order);
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Fehler beim Polling einer Bestellung");
    }
  }
}

async function runPollCycle() {
  await expireOverdueOrders();
  await pollOpenOrders();
}

let pollTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;

export function startPaymentPoller(intervalMs = 30_000) {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    // Überlappende Durchläufe verhindern, falls ein Zyklus länger dauert
    // als das Intervall (langsame/hängende öffentliche Nodes).
    if (cycleRunning) return;
    cycleRunning = true;
    runPollCycle()
      .catch((err) => logger.error({ err }, "Poller-Durchlauf fehlgeschlagen"))
      .finally(() => {
        cycleRunning = false;
      });
  }, intervalMs);
  pollTimer.unref();
  logger.info({ intervalMs, btcConf: env.BTC_REQUIRED_CONFIRMATIONS }, "Zahlungs-Poller gestartet");
}

export function stopPaymentPoller() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
