import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

export const storeOffersRouter=Router();
const statuses=new Set(['pending','approved','rejected']);
const fail=(res,status,code,message)=>res.status(status).json({error:{code,message}});
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function adminOffer(row) {
  return {id:row.id,_id:row.id,submittedBy:row.submitted_by,submissionType:row.submission_type,storeId:row.store_id,
    productName:row.product_name,barcode:row.barcode,offerText:row.offer_text,startsAt:row.starts_at_ms==null?undefined:Number(row.starts_at_ms),
    endsAt:row.ends_at_ms==null?undefined:Number(row.ends_at_ms),contactName:row.contact_name,contactEmail:row.contact_email,notes:row.notes,
    status:row.status,createdAt:Number(row.created_at_ms),updatedAt:Number(row.updated_at_ms)};
}
function publicOffer(row) {
  return {id:row.id,_id:row.id,submissionType:row.submission_type,storeId:row.store_id,productName:row.product_name,
    barcode:row.barcode,offerText:row.offer_text,startsAt:row.starts_at_ms==null?undefined:Number(row.starts_at_ms),
    endsAt:row.ends_at_ms==null?undefined:Number(row.ends_at_ms),status:row.status,createdAt:Number(row.created_at_ms)};
}

storeOffersRouter.get('/approved',async(req,res,next)=>{
  const parsed=Number.parseInt(req.query.limit,10);
  const limit=Number.isFinite(parsed)?Math.min(Math.max(parsed,1),200):100;
  try {
    const {rows}=await pool.query("SELECT * FROM store_offer_submissions WHERE status='approved' ORDER BY created_at_ms DESC LIMIT $1",[limit]);
    res.json({offers:rows.map(publicOffer)});
  } catch(error) { next(error); }
});

storeOffersRouter.post('/',requireAuth,async(req,res,next)=>{
  const submissionType=req.body?.submissionType;
  const storeId=clean(req.body?.storeId,120),productName=clean(req.body?.productName,180),offerText=clean(req.body?.offerText,500);
  const barcode=clean(req.body?.barcode,32)||null,contactName=clean(req.body?.contactName,120)||null;
  const contactEmail=clean(req.body?.contactEmail,180)||null,notes=clean(req.body?.notes,1000)||null;
  if(!['shopper','owner'].includes(submissionType)||!storeId||!productName||!offerText) return fail(res,400,'invalid_input','Indica tipo, tienda, producto y descripción de la oferta.');
  if(submissionType==='owner'&&(!contactName||!contactEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) return fail(res,400,'contact_required','Las solicitudes comerciales requieren nombre y correo válidos.');
  for(const key of ['startsAt','endsAt']) if(req.body[key]!==undefined&&(!Number.isFinite(req.body[key])||!Number.isSafeInteger(req.body[key]))) return fail(res,400,'invalid_date',`${key} debe ser una fecha en milisegundos.`);
  if(req.body.startsAt!==undefined&&req.body.endsAt!==undefined&&req.body.endsAt<req.body.startsAt) return fail(res,400,'invalid_date','La fecha final debe ser posterior a la inicial.');
  try {
    const store=await pool.query('SELECT 1 FROM stores WHERE id=$1',[storeId]);
    if(!store.rowCount) return fail(res,404,'store_not_found','El supermercado seleccionado no existe.');
    const now=Date.now(),id=randomUUID();
    const {rows}=await pool.query(
      `INSERT INTO store_offer_submissions(id,submitted_by,submission_type,store_id,product_name,barcode,offer_text,starts_at_ms,ends_at_ms,contact_name,contact_email,notes,status,created_at_ms,updated_at_ms)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13,$13) RETURNING *`,
      [id,req.auth.user.id,submissionType,storeId,productName,barcode,offerText,req.body.startsAt??null,req.body.endsAt??null,contactName,contactEmail,notes,now]);
    res.status(201).json({offer:adminOffer(rows[0])});
  } catch(error) { next(error); }
});

storeOffersRouter.get('/',requireAuth,requireAdmin,async(req,res,next)=>{
  const status=req.query.status;
  if(status!==undefined&&!statuses.has(status)) return fail(res,400,'invalid_status','El estado debe ser pending, approved o rejected.');
  try {
    const query=status
      ? pool.query('SELECT * FROM store_offer_submissions WHERE status=$1 ORDER BY created_at_ms DESC',[status])
      : pool.query('SELECT * FROM store_offer_submissions ORDER BY created_at_ms DESC');
    const {rows}=await query;
    res.json({offers:rows.map(adminOffer)});
  } catch(error) { next(error); }
});

storeOffersRouter.patch('/:id/status',requireAuth,requireAdmin,async(req,res,next)=>{
  if(!statuses.has(req.body?.status)) return fail(res,400,'invalid_status','El estado debe ser pending, approved o rejected.');
  try {
    const {rows}=await pool.query('UPDATE store_offer_submissions SET status=$2,updated_at_ms=$3 WHERE id=$1 RETURNING *',[req.params.id,req.body.status,Date.now()]);
    if(!rows[0]) return fail(res,404,'not_found','No se encontró la oferta.');
    res.json({offer:adminOffer(rows[0])});
  } catch(error) { next(error); }
});
