import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

async function withServer(pool, callback) {
  const server = createApp({ pool }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await callback(base); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('GET /api/health responde sin consultar base de datos', async () => {
  await withServer({ query: () => { throw new Error('unexpected DB call'); } }, async (base) => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'shopp-api' });
  });
});
test('GET /api/ready detecta DB disponible', async () => {
  await withServer({ query: async () => ({ rows: [{ '?column?': 1 }] }) }, async (base) => {
    const response = await fetch(`${base}/api/ready`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).database, 'ok');
  });
});
test('GET /api/ready devuelve 503 si falla PostgreSQL', async () => {
  await withServer({ query: async () => { throw new Error('down'); } }, async (base) => {
    const response = await fetch(`${base}/api/ready`);
    assert.equal(response.status, 503);
  });
});
