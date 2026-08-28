import { fetchJson } from "../../lib/http.ts";
import { env } from "../../lib/env.ts";

/**
 * Monero: Anbindung über monero-wallet-rpc im view-only-Modus, verbunden
 * mit einem öffentlichen Remote-Node. Für jede Bestellung wird eine neue
 * Subadresse erzeugt.
 */

let rpcId = 0;

async function rpcCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const body = await fetchJson<{ result?: T; error?: { message: string } }>(env.XMR_WALLET_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: (rpcId++).toString(), method, params })
  });
  if (body.error) {
    throw new Error(`monero-wallet-rpc Fehler bei ${method}: ${body.error.message}`);
  }
  if (body.result === undefined) {
    throw new Error(`monero-wallet-rpc lieferte kein Ergebnis für ${method}`);
  }
  return body.result;
}

interface CreateAddressResult {
  address: string;
  address_index: number;
}

export async function createXmrSubaddress(orderLabel: string): Promise<CreateAddressResult> {
  return rpcCall<CreateAddressResult>("create_address", {
    account_index: 0,
    label: orderLabel
  });
}

interface Transfer {
  amount: number | string;
  confirmations?: number;
  subaddr_index: { major: number; minor: number };
  txid: string;
}

interface GetTransfersResult {
  in?: Transfer[];
  pool?: Transfer[];
}

export interface XmrPayment {
  txid: string;
  amountAtomic: bigint;
  confirmations: number;
}

/**
 * Liefert eingehende Transfers der Bestell-Subadresse jeweils mit ihrem
 * eigenen Betrag und ihrer eigenen Bestätigungstiefe. So kann eine alte
 * Kleinstzahlung nicht die Confirmations einer späteren Zahlung übernehmen.
 */
export async function getXmrPayments(addressIndex: number): Promise<XmrPayment[]> {
  const result = await rpcCall<GetTransfersResult>("get_transfers", {
    in: true,
    pool: true,
    account_index: 0,
    subaddr_indices: [addressIndex]
  });

  return [...(result.in ?? []), ...(result.pool ?? [])]
    .filter((t) => t.subaddr_index.major === 0 && t.subaddr_index.minor === addressIndex)
    .map((t) => ({
      txid: t.txid,
      amountAtomic: toAtomic(t.amount),
      confirmations: Math.max(0, Number(t.confirmations ?? 0))
    }))
    .filter((t) => t.amountAtomic > 0n && Number.isSafeInteger(t.confirmations));
}

// JSON numbers beyond 2^53 have already lost precision: fail closed.
function toAtomic(amount: number | string): bigint {
  if (typeof amount === "number" && !Number.isSafeInteger(amount)) throw new Error("Unsicherer XMR-Betrag");
  return BigInt(amount);
}
