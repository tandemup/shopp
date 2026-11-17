import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

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

shoppingListsRouter.get('/lists', async (req, res, next) => {
  try {
    const { rows: lists } = await pool.query(
      `SELECT * FROM shopping_lists WHERE owner_id = $1 ORDER BY archived ASC, created_at_ms DESC`,
      [req.auth.user.id],
    );
    if (!lists.length) return res.json({ lists: [] });
    const { rows: items } = await pool.query(
      `SELECT * FROM shopping_list_items WHERE owner_id = $1 ORDER BY list_id, position, created_at`,
      [req.auth.user.id],
    );
    const itemsByList = new Map();
    for (const row of items) {
      const group = itemsByList.get(row.list_id) || [];
      group.push(itemFromRow(row));
      itemsByList.set(row.list_id, group);
    }
    res.json({ lists: lists.map((row) => listFromRow(row, itemsByList.get(row.list_id) || [])) });
  } catch (error) { next(error); }
});

shoppingListsRouter.post('/lists', async (req, res, next) => {
  const invalid = validateListInput(req.body);
  if (invalid) return fail(res, 400, 'invalid_input', invalid);
  const ownerId = req.auth.user.id;
  const listId = req.body.id === undefined ? randomUUID() : cleanId(req.body.id);
  if (!listId) return fail(res, 400, 'invalid_id', 'El identificador de lista no es válido.');
  const now = Date.now();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO shopping_lists (owner_id, list_id, name, currency, archived, archived_at_ms, store_id, created_at_ms, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
      [ownerId, listId, req.body.name.trim(), req.body.currency || 'EUR', req.body.archived === true,
        req.body.archivedAt ?? null, req.body.storeId ?? null,
        Number.isSafeInteger(req.body.createdAt) ? req.body.createdAt : now,
        JSON.stringify(asData(req.body, ['id','name','currency','items','createdAt','archived','archivedAt','storeId']))],
    );
    const items = Array.isArray(req.body.items) ? req.body.items : [];
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
    await client.query('COMMIT');
    res.status(201).json({ list: listFromRow(rows[0], items) });
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
