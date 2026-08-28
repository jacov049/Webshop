import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { decimalToUnits, quoteCrypto, summarizePayments, toleratedTarget } from '../src/services/payment/amounts.ts';

// Synthetic test-only configuration. No production wallet or database is contacted.
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: 'postgres://unused',
  SESSION_SECRET: 'test-only-'.repeat(4), AT_REST_KEY: '00'.repeat(32), TOTP_ENCRYPTION_KEY: '11'.repeat(32),
  EXTERNAL_REQUEST_TIMEOUT_MS: '100', RATES_MAX_AGE_MS: '300000' });
const { fetchText } = await import('../src/lib/http.ts');
const { fetchRates, RateUnavailableError } = await import('../src/services/payment/rates.ts');
const { getBtcPayments } = await import('../src/services/payment/btc.ts');
const { getXmrPayments } = await import('../src/services/payment/xmr.ts');
const { readPage, pageResult } = await import('../src/lib/pagination.ts');
const fetchOriginal = globalThis.fetch;
after(() => { globalThis.fetch = fetchOriginal; });

test('EUR 10 / EUR 60000 creates a payable BTC invoice; legacy fractions round up', () => {
  assert.equal(quoteCrypto(1000n, 60000, 8), '0.00016667');
  assert.equal(decimalToUnits('0.000166666667', 8), 16667n);
  assert.equal(decimalToUnits('1e-8', 8), 1n);
  assert.equal(quoteCrypto(1000n, 200, 12), '0.050000000000');
  assert.throws(() => quoteCrypto(0n, 60000, 8));
  assert.throws(() => quoteCrypto(1000n, Infinity, 8));
});

test('confirmed dust cannot confirm a large unconfirmed BTC or XMR transfer', () => {
  for (const depth of [2, 10]) {
    const target = toleratedTarget(1000000n);
    const partial = [{ amount: 1000n, confirmations: depth }, { amount: 999000n, confirmations: 0 }];
    assert.deepEqual(summarizePayments(partial, target, depth), { anyReceived: true, confirmedEnough: false, confirmations: 0 });
    partial[1].confirmations = depth;
    assert.equal(summarizePayments(partial, target, depth).confirmedEnough, true);
    assert.equal(summarizePayments([{ amount: 994999n, confirmations: depth }], target, depth).confirmedEnough, false);
    assert.equal(summarizePayments([{ amount: 995000n, confirmations: depth }], target, depth).confirmedEnough, true);
  }
});

test('BTC outputs and XMR subaddresses retain their own confirmations', async () => {
  globalThis.fetch = async url => String(url).endsWith('/height') ? new Response('101') : Response.json([
    { txid: 'a', status: { confirmed: true, block_height: 100 }, vout: [{ value: 1000, scriptpubkey_address: 'ours' }, { value: 9000, scriptpubkey_address: 'other' }] },
    { txid: 'b', status: { confirmed: false }, vout: [{ value: 999000, scriptpubkey_address: 'ours' }] }
  ]);
  assert.deepEqual(await getBtcPayments('ours'), [
    { txid: 'a', amountSats: 1000n, confirmations: 2 }, { txid: 'b', amountSats: 999000n, confirmations: 0 }
  ]);
  globalThis.fetch = async () => Response.json({ result: { in: [
    { txid: 'a', amount: '1000', confirmations: 10, subaddr_index: { major: 0, minor: 1 } },
    { txid: 'wrong-account', amount: 9000, confirmations: 10, subaddr_index: { major: 1, minor: 1 } }
  ], pool: [{ txid: 'b', amount: 999000, subaddr_index: { major: 0, minor: 1 } }] } });
  assert.deepEqual(await getXmrPayments(1), [
    { txid: 'a', amountAtomic: 1000n, confirmations: 10 }, { txid: 'b', amountAtomic: 999000n, confirmations: 0 }
  ]);
  globalThis.fetch = fetchOriginal;
});

test('stale rates fail closed after the configured maximum age', async () => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    globalThis.fetch = async () => Response.json({ bitcoin: { eur: 60000 }, monero: { eur: 200 } });
    await fetchRates();
    globalThis.fetch = async () => { throw new Error('simulated outage'); };
    now += 61000;
    assert.equal((await fetchRates()).bitcoin.eur, 60000);
    now += 300000;
    await assert.rejects(fetchRates, RateUnavailableError);
  } finally { Date.now = realNow; globalThis.fetch = fetchOriginal; }
});

test('external timeout aborts an incomplete response body', async () => {
  const server = createServer((_req, res) => { res.writeHead(200); res.write('incomplete'); });
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await assert.rejects(() => fetchText(`http://127.0.0.1:${server.address().port}`)); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('cursor remains usable after the previous row is deleted and rejects malformed input', () => {
  const rows = [{ id: '00000000-0000-4000-8000-000000000001', created_at: new Date('2026-01-01T00:00:00Z') },
    { id: '00000000-0000-4000-8000-000000000002', created_at: new Date('2025-01-01T00:00:00Z') }];
  const page = pageResult(rows, 1);
  assert.equal(page.items.length, 1);
  assert.deepEqual(readPage({ cursor: page.nextCursor, limit: 1 }), { limit: 1, at: rows[0].created_at.toISOString(), id: rows[0].id });
  assert.throws(() => readPage({ cursor: 'bad' }));
  assert.throws(() => readPage({ limit: 201 }));
});
