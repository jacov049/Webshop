import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { HDKey } from '@scure/bip32';

// CI uses a real PostgreSQL service. Local fallback runs the same SQL on embedded PostgreSQL.
// PGlite does not validate multi-connection locks: the separate concurrency test requires CI PG.
const external = process.env.TEST_DATABASE_URL;
const schema = `audit_${randomUUID().replaceAll('-', '')}`;
let rootPool, embedded, server, pool, app, changeOrderStatus, expireOverdueOrders, pollOrder, runRetentionCleanup;
let api, adminCookie;
const originalFetch = globalThis.fetch;
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: external ?? 'postgres://unused',
  SESSION_SECRET: 'test-only-'.repeat(4), AT_REST_KEY: '00'.repeat(32), TOTP_ENCRYPTION_KEY: '11'.repeat(32),
  BTC_XPUB: HDKey.fromMasterSeed(randomBytes(32)).publicExtendedKey });

before(async () => {
  if (external) {
    rootPool = new pg.Pool({ connectionString: external });
    await rootPool.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(external);
    url.searchParams.set('options', `-c search_path=${schema},public`);
    process.env.DATABASE_URL = url.toString();
  }
  ({ pool } = await import('../src/db/pool.ts'));
  if (!external) {
    const { PGlite } = await import('@electric-sql/pglite');
    embedded = new PGlite();
    const query = async (sql, params = []) => {
      const result = await embedded.query(sql, params);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    };
    pool.query = query;
    pool.connect = async () => ({ query, release() {} });
  }
  const sql = (await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8'))
    .replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''); // gen_random_uuid is built into PG16/PGlite
  if (embedded) { await embedded.exec(sql); await embedded.exec(sql); }
  else { await pool.query(sql); await pool.query(sql); }
  ({ app } = await import('../src/app.ts'));
  ({ changeOrderStatus } = await import('../src/services/stock.ts'));
  ({ expireOverdueOrders, pollOrder } = await import('../src/services/payment/poller.ts'));
  ({ runRetentionCleanup } = await import('../src/services/retention.ts'));
  const { hashToken } = await import('../src/middleware/auth.ts');
  const { rows } = await pool.query("INSERT INTO admin_users(username,password_hash,totp_secret) VALUES ('test','unused','unused') RETURNING id");
  const token = randomBytes(32).toString('base64url');
  await pool.query("INSERT INTO admin_sessions(admin_user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [rows[0].id, hashToken(token)]);
  adminCookie = `cryptoshop_admin_dev=${token}`;
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  api = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (embedded) await embedded.close();
  await pool?.end();
  if (rootPool) { await rootPool.query(`DROP SCHEMA ${schema} CASCADE`); await rootPool.end(); }
});

async function product(stock = 10) {
  return (await pool.query("INSERT INTO products(name,price_eur,stock) VALUES ('Server product',10,$1) RETURNING id", [stock])).rows[0].id;
}
async function order(productId, quantities = [2], status = 'pending') {
  const { encryptAtRest } = await import('../src/services/crypto/atRest.ts');
  const id = (await pool.query(`INSERT INTO orders(encrypted_payload,payment_method,payment_address,amount_crypto,amount_eur,status,expires_at)
    VALUES ($1,'BTC','test-address',0.00016667,10,$2,now()-interval '5 minutes') RETURNING id`, [encryptAtRest('test'), status])).rows[0].id;
  for (const qty of quantities) await pool.query('INSERT INTO order_items(order_id,product_id,quantity) VALUES ($1,$2,$3)', [id, productId, qty]);
  return id;
}
async function stock(id) { return (await pool.query('SELECT stock FROM products WHERE id=$1', [id])).rows[0].stock; }
async function status(id) { return (await pool.query('SELECT status FROM orders WHERE id=$1', [id])).rows[0].status; }
async function post(path, body, admin = false) {
  const csrf = 'test-csrf-token-'.repeat(3);
  return originalFetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: api,
    Cookie: `cryptoshop_csrf_dev=${csrf}; ${admin ? adminCookie : ''}`, 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
}

test('duplicate legacy items release their SUM once; terminal orders cannot reopen', async () => {
  const p = await product(5); const id = await order(p, [2,3]);
  await changeOrderStatus(id, 'cancelled');
  assert.equal(await stock(p), 10);
  await changeOrderStatus(id, 'cancelled');
  assert.equal(await stock(p), 10);
  await assert.rejects(() => changeOrderStatus(id, 'pending'), /Statuswechsel/);
});

test('failed inventory release rolls back the status and succeeds on retry', async () => {
  const p = await product(2147483647); const id = await order(p, [1]);
  await assert.rejects(() => changeOrderStatus(id, 'cancelled')); // SQL integer overflow
  assert.equal(await status(id), 'pending');
  await pool.query('UPDATE products SET stock=0 WHERE id=$1', [p]);
  await changeOrderStatus(id, 'cancelled');
  assert.equal(await stock(p), 1);
});

test('expiry requires a fresh successful post-deadline payment check', async () => {
  const p = await product(0); const id = await order(p, [2]);
  await expireOverdueOrders(); assert.equal(await status(id), 'pending');
  await pool.query("UPDATE orders SET last_payment_check_at=now()-interval '3 minutes' WHERE id=$1", [id]);
  await expireOverdueOrders(); assert.equal(await status(id), 'pending');
  await pool.query('UPDATE orders SET last_payment_check_at=now() WHERE id=$1', [id]);
  await expireOverdueOrders(); assert.equal(await status(id), 'expired'); assert.equal(await stock(p), 2);
});

test('BTC invoice with legacy decimals reaches paid only after sufficient confirmations', async () => {
  const p = await product(); const id = await order(p);
  const open = { id, payment_method: 'BTC', payment_address: 'ours', amount_crypto: '0.000166666667', required_confirmations: 2 };
  let confirmed = false;
  globalThis.fetch = async url => String(url).endsWith('/height') ? new Response('101') : Response.json([
    { txid: 'small', status: { confirmed: true, block_height: 100 }, vout: [{ value: 100, scriptpubkey_address: 'ours' }] },
    { txid: 'large', status: confirmed ? { confirmed: true, block_height: 100 } : { confirmed: false }, vout: [{ value: 16567, scriptpubkey_address: 'ours' }] }
  ]);
  try {
    await pollOrder(open); assert.equal(await status(id), 'confirming');
    confirmed = true; await pollOrder(open); assert.equal(await status(id), 'paid');
  } finally { globalThis.fetch = originalFetch; }
});

test('checkout rejects duplicate IDs and stores server-owned shipping snapshots', async () => {
  const p = await product();
  const payload = { encryptedPayload: '-----BEGIN PGP MESSAGE-----\nclient-controlled-items\n-----END PGP MESSAGE-----', paymentMethod: 'BTC', items: [{ productId: p, quantity: 1 }] };
  const duplicate = await post('/api/checkout', { ...payload, items: [...payload.items, ...payload.items] });
  assert.equal(duplicate.status, 400);
  globalThis.fetch = async () => Response.json({ bitcoin: { eur: 60000 }, monero: { eur: 200 } });
  let response;
  try { response = await post('/api/checkout', payload); } finally { globalThis.fetch = originalFetch; }
  assert.equal(response.status, 201, await response.clone().text());
  const data = await response.json(); assert.equal(data.amountCrypto, '0.00016667');
  const { rows } = await pool.query('SELECT product_name,unit_price_eur FROM order_items JOIN orders ON orders.id=order_id WHERE order_token=$1', [data.orderToken]);
  assert.equal(rows[0].product_name, 'Server product'); assert.equal(Number(rows[0].unit_price_eur), 10);
  await pool.query("UPDATE products SET name='Renamed',price_eur=999 WHERE id=$1", [p]);
  const list = await originalFetch(api+'/admin/orders?limit=1', { headers: { Cookie: adminCookie } });
  const page = await list.json();
  assert.equal(page.items[0].items[0].name, 'Server product');
  assert.ok(page.nextCursor);
  const next = await originalFetch(api+'/admin/orders?limit=1&cursor='+page.nextCursor, { headers: { Cookie: adminCookie } });
  assert.notEqual((await next.json()).items[0].id, page.items[0].id);
});

test('authenticated upload above 64KB reaches image validation, unauthenticated upload is denied', async () => {
  // An invalid large image should get the route's 400, not the old global-parser 413.
  const body = { name: 'Image', priceEur: 1, stock: 1, imageDataUrl: 'data:image/png;base64,'+'A'.repeat(100000) };
  const denied = await post('/admin/products', body); assert.equal(denied.status, 401);
  const accepted = await post('/admin/products', body, true); assert.equal(accepted.status, 400);
  assert.match(await accepted.text(), /Bild/);
  const sharp = (await import('sharp')).default;
  const image = await sharp(randomBytes(200*200*3), { raw: { width:200, height:200, channels:3 } }).png().toBuffer();
  assert.ok(image.length > 65536);
  const valid = await post('/admin/products', { ...body, imageDataUrl: 'data:image/png;base64,'+image.toString('base64') }, true);
  assert.equal(valid.status, 201, await valid.clone().text());
  const { rows } = await pool.query('SELECT image_path FROM products WHERE id=$1', [(await valid.json()).id]);
  // Only remove this test's generated image; production uploads are never enumerated/deleted.
  await unlink('.'+rows[0].image_path);
});

test('retention preserves unresolved orders and repairs historical interrupted releases', async () => {
  const p = await product(0); const pending = await order(p); const cancelled = await order(p, [3], 'cancelled');
  await pool.query("UPDATE orders SET created_at=now()-interval '30 days' WHERE id=ANY($1::uuid[])", [[pending,cancelled]]);
  await runRetentionCleanup();
  assert.equal(await status(pending), 'pending'); assert.equal(await stock(p), 3);
  assert.equal((await pool.query('SELECT id FROM orders WHERE id=$1', [cancelled])).rows.length, 0);
});

test('real PostgreSQL: competing cancellations release inventory only once', { skip: !external }, async () => {
  const p = await product(0); const id = await order(p, [2]);
  await Promise.all([changeOrderStatus(id,'cancelled'), changeOrderStatus(id,'cancelled')]);
  assert.equal(await stock(p), 2);
});
