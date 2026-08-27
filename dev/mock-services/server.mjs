/**
 * Mock-Dienste für die lokale Entwicklung.
 *
 * Bildet die drei externen Abhängigkeiten des Backends originalgetreu nach,
 * damit der komplette Zahlungsablauf offline getestet werden kann – ohne
 * echtes Geld, ohne öffentliche Nodes zu belasten und ohne auf
 * Netzwerkzugriff angewiesen zu sein:
 *
 *   :9101  Esplora-HTTP-API        (Bitcoin, wie blockstream.info/api)
 *   :9102  monero-wallet-rpc       (JSON-RPC, Account 0)
 *   :9103  Kursquelle              (coingecko-kompatibel)
 *   :9100  Steuer-API              (simuliert Zahlungseingänge/Blöcke)
 *
 * Start:  node dev/mock-services/server.mjs
 * Siehe dev/mock-services/README.md für die passenden .env-Werte.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------- Zustand
const state = {
  tipHeight: 800_000,
  /** address -> { sats, blockHeight|null, txid } */
  btc: new Map(),
  /** Subadressen des Wallets, Index 0 ist die Hauptadresse */
  xmrSubaddresses: [{ address_index: 0, address: '4' + 'A'.repeat(94), label: 'Primary' }],
  /** { amount (atomic units), subaddrIndex, blockHeight|null, txid } */
  xmrTransfers: [],
  rates: { bitcoin: { eur: 58420.13 }, monero: { eur: 142.77 } }
};

const txid = () => randomBytes(32).toString('hex');
const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}
/** Bestätigungen einer in Block `h` eingeschlossenen Transaktion. */
const confirmationsFor = (h) => (h === null ? 0 : Math.max(0, state.tipHeight - h + 1));

// ------------------------------------------------------- Esplora (Bitcoin)
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (path === '/blocks/tip/height') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(String(state.tipHeight));
  }

  let m = path.match(/^\/address\/([^/]+)$/);
  if (m) {
    const p = state.btc.get(m[1]);
    const confirmed = p && p.blockHeight !== null;
    return json(res, {
      address: m[1],
      chain_stats: {
        funded_txo_sum: confirmed ? p.sats : 0,
        spent_txo_sum: 0,
        tx_count: confirmed ? 1 : 0
      },
      mempool_stats: {
        funded_txo_sum: p && !confirmed ? p.sats : 0,
        spent_txo_sum: 0,
        tx_count: p && !confirmed ? 1 : 0
      }
    });
  }

  m = path.match(/^\/address\/([^/]+)\/txs$/);
  if (m) {
    const p = state.btc.get(m[1]);
    if (!p) return json(res, []);
    return json(res, [
      {
        txid: p.txid,
        status:
          p.blockHeight === null
            ? { confirmed: false }
            : { confirmed: true, block_height: p.blockHeight }
      }
    ]);
  }

  json(res, { error: 'not found' }, 404);
}).listen(9101, () => console.log('  Esplora-Mock        :9101'));

// --------------------------------------------------- monero-wallet-rpc
createServer(async (req, res) => {
  if (req.method !== 'POST') return json(res, { error: 'POST erwartet' }, 405);
  const body = await readBody(req);
  const { id = '0', method, params = {} } = body;
  const reply = (result) => json(res, { jsonrpc: '2.0', id, result });

  if (method === 'create_address') {
    const address_index = state.xmrSubaddresses.length;
    // Monero-Subadressen beginnen mit "8"; hier deterministisch aufgefüllt.
    const address = '8' + String(address_index).padStart(6, '0') + 'X'.repeat(88);
    const entry = { address_index, address, label: params.label ?? '' };
    state.xmrSubaddresses.push(entry);
    return reply({ address, address_index });
  }

  if (method === 'get_transfers') {
    const wanted = params.subaddr_indices ?? null;
    const pick = (t) => !wanted || wanted.includes(t.subaddrIndex);
    const toRpc = (t) => ({
      amount: t.amount,
      confirmations: confirmationsFor(t.blockHeight),
      subaddr_index: { major: 0, minor: t.subaddrIndex },
      txid: t.txid,
      type: t.blockHeight === null ? 'pool' : 'in'
    });
    const all = state.xmrTransfers.filter(pick);
    return reply({
      in: params.in ? all.filter((t) => t.blockHeight !== null).map(toRpc) : undefined,
      pool: params.pool ? all.filter((t) => t.blockHeight === null).map(toRpc) : undefined
    });
  }

  if (method === 'get_height') return reply({ height: state.tipHeight });

  json(res, { jsonrpc: '2.0', id, error: { code: -32601, message: `Unbekannte Methode ${method}` } });
}).listen(9102, () => console.log('  monero-wallet-rpc   :9102'));

// ------------------------------------------------------------- Kursquelle
createServer((_req, res) => json(res, state.rates)).listen(9103, () =>
  console.log('  Kursquelle          :9103')
);

// ------------------------------------------------------------ Steuer-API
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (req.method === 'GET' && path === '/state') {
    return json(res, {
      tipHeight: state.tipHeight,
      btc: [...state.btc.entries()].map(([address, p]) => ({
        address,
        sats: p.sats,
        confirmations: confirmationsFor(p.blockHeight)
      })),
      xmrSubaddresses: state.xmrSubaddresses.length,
      xmrTransfers: state.xmrTransfers.map((t) => ({
        subaddrIndex: t.subaddrIndex,
        amount: t.amount,
        confirmations: confirmationsFor(t.blockHeight)
      }))
    });
  }

  const body = req.method === 'POST' ? await readBody(req) : {};

  // Zahlungseingang simulieren. confirmed=false -> Mempool/Pool.
  if (path === '/btc/pay') {
    const blockHeight = body.confirmed === false ? null : state.tipHeight;
    state.btc.set(body.address, { sats: Math.round(body.sats), blockHeight, txid: txid() });
    return json(res, { ok: true, confirmations: confirmationsFor(blockHeight) });
  }

  if (path === '/xmr/pay') {
    const blockHeight = body.confirmed === false ? null : state.tipHeight;
    state.xmrTransfers.push({
      amount: Math.round(body.atomic),
      subaddrIndex: body.addressIndex,
      blockHeight,
      txid: txid()
    });
    return json(res, { ok: true, confirmations: confirmationsFor(blockHeight) });
  }

  // Blöcke schürfen -> erhöht die Bestätigungen aller eingeschlossenen TX.
  if (path === '/mine') {
    state.tipHeight += Number(body.blocks ?? 1);
    return json(res, { ok: true, tipHeight: state.tipHeight });
  }

  // Ausstehende Transaktionen in den nächsten Block aufnehmen.
  if (path === '/confirm-pending') {
    state.tipHeight += 1;
    for (const p of state.btc.values()) if (p.blockHeight === null) p.blockHeight = state.tipHeight;
    for (const t of state.xmrTransfers) if (t.blockHeight === null) t.blockHeight = state.tipHeight;
    return json(res, { ok: true, tipHeight: state.tipHeight });
  }

  if (path === '/reset') {
    state.tipHeight = 800_000;
    state.btc.clear();
    state.xmrSubaddresses.length = 1;
    state.xmrTransfers.length = 0;
    return json(res, { ok: true });
  }

  json(res, { error: 'not found' }, 404);
}).listen(9100, () => console.log('  Steuer-API          :9100'));

console.log('Mock-Dienste laufen.');
