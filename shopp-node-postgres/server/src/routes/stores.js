import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { optionalAuth, requireAdmin, requireAuth, requireFeature } from '../middleware/auth.js';

export const storesRouter = Router();
const fail=(res,status,code,message)=>res.status(status).json({error:{code,message}});
const text=(value,fallback='')=>typeof value==='string'?value.trim():fallback;
const validLat=(value)=>Number.isFinite(value)&&value>=-90&&value<=90;
const validLng=(value)=>Number.isFinite(value)&&value>=-180&&value<=180;

function normalizeStore(raw) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Cada tienda debe ser un objeto.');
  const id=text(raw.id), name=text(raw.name), city=text(raw.city,'gijon')||'gijon';
  const lat=raw.location?.lat, lng=raw.location?.lng;
  if (!id || id.length>160) throw new Error('El identificador de tienda no es válido.');
  if (!name || name.length>180) throw new Error('El nombre de la tienda es obligatorio y no puede superar 180 caracteres.');
  if (!validLat(lat)||!validLng(lng)) throw new Error(`Las coordenadas de ${name} no son válidas.`);
  return {id,name,city,provincia:text(raw.provincia,'Asturias')||'Asturias',address:text(raw.address),zipcode:String(raw.zipcode??0),latitude:lat,longitude:lng,locationSource:text(raw.location?.source,'manual')||'manual'};
}
function storeFromRow(row,favorite=false) {
  return {id:row.id,name:row.name,address:row.address,city:row.city,provincia:row.provincia,zipcode:row.zipcode,
    location:{lat:Number(row.latitude),lng:Number(row.longitude),source:row.location_source},favorite};
}
const selectedStoreColumns='s.id,s.name,s.address,s.city,s.provincia,s.zipcode,s.latitude,s.longitude,s.location_source';

storesRouter.get('/',optionalAuth,async(req,res,next)=>{
  try {
    const {rows}=await pool.query(
      `SELECT ${selectedStoreColumns},(f.store_id IS NOT NULL) AS favorite FROM stores s
       LEFT JOIN user_store_favorites f ON f.store_id=s.id AND f.owner_id=$1 ORDER BY LOWER(s.name)`,
      [req.auth?.user?.id||null]);
    res.json({stores:rows.map(row=>storeFromRow(row,row.favorite))});
  } catch(error) { next(error); }
});

storesRouter.get('/favorites',requireAuth,requireFeature('stores'),async(req,res,next)=>{
  try {
    const {rows}=await pool.query(
      `SELECT ${selectedStoreColumns},TRUE AS favorite FROM stores s JOIN user_store_favorites f ON f.store_id=s.id
       WHERE f.owner_id=$1 ORDER BY s.name`,[req.auth.user.id]);
    res.json({stores:rows.map(row=>storeFromRow(row,true))});
  } catch(error) { next(error); }
});

storesRouter.get('/catalog/export',requireAuth,requireAdmin,async(_req,res,next)=>{
  try {
    const {rows}=await pool.query(`SELECT ${selectedStoreColumns} FROM stores s ORDER BY LOWER(s.name)`);
    res.json({stores:rows.map(row=>storeFromRow(row,false))});
  } catch(error) { next(error); }
});

storesRouter.get('/city/:city',optionalAuth,async(req,res,next)=>{
  try {
    const {rows}=await pool.query(
      `SELECT ${selectedStoreColumns},(f.store_id IS NOT NULL) AS favorite FROM stores s
       LEFT JOIN user_store_favorites f ON f.store_id=s.id AND f.owner_id=$1
       WHERE LOWER(s.city)=LOWER($2) ORDER BY s.name`,[req.auth?.user?.id||null,text(req.params.city)]);
    res.json({stores:rows.map(row=>storeFromRow(row,row.favorite))});
  } catch(error) { next(error); }
});

storesRouter.get('/:id',optionalAuth,async(req,res,next)=>{
  try {
    const {rows}=await pool.query(
      `SELECT ${selectedStoreColumns},(f.store_id IS NOT NULL) AS favorite FROM stores s
       LEFT JOIN user_store_favorites f ON f.store_id=s.id AND f.owner_id=$1 WHERE s.id=$2`,
      [req.auth?.user?.id||null,req.params.id]);
    if (!rows[0]) return fail(res,404,'not_found','No se encontró la tienda.');
    res.json({store:storeFromRow(rows[0],rows[0].favorite)});
  } catch(error) { next(error); }
});

storesRouter.put('/:id/favorite',requireAuth,requireFeature('stores'),async(req,res,next)=>{
  if (typeof req.body?.favorite!=='boolean') return fail(res,400,'invalid_input','favorite debe ser booleano.');
  try {
    const exists=await pool.query('SELECT 1 FROM stores WHERE id=$1',[req.params.id]);
    if (!exists.rowCount) return fail(res,404,'not_found','No se encontró la tienda.');
    if (req.body.favorite) {
      await pool.query('INSERT INTO user_store_favorites(owner_id,store_id,created_at_ms) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[req.auth.user.id,req.params.id,Date.now()]);
    } else {
      await pool.query('DELETE FROM user_store_favorites WHERE owner_id=$1 AND store_id=$2',[req.auth.user.id,req.params.id]);
    }
    res.json({id:req.params.id,favorite:req.body.favorite});
  } catch(error) { next(error); }
});

storesRouter.post('/catalog/import',requireAuth,requireAdmin,async(req,res,next)=>{
  if (!Array.isArray(req.body?.stores)||!['merge','replace'].includes(req.body?.mode)) return fail(res,400,'invalid_input','Indica stores y el modo merge o replace.');
  let stores;
  try {
    stores=req.body.stores.map(normalizeStore);
    const ids=new Set();
    for (const store of stores) { if(ids.has(store.id)) throw new Error(`El fichero contiene la tienda duplicada: ${store.id}.`); ids.add(store.id); }
  } catch(error) { return fail(res,400,'invalid_store',error.message); }
  const client=await pool.connect();
  let inserted=0,updated=0;
  try {
    await client.query('BEGIN');
    if (req.body.mode==='replace') {
      await client.query('DELETE FROM stores WHERE NOT (id = ANY($1::text[]))',[stores.map(store=>store.id)]);
    }
    for (const store of stores) {
      const {rows}=await client.query(
        `INSERT INTO stores(id,name,address,city,provincia,zipcode,latitude,longitude,location_source,created_at_ms,updated_at_ms)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,city=EXCLUDED.city,provincia=EXCLUDED.provincia,
           zipcode=EXCLUDED.zipcode,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,location_source=EXCLUDED.location_source,updated_at_ms=EXCLUDED.updated_at_ms
         RETURNING (xmax=0) AS inserted`,
        [store.id,store.name,store.address,store.city,store.provincia,store.zipcode,store.latitude,store.longitude,store.locationSource,Date.now()]);
      if(rows[0].inserted) inserted++; else updated++;
    }
    await client.query('COMMIT');
    res.json({ok:true,mode:req.body.mode,inserted,updated,skipped:0,total:stores.length});
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); next(error); }
  finally { client.release(); }
});

storesRouter.delete('/:id',requireAuth,requireAdmin,async(req,res,next)=>{
  try {
    const result=await pool.query('DELETE FROM stores WHERE id=$1',[req.params.id]);
    res.json({deleted:result.rowCount>0,id:req.params.id});
  } catch(error) { next(error); }
});

storesRouter.post('/requests',requireAuth,requireFeature('stores'),async(req,res,next)=>{
  const name=text(req.body?.name), address=text(req.body?.address), city=text(req.body?.city,'gijon')||'gijon';
  const provincia=text(req.body?.provincia,'Asturias')||'Asturias';
  const hasLat=req.body?.latitude!==undefined,hasLng=req.body?.longitude!==undefined;
  if (!name||name.length>180||!address||address.length>300) return fail(res,400,'invalid_input','Indica un nombre y una dirección válidos.');
  if (hasLat!==hasLng || (hasLat&&(!validLat(req.body.latitude)||!validLng(req.body.longitude)))) return fail(res,400,'invalid_location','Indica ambas coordenadas válidas o deja las dos vacías.');
  try {
    const now=Date.now(),id=randomUUID();
    const {rows}=await pool.query(
      `INSERT INTO store_requests(id,submitted_by,name,address,city,provincia,zipcode,latitude,longitude,location_source,status,created_at_ms,updated_at_ms)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$11) RETURNING *`,
      [id,req.auth.user.id,name,address,city,provincia,req.body.zipcode==null?null:String(req.body.zipcode),hasLat?req.body.latitude:null,hasLng?req.body.longitude:null,hasLat?'user_request':null,now]);
    res.status(201).json({request:rows[0]});
  } catch(error) { next(error); }
});

storesRouter.get('/requests/pending',requireAuth,requireAdmin,async(_req,res,next)=>{
  try { const {rows}=await pool.query("SELECT * FROM store_requests WHERE status='pending' ORDER BY created_at_ms DESC"); res.json({requests:rows}); }
  catch(error) { next(error); }
});

storesRouter.post('/requests/:requestId/approve',requireAuth,requireAdmin,async(req,res,next)=>{
  if (!validLat(req.body?.latitude)||!validLng(req.body?.longitude)) return fail(res,400,'invalid_location','Las coordenadas de aprobación no son válidas.');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows}=await client.query("SELECT * FROM store_requests WHERE id=$1 FOR UPDATE",[req.params.requestId]);
    const request=rows[0];
    if(!request||request.status!=='pending') { await client.query('ROLLBACK'); return fail(res,409,'not_pending','La solicitud ya no está pendiente.'); }
    const now=Date.now(),storeId=`store-${now.toString(36)}-${randomUUID().slice(0,8)}`;
    await client.query(
      `INSERT INTO stores(id,name,address,city,provincia,zipcode,latitude,longitude,location_source,created_at_ms,updated_at_ms)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'admin_validation',$9,$9)`,
      [storeId,request.name,request.address,request.city,request.provincia,request.zipcode||'0',req.body.latitude,req.body.longitude,now]);
    await client.query("UPDATE store_requests SET status='approved',reviewed_by=$2,reviewed_at_ms=$3,approved_store_id=$4,updated_at_ms=$3 WHERE id=$1",[request.id,req.auth.user.id,now,storeId]);
    await client.query('COMMIT');
    res.json({ok:true,storeId});
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); next(error); }
  finally { client.release(); }
});

storesRouter.post('/requests/:requestId/reject',requireAuth,requireAdmin,async(req,res,next)=>{
  const reason=text(req.body?.reason,'Rechazada por administración.')||'Rechazada por administración.';
  try {
    const now=Date.now();
    const result=await pool.query("UPDATE store_requests SET status='rejected',reviewed_by=$2,reviewed_at_ms=$3,rejection_reason=$4,updated_at_ms=$3 WHERE id=$1 AND status='pending'",[req.params.requestId,req.auth.user.id,now,reason]);
    if(!result.rowCount) return fail(res,409,'not_pending','La solicitud ya no está pendiente.');
    res.json({ok:true});
  } catch(error) { next(error); }
});
