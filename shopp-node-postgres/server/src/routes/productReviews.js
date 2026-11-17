import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

export const productReviewsRouter=Router();
const statuses=new Set(['pending_review','approved','rejected']);
const sources=new Set(['user_review','manual','scanner','internet']);
const fields=['name','brand','category','productType','subcategory','imageUrl','thumbnailUri','productUrl','notes'];
const fail=(res,status,code,message)=>res.status(status).json({error:{code,message}});
const barcodeOf=(value)=>String(value||'').replace(/\D/g,'').trim();
const clean=(value)=>typeof value==='string'?value.trim():'';
const isObject=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function normalizeBody(body,{requireName=false}={}) {
  if(!isObject(body)) return {error:'El cuerpo debe ser un objeto JSON.'};
  const data={};
  for(const field of fields) {
    if(body[field]===undefined) continue;
    if(body[field]!==null&&typeof body[field]!=='string') return {error:`${field} debe ser texto o null.`};
    const value=typeof body[field]==='string'?body[field].trim():null;
    data[field]=value||null;
  }
  if(body.details!==undefined) {
    if(!isObject(body.details)) return {error:'details debe ser un objeto.'};
    data.details=body.details;
  }
  if(requireName&&!clean(body.name)) return {error:'El nombre del producto es obligatorio.'};
  if(body.source!==undefined&&!sources.has(body.source)) return {error:'source no es válido.'};
  return {data};
}
function rowToReview(row) {
  return {id:row.id,_id:row.id,barcode:row.barcode,submittedBy:row.submitted_by,submitterEmail:row.submitter_email,
    ...row.data,status:row.status,source:row.source,reviewNote:row.review_note,reviewedBy:row.reviewed_by,
    reviewedAt:row.reviewed_at_ms==null?undefined:Number(row.reviewed_at_ms),createdAt:Number(row.created_at_ms),updatedAt:Number(row.updated_at_ms)};
}
async function findReview(client,id,{lock=false}={}) {
  const {rows}=await client.query(`SELECT * FROM product_review_submissions WHERE id=$1${lock?' FOR UPDATE':''}`,[id]);
  return rows[0]||null;
}

productReviewsRouter.post('/',requireAuth,async(req,res,next)=>{
  const barcode=barcodeOf(req.body?.barcode);
  if(!/^\d{8,14}$/.test(barcode)) return fail(res,400,'invalid_barcode','El código debe contener entre 8 y 14 dígitos.');
  const normalized=normalizeBody(req.body,{requireName:true});
  if(normalized.error) return fail(res,400,'invalid_input',normalized.error);
  const source=req.body.source||'user_review',now=Date.now(),id=randomUUID();
  try {
    const {rows:userRows}=await pool.query('SELECT email FROM app_users WHERE id=$1',[req.auth.user.id]);
    const email=userRows[0]?.email||null;
    const {rows}=await pool.query(
      `INSERT INTO product_review_submissions(id,barcode,submitted_by,submitter_email,name,brand,category,product_type,subcategory,image_url,thumbnail_uri,product_url,details,notes,source,status,created_at_ms,updated_at_ms)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,'pending_review',$16,$16)
       ON CONFLICT (submitted_by,barcode) WHERE status='pending_review' DO UPDATE SET
         submitter_email=EXCLUDED.submitter_email,name=EXCLUDED.name,brand=EXCLUDED.brand,category=EXCLUDED.category,
         product_type=EXCLUDED.product_type,subcategory=EXCLUDED.subcategory,image_url=EXCLUDED.image_url,
         thumbnail_uri=EXCLUDED.thumbnail_uri,product_url=EXCLUDED.product_url,details=EXCLUDED.details,notes=EXCLUDED.notes,
         source=EXCLUDED.source,updated_at_ms=EXCLUDED.updated_at_ms
       RETURNING *`,
      [id,barcode,req.auth.user.id,email,normalized.data.name,normalized.data.brand??null,normalized.data.category??null,
        normalized.data.productType??null,normalized.data.subcategory??null,normalized.data.imageUrl??null,normalized.data.thumbnailUri??null,
        normalized.data.productUrl??null,normalized.data.details===undefined?null:JSON.stringify(normalized.data.details),normalized.data.notes??null,source,now]);
    res.status(201).json({submission:rowToReview({...rows[0],data:reviewDataFromRow(rows[0])})});
  } catch(error) { next(error); }
});

function reviewDataFromRow(row) {
  return {name:row.name,brand:row.brand,category:row.category,productType:row.product_type,subcategory:row.subcategory,
    imageUrl:row.image_url,thumbnailUri:row.thumbnail_uri,productUrl:row.product_url,details:row.details,notes:row.notes};
}

productReviewsRouter.get('/',requireAuth,requireAdmin,async(req,res,next)=>{
  const status=req.query.status||'pending_review';
  if(!statuses.has(status)) return fail(res,400,'invalid_status','Estado de revisión no válido.');
  const parsed=Number.parseInt(req.query.limit,10),limit=Number.isFinite(parsed)?Math.min(Math.max(parsed,1),300):100;
  try {
    const {rows}=await pool.query('SELECT * FROM product_review_submissions WHERE status=$1 ORDER BY created_at_ms DESC LIMIT $2',[status,limit]);
    res.json({submissions:rows.map(row=>rowToReview({...row,data:reviewDataFromRow(row)}))});
  } catch(error) { next(error); }
});

productReviewsRouter.patch('/:id',requireAuth,requireAdmin,async(req,res,next)=>{
  const normalized=normalizeBody(req.body);
  if(normalized.error) return fail(res,400,'invalid_input',normalized.error);
  if(req.body.barcode!==undefined&&!/^\d{8,14}$/.test(barcodeOf(req.body.barcode))) return fail(res,400,'invalid_barcode','El código debe contener entre 8 y 14 dígitos.');
  const data=normalized.data;
  try {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const existing=await findReview(client,req.params.id,{lock:true});
      if(!existing) { await client.query('ROLLBACK'); return fail(res,404,'not_found','No se encontró la revisión.'); }
      if(existing.status!=='pending_review') { await client.query('ROLLBACK'); return fail(res,409,'not_pending','La revisión ya no está pendiente.'); }
      const current=reviewDataFromRow(existing);
      const next={...current,...data};
      const barcode=req.body.barcode===undefined?existing.barcode:barcodeOf(req.body.barcode);
      const {rows}=await client.query(
        `UPDATE product_review_submissions SET barcode=$2,name=$3,brand=$4,category=$5,product_type=$6,subcategory=$7,image_url=$8,
         thumbnail_uri=$9,product_url=$10,details=$11::jsonb,notes=$12,review_note=$13,updated_at_ms=$14 WHERE id=$1 RETURNING *`,
        [existing.id,barcode,next.name,next.brand,next.category,next.productType,next.subcategory,next.imageUrl,next.thumbnailUri,next.productUrl,
          next.details===undefined?null:JSON.stringify(next.details),next.notes,req.body.reviewNote===undefined?existing.review_note:clean(req.body.reviewNote)||null,Date.now()]);
      await client.query('COMMIT');
      const row=rows[0];
      res.json({submission:rowToReview({...row,data:reviewDataFromRow(row)})});
    } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { client.release(); }
  } catch(error) { next(error); }
});

async function moderate(req,res,next,status) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const submission=await findReview(client,req.params.id,{lock:true});
    if(!submission) { await client.query('ROLLBACK'); return fail(res,404,'not_found','No se encontró el producto enviado.'); }
    if(submission.status!=='pending_review') { await client.query('ROLLBACK'); return fail(res,409,'not_pending','La revisión ya no está pendiente.'); }
    const now=Date.now();
    const reviewNote=clean(req.body?.reviewNote)||submission.review_note;
    if(status==='approved') {
      const data=reviewDataFromRow(submission);
      await client.query(
        `INSERT INTO product_catalog(barcode,status,source,access_count,lookup_failure_count,created_at_ms,updated_at_ms,last_accessed_at_ms,last_external_lookup_at_ms,next_external_lookup_at_ms,data)
         VALUES($1,'complete','manual',1,0,$2,$2,$2,NULL,NULL,$3::jsonb)
         ON CONFLICT(barcode) DO UPDATE SET status='complete',source='manual',updated_at_ms=$2,last_accessed_at_ms=$2,
           next_external_lookup_at_ms=NULL,lookup_failure_count=0,data=product_catalog.data || EXCLUDED.data`,
        [submission.barcode,now,JSON.stringify(data)]);
    }
    const {rows}=await client.query(
      'UPDATE product_review_submissions SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at_ms=$5,updated_at_ms=$5 WHERE id=$1 RETURNING *',
      [submission.id,status,reviewNote||null,req.auth.user.id,now]);
    await client.query('COMMIT');
    const row=rows[0];
    res.json({submission:rowToReview({...row,data:reviewDataFromRow(row)})});
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); next(error); }
  finally { client.release(); }
}

productReviewsRouter.post('/:id/approve',requireAuth,requireAdmin,(req,res,next)=>moderate(req,res,next,'approved'));
productReviewsRouter.post('/:id/reject',requireAuth,requireAdmin,(req,res,next)=>moderate(req,res,next,'rejected'));
