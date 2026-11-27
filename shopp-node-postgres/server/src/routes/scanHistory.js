import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireFeature } from '../middleware/auth.js';

export const scanHistoryRouter = Router();
scanHistoryRouter.use(requireAuth, requireFeature('scanner'));

const fields = ['name','brand','url','productUrl','imageUrl','thumbnailUri','productType','category','subcategory','notes','source','lookupSource','dataSource'];
const fail = (res,status,code,message) => res.status(status).json({error:{code,message}});
export const normalizeBarcode = (value) => String(value || '').replace(/\D/g,'').trim();
export function scanFromRow(row) {
  return { ...row.data,id:row.barcode,barcode:row.barcode,scannedAt:row.scanned_at,updatedAt:row.updated_at,
    scanCount:row.scan_count,createdAt:Number(row.created_at_ms),updatedAtMs:Number(row.updated_at_ms) };
}
export function readPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {error:'El cuerpo debe ser un objeto JSON.'};
  const data={};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && typeof body[field] !== 'string') return {error:`${field} debe ser texto o null.`};
    data[field]=typeof body[field]==='string' ? body[field].trim() || null : null;
  }
  return {data};
}

scanHistoryRouter.get('/', async (req,res,next) => {
  const requested=Number.parseInt(req.query.limit,10);
  const limit=Number.isFinite(requested) ? Math.min(Math.max(requested,1),300) : 100;
  try {
    const {rows}=await pool.query('SELECT * FROM user_scan_history WHERE owner_id=$1 ORDER BY updated_at_ms DESC LIMIT $2',[req.auth.user.id,limit]);
    res.json({items:rows.map(scanFromRow)});
  } catch(error) { next(error); }
});

scanHistoryRouter.get('/:barcode', async (req,res,next) => {
  const barcode=normalizeBarcode(req.params.barcode);
  if (!barcode) return fail(res,400,'invalid_barcode','El código no es válido.');
  try {
    const {rows}=await pool.query('SELECT * FROM user_scan_history WHERE owner_id=$1 AND barcode=$2',[req.auth.user.id,barcode]);
    if (!rows[0]) return fail(res,404,'not_found','No existe ese producto en tu historial.');
    res.json({item:scanFromRow(rows[0])});
  } catch(error) { next(error); }
});

async function writeScan(req,res,next,{replaceCount=false}={}) {
  if (req.auth.user.scan_history_sync_enabled !== true) {
    return fail(res, 403, 'scan_sync_disabled', 'Activa la sincronización del historial en Mi cuenta para guardarlo en el servidor.');
  }
  const barcode=normalizeBarcode(req.params.barcode || req.body?.barcode);
  if (!barcode || barcode.length>64) return fail(res,400,'invalid_barcode','El código no es válido.');
  const payload=readPayload(req.body);
  if (payload.error) return fail(res,400,'invalid_input',payload.error);
  const now=Date.now(), nowIso=new Date(now).toISOString();
  const scannedAt=typeof req.body.scannedAt==='string' ? req.body.scannedAt : nowIso;
  const updatedAt=typeof req.body.updatedAt==='string' ? req.body.updatedAt : nowIso;
  const suppliedCount=Number(req.body.scanCount);
  const count=replaceCount && Number.isFinite(suppliedCount) ? Math.max(1,Math.trunc(suppliedCount)) : null;
  try {
    const {rows}=await pool.query(
      `INSERT INTO user_scan_history (owner_id,barcode,scanned_at,updated_at,scan_count,created_at_ms,updated_at_ms,data)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7::jsonb)
       ON CONFLICT (owner_id,barcode) DO UPDATE SET data=user_scan_history.data || EXCLUDED.data,
         scanned_at=COALESCE(user_scan_history.scanned_at,EXCLUDED.scanned_at),updated_at=EXCLUDED.updated_at,
         scan_count=CASE WHEN $8 THEN $5 ELSE user_scan_history.scan_count+1 END,updated_at_ms=$6
       RETURNING *`,
      [req.auth.user.id,barcode,scannedAt,updatedAt,count || 1,now,JSON.stringify(payload.data),replaceCount]);
    res.status(200).json({item:scanFromRow(rows[0])});
  } catch(error) { next(error); }
}

scanHistoryRouter.post('/',(req,res,next)=>writeScan(req,res,next));
scanHistoryRouter.put('/:barcode',(req,res,next)=>writeScan(req,res,next,{replaceCount:true}));

scanHistoryRouter.delete('/',async (req,res,next) => {
  try {
    const result=await pool.query('DELETE FROM user_scan_history WHERE owner_id=$1',[req.auth.user.id]);
    res.json({deleted:result.rowCount});
  } catch(error) { next(error); }
});

scanHistoryRouter.delete('/:barcode',async (req,res,next) => {
  const barcode=normalizeBarcode(req.params.barcode);
  if (!barcode) return fail(res,400,'invalid_barcode','El código no es válido.');
  try {
    const result=await pool.query('DELETE FROM user_scan_history WHERE owner_id=$1 AND barcode=$2',[req.auth.user.id,barcode]);
    res.json({deleted:result.rowCount>0});
  } catch(error) { next(error); }
});
