import { HDKey } from "@scure/bip32";
import { bech32 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";
import { ripemd160 } from "@noble/hashes/legacy";
import { fetchJson, fetchText } from "../../lib/http.ts";
import { env } from "../../lib/env.ts";

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
  return hdRoot.deriveChild(0);
}

export function deriveBtcAddress(index: number): string {
  const node = getReceiveNode().deriveChild(index);
  if (!node.publicKey) throw new Error("Konnte Public Key nicht ableiten.");
  return encodeP2WPKH(hash160(node.publicKey));
}

interface EsploraTx {
  txid: string;
  status: { confirmed: boolean; block_height?: number };
  vout: Array<{
    value: number;
    scriptpubkey_address?: string;
  }>;
}

export interface BtcPayment {
  txid: string;
  amountSats: bigint;
  confirmations: number;
}

/**
 * Liefert jede Zahlung an die Bestelladresse zusammen mit ihrer eigenen
 * Bestätigungstiefe. Betrag und Confirmations werden bewusst nicht getrennt
 * aggregiert: Eine alte Kleinstzahlung darf niemals die Confirmations einer
 * späteren, großen Zahlung "erben".
 */
export async function getBtcPayments(address: string): Promise<BtcPayment[]> {
  const base = env.BTC_ESPLORA_URL.replace(/\/$/, "");
  const txs = await fetchJson<EsploraTx[]>(`${base}/address/${address}/txs`);
  if (txs.length === 0) return [];

  const confirmedTxs = txs.filter(
    (tx) => tx.status.confirmed && tx.status.block_height !== undefined
  );
  let tipHeight: number | null = null;
  if (confirmedTxs.length > 0) {
    tipHeight = Number(await fetchText(`${base}/blocks/tip/height`));
    if (!Number.isSafeInteger(tipHeight) || tipHeight < 0) {
      throw new Error("Esplora lieferte eine ungültige Blockhöhe.");
    }
  }

  return txs.flatMap((tx) => {
    const amount = tx.vout
      .filter((out) => out.scriptpubkey_address === address)
      .reduce((sum, out) => sum + BigInt(out.value), 0n);

    if (amount <= 0n) return [];

    const blockHeight = tx.status.block_height;
    const confirmations =
      tx.status.confirmed && blockHeight !== undefined && tipHeight !== null
        ? Math.max(0, tipHeight - blockHeight + 1)
        : 0;

    return [{ txid: tx.txid, amountSats: amount, confirmations }];
  });
}
