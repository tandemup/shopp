// Public, read-only proxy. Never exposes Convex credentials or private records.
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");
const getPublic = makeFunctionReference("publicMusicCards:getPublic");
const ID_RE = /^card-[a-z0-9-]{12,70}$/;
exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: JSON.stringify({ error: "Método no permitido" }) };
  const id = String(event.queryStringParameters?.id || "");
  if (!ID_RE.test(id)) return { statusCode: 400, headers, body: JSON.stringify({ error: "ID inválido" }) };
  const url = process.env.EXPO_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url || !/^https:\/\/[a-z0-9-]+\.convex\.cloud$/.test(url))
    return { statusCode: 503, headers, body: JSON.stringify({ error: "Convex no está configurado en Netlify" }) };
  try {
    const client = new ConvexHttpClient(url);
    const card = await client.query(getPublic, { id });
    if (!card) return { statusCode: 404, headers, body: JSON.stringify({ error: "Tarjeta no encontrada" }) };
    return { statusCode: 200, headers, body: JSON.stringify(card) };
  } catch (e) {
    console.error("publicMusicCard:", e?.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "No se pudo consultar Convex" }) };
  }
};
