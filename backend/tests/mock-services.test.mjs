import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { randomInt } from 'node:crypto';

test('bundled wallet mocks support mixed transfers and confirmation progression', { timeout: 20000 }, async () => {
  const port = randomInt(20000, 45000);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../dev/mock-services/server.mjs', import.meta.url))],
    { env: { ...process.env, MOCK_PORT_BASE: String(port) }, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  const exited = once(child, 'exit');
  try {
    await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; if ((output.match(/ready/g) ?? []).length === 4) resolve(); });
      child.once('error', reject);
      child.once('exit', code => reject(new Error(`Mocks exited: ${code}`)));
    });
    Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: 'postgres://unused', SESSION_SECRET: 'test-only-'.repeat(4),
      AT_REST_KEY: '00'.repeat(32), TOTP_ENCRYPTION_KEY: '11'.repeat(32),
      BTC_ESPLORA_URL: `http://127.0.0.1:${port+1}`, XMR_WALLET_RPC_URL: `http://127.0.0.1:${port+2}/json_rpc` });
    const { getBtcPayments } = await import('../src/services/payment/btc.ts');
    const { createXmrSubaddress, getXmrPayments } = await import('../src/services/payment/xmr.ts');
    const control = async (path, body = {}) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200);
    };
    await control('/btc/pay', { address:'ours', sats:1000 });
    await control('/btc/pay', { address:'ours', sats:999000, confirmed:false });
    assert.deepEqual((await getBtcPayments('ours')).map(p => [p.amountSats,p.confirmations]), [[1000n,1],[999000n,0]]);
    const sub = await createXmrSubaddress('test');
    await control('/xmr/pay', { addressIndex:sub.address_index, atomic:1000 });
    await control('/xmr/pay', { addressIndex:sub.address_index, atomic:999000, confirmed:false });
    assert.deepEqual((await getXmrPayments(sub.address_index)).map(p => [p.amountAtomic,p.confirmations]), [[1000n,1],[999000n,0]]);
    await control('/confirm-pending'); await control('/mine', { blocks:9 });
    assert.ok((await getBtcPayments('ours')).every(p => p.confirmations >= 10));
    assert.ok((await getXmrPayments(sub.address_index)).every(p => p.confirmations >= 10));
  } finally { child.kill(); await exited; }
});
