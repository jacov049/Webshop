import { HDKey } from "@scure/bip32";
import { bech32 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";
import { ripemd160 } from "@noble/hashes/legacy";
import { env } from "../../lib/env.ts";
import { logger } from "../../lib/logger.ts";

/**
 * Bitcoin: watch-only HD-Wallet (BIP32/44, hier: native SegWit P2WPKH).
 * Der Server besitzt NUR den öffentlichen Extended Key (xpub/zpub), niemals
 * einen privaten Schlüssel — Adressgenerierung ist rein "watch-only".
 * Für jede Bestellung wird ein neuer Empfangsindex verwendet
 * (keine Adresswiederverwendung, siehe Konzept Abschnitt 5).
 */

function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

function encodeP2WPKH(pubkeyHash: Uint8Array): string {
  const words = bech32.toWords(pubkeyHash);
  return bech32.encode("bc", [0, ...words]);
}

let hdRoot: HDKey | null = null;
function getReceiveNode(): HDKey {
  if (!env.BTC_XPUB) {
    throw new Error("BTC_XPUB ist nicht konfiguriert – Bitcoin-Zahlungen sind deaktiviert.");
  }
  if (!hdRoot) {
    hdRoot = HDKey.fromExtendedKey(env.BTC_XPUB);
  }
  // Empfangskette (Chain 0) analog BIP44 external chain; xpub muss bereits
  // auf Account-Ebene (m/84'/0'/0') liegen, hier wird nur noch external/index
  // angehängt.
  return hdRoot.deriveChild(0);
}

export function deriveBtcAddress(index: number): string {
  const node = getReceiveNode().deriveChild(index);
  if (!node.publicKey) throw new Error("Konnte Public Key nicht ableiten.");
  return encodeP2WPKH(hash160(node.publicKey));
}

interface EsploraAddressStats {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
}

interface EsploraTx {
  txid: string;
  status: { confirmed: boolean; block_height?: number };
}

/** Ermittelt empfangenen Betrag (Satoshi) und Bestätigungen für eine Adresse. */
export async function getBtcPaymentStatus(
  address: string
): Promise<{ receivedSats: number; confirmations: number }> {
  const base = env.BTC_ESPLORA_URL.replace(/\/$/, "");

  const statsRes = await fetch(`${base}/address/${address}`);
  if (!statsRes.ok) {
    throw new Error(`Esplora-Adressabfrage fehlgeschlagen: HTTP ${statsRes.status}`);
  }
  const stats = (await statsRes.json()) as EsploraAddressStats;
  const receivedSats = stats.chain_stats.funded_txo_sum + stats.mempool_stats.funded_txo_sum;

  if (receivedSats === 0) {
    return { receivedSats: 0, confirmations: 0 };
  }

  const txsRes = await fetch(`${base}/address/${address}/txs`);
  if (!txsRes.ok) {
    logger.warn({ status: txsRes.status }, "Esplora-TX-Abfrage fehlgeschlagen");
    return { receivedSats, confirmations: 0 };
  }
  const txs = (await txsRes.json()) as EsploraTx[];
  const confirmedTx = txs.find((tx) => tx.status.confirmed);
  if (!confirmedTx || confirmedTx.status.block_height === undefined) {
    return { receivedSats, confirmations: 0 };
  }

  const tipRes = await fetch(`${base}/blocks/tip/height`);
  const tipHeight = tipRes.ok ? Number(await tipRes.text()) : confirmedTx.status.block_height;
  const confirmations = Math.max(0, tipHeight - confirmedTx.status.block_height + 1);
  return { receivedSats, confirmations };
}

export function satsToBtc(sats: number): number {
  return sats / 100_000_000;
}
