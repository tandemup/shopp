import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { normalizeBarcode, readPayload, scanFromRow } from './scanHistory.js';

export const shoppingListsRouter = Router();
shoppingListsRouter.use(requireAuth);

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const cleanId = (value) => typeof value === 'string' && idPattern.test(value) ? value : null;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const asData = (value, reserved) => Object.fromEntries(Object.entries(value).filter(([key]) => !reserved.includes(key)));

function validateListInput(body, { partial = false } = {}) {
  if (!isObject(body)) return 'El cuerpo debe ser un objeto JSON.';
  if (!partial && (typeof body.name !== 'string' || !body.name.trim())) return 'El nombre de la lista es obligatorio.';
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 160)) return 'El nombre debe tener entre 1 y 160 caracteres.';
  if (body.currency !== undefined && (typeof body.currency !== 'string' || body.currency.length > 8)) return 'La moneda no es válida.';
  if (body.archived !== undefined && typeof body.archived !== 'boolean') return 'archived debe ser booleano.';
  if (body.archivedAt !== undefined && body.archivedAt !== null && !Number.isSafeInteger(body.archivedAt)) return 'archivedAt no es válido.';
  if (body.storeId !== undefined && body.storeId !== null && typeof body.storeId !== 'string') return 'storeId no es válido.';
  if (body.items !== undefined && !Array.isArray(body.items)) return 'items debe ser una lista.';
  return null;
}

function validateItemInput(body, { partial = false } = {}) {
  if (!isObject(body)) return 'El cuerpo debe ser un objeto JSON.';
  if (!partial && (typeof body.name !== 'string' || !body.name.trim())) return 'El nombre del producto es obligatorio.';
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 300)) return 'El nombre del producto debe tener entre 1 y 300 caracteres.';
  if (body.checked !== undefined && typeof body.checked !== 'boolean') return 'checked debe ser booleano.';
  return null;
}

function listFromRow(row, items = []) {
  return {
    ...row.data,
    id: row.list_id,
    name: row.name,
    currency: row.currency,
    items,
    createdAt: Number(row.created_at_ms),
    archived: row.archived,
    archivedAt: row.archived_at_ms === null ? null : Number(row.archived_at_ms),
    storeId: row.store_id,
  };
}

function itemFromRow(row) {
  return { ...row.data, id: row.item_id, name: row.name, checked: row.checked };
}

async function getList(client, ownerId, listId, { lock = false } = {}) {
  const result = await client.query(
    `SELECT * FROM shopping_lists WHERE owner_id = $1 AND list_id = $2${lock ? ' FOR UPDATE' : ''}`,
    [ownerId, listId],
  );
  return result.rows[0] || null;
}

async function readLists(client, ownerId) {
  const { rows: lists } = await client.query(
    `SELECT * FROM shopping_lists WHERE owner_id = $1 ORDER BY archived ASC, created_at_ms DESC`,
    [ownerId],
  );
  if (!lists.length) return [];
  const { rows: items } = await client.query(
    `SELECT * FROM shopping_list_items WHERE owner_id = $1 ORDER BY list_id, position, created_at`,
    [ownerId],
  );
  const itemsByList = new Map();
  for (const row of items) {
    const group = itemsByList.get(row.list_id) || [];
    group.push(itemFromRow(row));
    itemsByList.set(row.list_id, group);
  }
  return lists.map((row) => listFromRow(row, itemsByList.get(row.list_id) || []));
}

shoppingListsRouter.get('/lists', async (req, res, next) => {
  try {
    res.json({ lists: await readLists(pool, req.auth.user.id) });
  } catch (error) { next(error); }
});

async function insertList(client, ownerId, listId, list) {
  const { rows } = await client.query(
    `INSERT INTO shopping_lists (owner_id, list_id, name, currency, archived, archived_at_ms, store_id, created_at_ms, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
    [ownerId, listId, list.name.trim(), list.currency || 'EUR', list.archived === true,
      list.archivedAt ?? null, list.storeId ?? null,
      Number.isSafeInteger(list.createdAt) ? list.createdAt : Date.now(),
      JSON.stringify(asData(list, ['id','name','currency','items','createdAt','archived','archivedAt','storeId']))],
  );
  const items = Array.isArray(list.items) ? list.items : [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const itemError = validateItemInput(item);
    const itemId = cleanId(item?.id);
    if (itemError || !itemId) throw Object.assign(new Error(itemError || 'El identificador de producto no es válido.'), { status: 400, code: 'invalid_input' });
    await client.query(
      `INSERT INTO shopping_list_items (owner_id,list_id,item_id,name,checked,position,data)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [ownerId,listId,itemId,item.name.trim(),item.checked === true,i,
        JSON.stringify(asData(item,['id','name','checked']))],
    );
  }
  return listFromRow(rows[0], items);
}

const canUseScanner = (user) => user.role === 'admin' || user.permissions?.scanner === true;

shoppingListsRouter.get('/user-data', async (req, res, next) => {
  const user = req.auth.user;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const lists = await readLists(client, user.id);
    const scans = canUseScanner(user) ? await client.query(
      'SELECT * FROM user_scan_history WHERE owner_id=$1 ORDER BY updated_at_ms DESC, barcode',
      [user.id],
    ) : { rows: [] };
    await client.query('COMMIT');
    res.json({ lists, scanHistory: scans.rows.map(scanFromRow) });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client?.release();
  }
});

shoppingListsRouter.post('/user-data', async (req, res, next) => {
  const user = req.auth.user;
  const { mode, lists, scanHistory } = req.body ?? {};
  if (!['merge', 'replace'].includes(mode) || !Array.isArray(lists) || !Array.isArray(scanHistory)) {
    return fail(res, 400, 'invalid_input', 'El archivo debe incluir listas, escaneos y un modo de importación válido.');
  }
  const canWriteScans = canUseScanner(user) && user.scan_history_sync_enabled === true;
  if (scanHistory.length && !canWriteScans) {
    return fail(res, 403, 'scan_import_disabled', 'Para importar escaneos necesitas acceso al Escáner y activar la sincronización en Mi perfil.');
  }

  const receivedLists = new Map();
  for (const entry of lists) {
    const list = isObject(entry) && isObject(entry.currency)
      ? { ...entry, currency: entry.currency.code }
      : entry;
    const id = cleanId(list?.id);
    const invalid = validateListInput(list);
    if (invalid || !id || receivedLists.has(id)) {
      return fail(res, 400, 'invalid_list', invalid || 'Hay una lista con ID inválido o duplicado.');
    }
    receivedLists.set(id, list);
  }

  const scans = new Map();
  for (const item of scanHistory) {
    const barcode = normalizeBarcode(item?.barcode);
    const payload = readPayload(item);
    if (!barcode || barcode.length > 64 || payload.error) {
      return fail(res, 400, 'invalid_scan', payload.error || 'Hay un escaneo con un código no válido.');
    }
    scans.set(barcode, { item, data: payload.data });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const previousLists = mode === 'merge' ? await readLists(client, user.id) : [];
    const byId = new Map(previousLists.map((list) => [list.id, list]));

    if (mode === 'replace') {
      await client.query('DELETE FROM shopping_lists WHERE owner_id=$1', [user.id]);
      if (canWriteScans) await client.query('DELETE FROM user_scan_history WHERE owner_id=$1', [user.id]);
    }

    for (const [id, list] of receivedLists) {
      const previous = byId.get(id);
      const items = new Map((previous?.items ?? []).map((item) => [item.id, item]));
      const receivedItems = new Set();
      for (const item of list.items ?? []) {
        const itemId = cleanId(item?.id);
        const itemError = validateItemInput(item);
        if (!itemId || itemError || receivedItems.has(itemId)) {
          throw Object.assign(new Error(itemError || 'Hay un producto con ID inválido o duplicado.'), { status: 400 });
        }
        receivedItems.add(itemId);
        items.set(itemId, { ...items.get(itemId), ...item });
      }
      if (previous) await client.query('DELETE FROM shopping_lists WHERE owner_id=$1 AND list_id=$2', [user.id, id]);
      await insertList(client, user.id, id, { ...previous, ...list, items: [...items.values()] });
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    for (const [barcode, { item, data }] of scans) {
      const count = Number.isInteger(item.scanCount) && item.scanCount > 0 && item.scanCount <= 2147483647 ? item.scanCount : 1;
      const scannedAt = typeof item.scannedAt === 'string' ? item.scannedAt : nowIso;
      const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : scannedAt;
      const createdMs = Number.isSafeInteger(item.createdAt) ? item.createdAt : now;
      const updatedMs = Number.isSafeInteger(item.updatedAtMs) ? item.updatedAtMs : now;
      await client.query(
        `INSERT INTO user_scan_history (owner_id, barcode, scanned_at, updated_at, scan_count, created_at_ms, updated_at_ms, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (owner_id,barcode) DO UPDATE SET
           data = user_scan_history.data || EXCLUDED.data, scanned_at = EXCLUDED.scanned_at,
           updated_at = EXCLUDED.updated_at, scan_count = EXCLUDED.scan_count, updated_at_ms = EXCLUDED.updated_at_ms`,
        [user.id, barcode, scannedAt, updatedAt, count, createdMs, updatedMs, JSON.stringify(data)],
      );
    }
    await client.query('COMMIT');
    res.json({ lists: receivedLists.size, scans: scans.size, scanHistoryUpdated: canWriteScans });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    if (error.status === 400) return fail(res, 400, 'invalid_item', error.message);
    if (['40001', '40P01', '23505'].includes(error.code)) {
      return fail(res, 409, 'concurrent_import', 'Los datos cambiaron durante la importación. Vuelve a intentarlo.');
    }
    next(error);
  } finally {
    client?.release();
  }
});

shoppingListsRouter.post('/lists', async (req, res, next) => {
  const invalid = validateListInput(req.body);
  if (invalid) return fail(res, 400, 'invalid_input', invalid);
  const ownerId = req.auth.user.id;
  const listId = req.body.id === undefined ? randomUUID() : cleanId(req.body.id);
  if (!listId) return fail(res, 400, 'invalid_id', 'El identificador de lista no es válido.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await insertList(client, ownerId, listId, req.body);
    await client.query('COMMIT');
    res.status(201).json({ list: created });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return fail(res, 409, 'already_exists', 'Ya existe una lista con ese identificador.');
    if (error.status) return fail(res, error.status, error.code, error.message);
    next(error);
  } finally { client.release(); }
});

shoppingListsRouter.get('/lists/:listId', async (req, res, next) => {
  const listId = cleanId(req.params.listId);
  if (!listId) return fail(res, 400, 'invalid_id', 'El identificador de lista no es válido.');
  try {
    const list = await getList(pool, req.auth.user.id, listId);
    if (!list) return fail(res, 404, 'not_found', 'No se encontró la lista.');
    const { rows } = await pool.query(
      `SELECT * FROM shopping_list_items WHERE owner_id=$1 AND list_id=$2 ORDER BY position, created_at`,
      [req.auth.user.id, listId],
    );
    res.json({ list: listFromRow(list, rows.map(itemFromRow)) });
  } catch (error) { next(error); }
});

shoppingListsRouter.patch('/lists/:listId', async (req, res, next) => {
  const listId = cleanId(req.params.listId);
  const invalid = validateListInput(req.body, { partial: true });
  if (!listId) return fail(res, 400, 'invalid_id', 'El identificador de lista no es válido.');
  if (invalid) return fail(res, 400, 'invalid_input', invalid);
  if ('items' in req.body) return fail(res, 400, 'items_require_item_routes', 'Actualiza los productos mediante las rutas /items.');
  try {
    const current = await getList(pool, req.auth.user.id, listId);
    if (!current) return fail(res, 404, 'not_found', 'No se encontró la lista.');
    const updated = await pool.query(
      `UPDATE shopping_lists SET
       name=COALESCE($3,name), currency=COALESCE($4,currency), archived=COALESCE($5,archived),
       archived_at_ms=CASE WHEN $6 THEN $7 ELSE archived_at_ms END,
       store_id=CASE WHEN $8 THEN $9 ELSE store_id END,
       data=data || $10::jsonb, updated_at=NOW()
       WHERE owner_id=$1 AND list_id=$2 RETURNING *`,
      [req.auth.user.id,listId,req.body.name?.trim() ?? null,req.body.currency ?? null,req.body.archived ?? null,
        Object.hasOwn(req.body,'archivedAt'),req.body.archivedAt ?? null,
        Object.hasOwn(req.body,'storeId'),req.body.storeId ?? null,
        JSON.stringify(asData(req.body,['id','name','currency','items','createdAt','archived','archivedAt','storeId']))],
    );
    const { rows: items } = await pool.query(`SELECT * FROM shopping_list_items WHERE owner_id=$1 AND list_id=$2 ORDER BY position,created_at`,[req.auth.user.id,listId]);
    res.json({ list: listFromRow(updated.rows[0],items.map(itemFromRow)) });
  } catch (error) { next(error); }
});

shoppingListsRouter.delete('/lists/:listId', async (req, res, next) => {
  const listId = cleanId(req.params.listId);
  if (!listId) return fail(res, 400, 'invalid_id', 'El identificador de lista no es válido.');
  try {
    const result = await pool.query('DELETE FROM shopping_lists WHERE owner_id=$1 AND list_id=$2',[req.auth.user.id,listId]);
    if (!result.rowCount) return fail(res, 404, 'not_found', 'No se encontró la lista.');
    res.status(204).end();
  } catch (error) { next(error); }
});

shoppingListsRouter.post('/lists/:listId/items', async (req, res, next) => {
  const listId = cleanId(req.params.listId);
  const invalid = validateItemInput(req.body);
  if (!listId) return fail(res, 400, 'invalid_id', 'El identificador de lista no es válido.');
  if (invalid) return fail(res, 400, 'invalid_input', invalid);
  const itemId = req.body.id === undefined ? randomUUID() : cleanId(req.body.id);
  if (!itemId) return fail(res, 400, 'invalid_id', 'El identificador de producto no es válido.');
  try {
    const list = await getList(pool, req.auth.user.id, listId);
    if (!list) return fail(res, 404, 'not_found', 'No se encontró la lista.');
    const { rows: positionRows } = await pool.query('SELECT COALESCE(MAX(position),-1)+1 AS next FROM shopping_list_items WHERE owner_id=$1 AND list_id=$2',[req.auth.user.id,listId]);
    const { rows } = await pool.query(
      `INSERT INTO shopping_list_items (owner_id,list_id,item_id,name,checked,position,data)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
      [req.auth.user.id,listId,itemId,req.body.name.trim(),req.body.checked === true,positionRows[0].next,JSON.stringify(asData(req.body,['id','name','checked']))],
    );
    res.status(201).json({ item: itemFromRow(rows[0]) });
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'already_exists', 'Ya existe un producto con ese identificador en la lista.');
    next(error);
  }
});

shoppingListsRouter.patch('/lists/:listId/items/:itemId', async (req, res, next) => {
  const { listId, itemId } = req.params;
  const invalid = validateItemInput(req.body, { partial: true });
  if (!cleanId(listId) || !cleanId(itemId)) return fail(res, 400, 'invalid_id', 'El identificador no es válido.');
  if (invalid) return fail(res, 400, 'invalid_input', invalid);
  try {
    const { rows } = await pool.query(
      `UPDATE shopping_list_items SET name=COALESCE($4,name), checked=COALESCE($5,checked), data=data || $6::jsonb, updated_at=NOW()
       WHERE owner_id=$1 AND list_id=$2 AND item_id=$3 RETURNING *`,
      [req.auth.user.id,listId,itemId,req.body.name?.trim() ?? null,req.body.checked ?? null,JSON.stringify(asData(req.body,['id','name','checked']))],
    );
    if (!rows[0]) return fail(res, 404, 'not_found', 'No se encontró el producto en esa lista.');
    res.json({ item: itemFromRow(rows[0]) });
  } catch (error) { next(error); }
});

shoppingListsRouter.delete('/lists/:listId/items/:itemId', async (req, res, next) => {
  const { listId, itemId } = req.params;
  if (!cleanId(listId) || !cleanId(itemId)) return fail(res, 400, 'invalid_id', 'El identificador no es válido.');
  try {
    const result = await pool.query('DELETE FROM shopping_list_items WHERE owner_id=$1 AND list_id=$2 AND item_id=$3',[req.auth.user.id,listId,itemId]);
    if (!result.rowCount) return fail(res, 404, 'not_found', 'No se encontró el producto en esa lista.');
    res.status(204).end();
  } catch (error) { next(error); }
});
