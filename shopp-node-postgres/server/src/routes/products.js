import { Router } from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireAuth, requireFeature } from '../middleware/auth.js';

export const productsRouter = Router();
productsRouter.use(requireAuth);

const barcodePattern = /^\d{8,14}$/;
const optionalTextFields = ['name','brand','productType','category','subcategory','imageUrl','thumbnailUri','productUrl','notes'];
const sources = new Set(['convex','internet','manual','scanner']);
const statuses = new Set(['pending','complete','not_found']);
const fail = (res,status,code,message) => res.status(status).json({error:{code,message}});
const barcodeOf = (value) => String(value || '').replace(/\D/g,'').trim();
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateBarcode(value) { return barcodePattern.test(barcodeOf(value)); }
function productFromRow(row) {
  return {
    ...row.data, barcode:row.barcode, status:row.status, source:row.source,
    accessCount:row.access_count, lookupFailureCount:row.lookup_failure_count,
    lastExternalLookupAt:row.last_external_lookup_at_ms == null ? undefined : Number(row.last_external_lookup_at_ms),
    nextExternalLookupAt:row.next_external_lookup_at_ms == null ? undefined : Number(row.next_external_lookup_at_ms),
    createdAt:Number(row.created_at_ms), updatedAt:Number(row.updated_at_ms), lastAccessedAt:Number(row.last_accessed_at_ms),
  };
}
function normalizeProductBody(body) {
  if (!isObject(body)) return { error:'El cuerpo debe ser un objeto JSON.' };
  const data = {};
  for (const field of optionalTextFields) {
    if (body[field] !== undefined) {
      if (body[field] !== null && typeof body[field] !== 'string') return { error:`${field} debe ser texto o null.` };
      const value = typeof body[field] === 'string' ? body[field].trim() : null;
      data[field] = value || null;
    }
  }
  if (body.details !== undefined) {
    if (!isObject(body.details)) return { error:'details debe ser un objeto.' };
    data.details = body.details;
  }
  if (body.source !== undefined && !sources.has(body.source)) return { error:'source no es válido.' };
  if (body.status !== undefined && !statuses.has(body.status)) return { error:'status no es válido.' };
  return { data, source:body.source || 'manual', status:body.status };
}

productsRouter.get('/search', async (req,res,next) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json({products:[]});
  if (query.length > 100) return fail(res,400,'invalid_query','La búsqueda no puede superar los 100 caracteres.');
  const requestedLimit = Number.parseInt(req.query.limit,10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(50,Math.max(1,requestedLimit)) : 20;
  const pattern = query.replace(/[\\%_]/g, (character) => `\\${character}`);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM product_catalog
       WHERE status='complete' AND (
         COALESCE(data->>'name','') ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR
         COALESCE(data->>'brand','') ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR
         COALESCE(data->>'category','') ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR
         COALESCE(data->>'subcategory','') ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR
         ($2 <> '' AND barcode LIKE '%' || $2 || '%')
       )
       ORDER BY CASE WHEN barcode=$2 THEN 0 WHEN data->>'name' ILIKE $3 ESCAPE E'\\\\' THEN 1 ELSE 2 END,
         last_accessed_at_ms DESC
       LIMIT $4`,
      [pattern,query.replace(/\D/g,''),`${pattern}%`,limit],
    );
    res.json({products:rows.map(productFromRow)});
  } catch(error) { next(error); }
});

productsRouter.get('/:barcode', async (req,res,next) => {
  const barcode = barcodeOf(req.params.barcode);
  if (!validateBarcode(barcode)) return fail(res,400,'invalid_barcode','El código debe contener entre 8 y 14 dígitos.');
  try {
    const { rows } = await pool.query('SELECT * FROM product_catalog WHERE barcode=$1',[barcode]);
    if (!rows[0]) return fail(res,404,'not_found','No existe una ficha para ese código.');
    res.json({product:productFromRow(rows[0])});
  } catch(error) { next(error); }
});

productsRouter.post('/:barcode/access', requireFeature('scanner'), async (req,res,next) => {
  const barcode = barcodeOf(req.params.barcode);
  if (!validateBarcode(barcode)) return fail(res,400,'invalid_barcode','El código debe contener entre 8 y 14 dígitos.');
  const now = Date.now();
  try {
    const { rows } = await pool.query(
      `INSERT INTO product_catalog (barcode,status,source,access_count,lookup_failure_count,created_at_ms,updated_at_ms,last_accessed_at_ms)
       VALUES ($1,'pending','scanner',1,0,$2,$2,$2)
       ON CONFLICT (barcode) DO UPDATE SET access_count=product_catalog.access_count+1,last_accessed_at_ms=$2,updated_at_ms=$2
       RETURNING *, (xmax = 0) AS was_inserted`,[barcode,now]);
    res.json({created:rows[0].was_inserted,product:productFromRow(rows[0])});
  } catch(error) { next(error); }
});

// Public catalog writes go through productReviews; direct writes are reserved for admins.
productsRouter.put('/:barcode', requireAdmin, async (req,res,next) => {
  const barcode = barcodeOf(req.params.barcode);
  if (!validateBarcode(barcode)) return fail(res,400,'invalid_barcode','El código debe contener entre 8 y 14 dígitos.');
  const normalized = normalizeProductBody(req.body);
  if (normalized.error) return fail(res,400,'invalid_input',normalized.error);
  const now = Date.now();
  const hasUsefulData = Object.values(normalized.data).some((value) => value !== null && value !== undefined && value !== '');
  const status = normalized.status || (hasUsefulData ? 'complete' : 'pending');
  try {
    const { rows } = await pool.query(
      `INSERT INTO product_catalog (barcode,status,source,access_count,lookup_failure_count,created_at_ms,updated_at_ms,last_accessed_at_ms,last_external_lookup_at_ms,next_external_lookup_at_ms,data)
       VALUES ($1,$2,$3,1,0,$4,$4,$4,CASE WHEN $3='internet' AND $2='complete' THEN $4 ELSE NULL END,NULL,$5::jsonb)
       ON CONFLICT (barcode) DO UPDATE SET
         data=product_catalog.data || EXCLUDED.data,status=EXCLUDED.status,source=EXCLUDED.source,updated_at_ms=$4,last_accessed_at_ms=$4,
         last_external_lookup_at_ms=CASE WHEN $3='internet' AND $2='complete' THEN $4 ELSE product_catalog.last_external_lookup_at_ms END,
         next_external_lookup_at_ms=CASE WHEN $2='complete' THEN NULL ELSE product_catalog.next_external_lookup_at_ms END,
         lookup_failure_count=CASE WHEN $2='complete' THEN 0 ELSE product_catalog.lookup_failure_count END
       RETURNING *`,[barcode,status,normalized.source,now,JSON.stringify(normalized.data)]);
    res.json({product:productFromRow(rows[0])});
  } catch(error) { next(error); }
});

productsRouter.post('/:barcode/not-found', requireFeature('scanner'), async (req,res,next) => {
  const barcode = barcodeOf(req.params.barcode);
  if (!validateBarcode(barcode)) return fail(res,400,'invalid_barcode','El código debe contener entre 8 y 14 dígitos.');
  const now = Date.now();
  try {
    const { rows } = await pool.query(
      `INSERT INTO product_catalog (barcode,status,source,access_count,lookup_failure_count,last_external_lookup_at_ms,next_external_lookup_at_ms,created_at_ms,updated_at_ms,last_accessed_at_ms)
       VALUES ($1,'not_found','internet',1,1,$2,$2 + 604800000,$2,$2,$2)
       ON CONFLICT (barcode) DO UPDATE SET status='not_found',source='internet',lookup_failure_count=product_catalog.lookup_failure_count+1,
         last_external_lookup_at_ms=$2,next_external_lookup_at_ms=$2 + 604800000,updated_at_ms=$2,last_accessed_at_ms=$2
       RETURNING *`,[barcode,now]);
    res.json({product:productFromRow(rows[0])});
  } catch(error) { next(error); }
});

productsRouter.delete('/:barcode', requireAdmin, async (req,res,next) => {
  const barcode = barcodeOf(req.params.barcode);
  if (!validateBarcode(barcode)) return fail(res,400,'invalid_barcode','El código debe contener entre 8 y 14 dígitos.');
  try {
    const result = await pool.query('DELETE FROM product_catalog WHERE barcode=$1',[barcode]);
    res.json({deleted:result.rowCount>0,barcode});
  } catch(error) { next(error); }
});
