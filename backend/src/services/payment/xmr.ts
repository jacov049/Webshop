import { env } from "../../lib/env.ts";

/**
 * Monero: Anbindung über monero-wallet-rpc im view-only-Modus, verbunden
 * mit einem öffentlichen Remote-Node (siehe Konzept Abschnitt 5 – bewusste
 * Architekturentscheidung: dauerhaft öffentliche Nodes, kein eigener Node).
 * Für jede Bestellung wird eine neue Subadresse erzeugt.
 */

let rpcId = 0;

async function rpcCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(env.XMR_WALLET_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: (rpcId++).toString(), method, params })
  });
  if (!res.ok) {
    throw new Error(`monero-wallet-rpc HTTP ${res.status} bei Methode ${method}`);
  }
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) {
    throw new Error(`monero-wallet-rpc Fehler bei ${method}: ${body.error.message}`);
  }
  return body.result as T;
}

interface CreateAddressResult {
  address: string;
  address_index: number;
}

/** Erzeugt eine neue Subadresse (Account 0) für eine Bestellung. */
export async function createXmrSubaddress(orderLabel: string): Promise<CreateAddressResult> {
  return rpcCall<CreateAddressResult>("create_address", {
    account_index: 0,
    label: orderLabel
  });
}

interface Transfer {
  amount: number;
  confirmations: number;
  subaddr_index: { major: number; minor: number };
  txid: string;
}

interface GetTransfersResult {
  in?: Transfer[];
  pool?: Transfer[];
}

/** Ermittelt empfangenen Betrag (Atomic Units) und Bestätigungen für eine Subadresse. */
export async function getXmrPaymentStatus(
  addressIndex: number
): Promise<{ receivedAtomic: bigint; confirmations: number }> {
  const result = await rpcCall<GetTransfersResult>("get_transfers", {
    in: true,
    pool: true,
    account_index: 0,
    subaddr_indices: [addressIndex]
  });

  const transfers = [...(result.in ?? []), ...(result.pool ?? [])].filter(
    (t) => t.subaddr_index.minor === addressIndex
  );
  if (transfers.length === 0) {
    return { receivedAtomic: 0n, confirmations: 0 };
  }

  const receivedAtomic = transfers.reduce((sum, t) => sum + BigInt(t.amount), 0n);
  const confirmations = Math.max(...transfers.map((t) => t.confirmations ?? 0));
  return { receivedAtomic, confirmations };
}

const ATOMIC_UNITS_PER_XMR = 1_000_000_000_000n;

export function atomicToXmr(atomic: bigint): number {
  return Number(atomic) / Number(ATOMIC_UNITS_PER_XMR);
}
