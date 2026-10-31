"use strict";
// Solo lectura pública de datos musicales publicados; sin claves de administración.
const ID = /^card-[a-z0-9-]{12,70}$/;
const VIDEO = /^[A-Za-z0-9_-]{11}$/;
const response = (statusCode, data) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  body: JSON.stringify(data),
});
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return response(405,{error:"Método no permitido"});
  const id=event.queryStringParameters?.id;
  if (typeof id!=="string" || !ID.test(id)) return response(400,{error:"ID de tarjeta inválido"});
  const url=String(process.env.EXPO_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "").trim();
  let endpoint;
  try {
    const parsed=new URL(url);
    if (parsed.protocol!=="https:" || !parsed.hostname.endsWith(".convex.cloud") || parsed.username || parsed.password)
      throw new Error("URL inválida");
    endpoint=`${parsed.origin}/api/query`;
  } catch (_) { return response(503,{error:"Convex no está configurado en Netlify"}); }
  try {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    let upstream;
    try {
      upstream=await fetch(endpoint,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({path:"publicMusicCards:getPublic",args:{id}}),
        signal:controller.signal,
      });
    } finally { clearTimeout(timeout); }
    if (!upstream.ok) return response(502,{error:"Error al consultar Convex"});
    const result=await upstream.json();
    if (result.status!=="success") return response(502,{error:"Convex rechazó la consulta"});
    const card=result.value;
    if (!card) return response(404,{error:"Tarjeta no encontrada"});
    if (!card || card.id!==id || !VIDEO.test(card.videoId || "")) return response(502,{error:"Ficha inválida"});
    const tracks=Array.isArray(card.tracks) ? card.tracks : [];
    if (tracks.length && (tracks.length>30 || tracks.some(t=>!VIDEO.test(t?.videoId||""))))
      return response(502,{error:"Colección inválida"});
    return response(200, {
      id:card.id, title:String(card.title||"").slice(0,120), author:String(card.author||"").slice(0,100),
      videoId:card.videoId,
      tracks:tracks.map(t=>({title:String(t.title||"").slice(0,120),author:String(t.author||"").slice(0,100),videoId:t.videoId,
        ...(typeof t.lyrics==="string"?{lyrics:t.lyrics}:{})})),
    });
  } catch (_) { return response(502,{error:"No se pudo consultar Convex"}); }
};
