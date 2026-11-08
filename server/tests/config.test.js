import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

test('configuración válida', () => {
  const result = readConfig({ DATABASE_URL: 'postgresql://test', PORT: '3001' });
  assert.equal(result.port, 3001);
});
test('requiere URL de PostgreSQL', () => {
  assert.throws(() => readConfig({}), /DATABASE_URL/);
});
test('rechaza puertos inválidos', () => {
  assert.throws(() => readConfig({ DATABASE_URL: 'test', PORT: '70000' }), /PORT/);
});
