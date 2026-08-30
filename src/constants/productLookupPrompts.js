function normalizePromptBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePromptText(value, fallback = "No especificada") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

/**
 * Crea un prompt único para investigar códigos EAN, UPC, GTIN o ISBN.
 * La aplicación debe proporcionar al modelo una herramienta de búsqueda web.
 */
export function buildUnifiedProductLookupPrompt({
  barcode,
  productType = "Desconocido",
  userHint = "",
  market = "España",
} = {}) {
  const normalizedBarcode = normalizePromptBarcode(barcode);
  const normalizedType = normalizePromptText(productType, "Desconocido");
  const normalizedHint = normalizePromptText(userHint);
  const normalizedMarket = normalizePromptText(market, "España");

  return `Eres un investigador especializado en identificar productos mediante códigos de barras EAN, UPC, GTIN o ISBN.

Debes buscar en Internet información verificable sobre el producto indicado.

DATOS PROPORCIONADOS POR EL USUARIO
- Código de barras: ${normalizedBarcode}
- Tipo de producto indicado: ${normalizedType}
- Información adicional: ${normalizedHint}
- Mercado preferente: ${normalizedMarket}

TIPOS DE PRODUCTO ADMITIDOS
- "Alimentos"
- "Supermercado"
- "Libros"
- "CD / DVD"
- "Desconocido"

INSTRUCCIONES
1. Comprueba que el código normalizado tenga entre 8 y 14 dígitos.
2. Usa el tipo y la información adicional del usuario para orientar la búsqueda, pero no asumas que sean correctos.
3. Busca primero el código exacto entre comillas y contrasta al menos dos fuentes cuando sea posible.
4. Da prioridad a fuentes primarias y especializadas:
   - Alimentos: fabricante, GS1, Open Food Facts y supermercados.
   - Supermercado: fabricante, GS1 y distribuidores o supermercados.
   - Libros: editorial, ISBN, bibliotecas nacionales, Google Books, Open Library y WorldCat.
   - CD/DVD: sello, estudio, distribuidor, MusicBrainz, Discogs, Blu-ray.com, TMDB o catálogo oficial.
5. Identifica la edición exacta. No mezcles formatos, países, reediciones, idiomas, tamaños o variantes.
6. No deduzcas el país de fabricación únicamente a partir del prefijo GS1.
7. No inventes información. Usa null o [] para datos no confirmados.
8. Incluye únicamente URL consultadas realmente. Si las fuentes se contradicen, indícalo.
9. No devuelvas precios salvo que el usuario los solicite expresamente.
10. No uses resultados pertenecientes a códigos parecidos.

DATOS ESPECÍFICOS
- Alimentos: nombre, marca, fabricante, variedad, cantidad, formato, categoría, ingredientes, alérgenos, nutrición, Nutri-Score, NOVA, origen y conservación.
- Supermercado: nombre, marca, fabricante, modelo o variante, cantidad, formato, categoría, subcategoría, materiales, modo de empleo, advertencias, origen y conservación. No solicites datos nutricionales propios de alimentos.
- Libros: ISBN-10/13, título, autores, editorial, publicación, idioma, páginas, encuadernación, edición, categoría y sinopsis.
- CD/DVD: determina si es CD musical, DVD musical, DVD de vídeo, Blu-ray u otro soporte; busca título, artista/compositor/director/reparto, sello/estudio, edición, país, discos, género, catálogo, pistas o contenidos, región, idiomas, subtítulos y duración.

DEVUELVE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA
{
  "barcode": "${normalizedBarcode}",
  "status": "found | partial | not_found | invalid_barcode",
  "productType": "Alimentos | Supermercado | Libros | CD / DVD | Desconocido",
  "mediaType": null,
  "name": null,
  "brand": null,
  "category": null,
  "subcategory": null,
  "description": null,
  "manufacturer": null,
  "productUrl": null,
  "details": {
    "quantity": null,
    "format": null,
    "ingredients": null,
    "allergens": [],
    "nutritionPer100": null,
    "isbn10": null,
    "isbn13": null,
    "authors": [],
    "publisher": null,
    "publicationDate": null,
    "language": null,
    "pageCount": null,
    "artist": null,
    "composer": null,
    "director": null,
    "labelOrStudio": null,
    "releaseDate": null,
    "country": null,
    "catalogNumber": null,
    "numberOfDiscs": null,
    "tracksOrContents": [],
    "region": null,
    "duration": null
  },
  "sources": [],
  "confidence": "high | medium | low",
  "verificationStatus": "verified | partially_verified | unverified",
  "verificationNotes": null
}`;
}

export function buildFoodLookupPrompt(barcode) {
  const normalizedBarcode = normalizePromptBarcode(barcode);

  return `Identifica el alimento o la bebida correspondiente al código de barras EAN/GTIN ${normalizedBarcode}, destinado al mercado español.

Usa fuentes fiables y específicas de alimentación, como Open Food Facts, la web oficial del fabricante, GS1 y fichas de supermercados españoles. Comprueba que el código corresponde exactamente a la marca, variedad, sabor, cantidad y formato encontrados; no mezcles variantes.

Busca una fotografía frontal directa y pública que corresponda exactamente a este código de barras. Prioriza la web oficial del fabricante y Open Food Facts. Si no puedes verificar la imagen exacta, devuelve null.

Devuelve exclusivamente un único bloque de código JSON, sin texto antes ni después, con esta estructura:
{
  "barcode": "${normalizedBarcode}",
  "productType": "Alimentos",
  "name": null,
  "brand": null,
  "description": null,
  "category": null,
  "subcategory": null,
  "quantity": null,
  "ingredients": null,
  "allergens": [],
  "nutritionPer100": {
    "energyKcal": null,
    "fatG": null,
    "saturatedFatG": null,
    "carbohydratesG": null,
    "sugarsG": null,
    "fiberG": null,
    "proteinsG": null,
    "saltG": null
  },
  "nutriScore": null,
  "novaGroup": null,
  "countryOfOrigin": null,
  "manufacturer": null,
  "labels": [],
  "packaging": null,
  "storageInstructions": null,
  "imageUrl": null,
  "productPageUrl": null,
  "openFoodFactsUrl": null,
  "sourceUrls": [],
  "verificationStatus": "unverified",
  "verificationNotes": null
}

Reglas:
- nutritionPer100 debe corresponder a 100 g o 100 ml, no a una ración.
- nutriScore solo puede ser A, B, C, D, E o null.
- novaGroup solo puede ser 1, 2, 3, 4 o null.
- imageUrl solo puede contener una URL HTTPS directa, pública y estable de la imagen frontal exacta.
- openFoodFactsUrl y sourceUrls solo deben contener URL realmente consultadas.
- No uses resultados de búsqueda, URL temporales, imágenes data: ni Markdown.
- No inventes datos; usa null o [] cuando no puedas verificarlos.`;
}

export function buildSupermarketLookupPrompt(barcode) {
  const normalizedBarcode = normalizePromptBarcode(barcode);

  return `Identifica el producto no alimentario de gran consumo vendido en supermercados con código EAN/GTIN ${normalizedBarcode}, destinado al mercado español.

Trata este código como un producto de supermercado no alimentario, por ejemplo un artículo de limpieza, higiene personal, cuidado del hogar, papelería, mascotas o similar. No lo clasifiques como alimento ni solicites datos nutricionales, ingredientes alimentarios, Nutri-Score o NOVA.

Usa fuentes fiables como la web oficial del fabricante, GS1 y fichas de distribuidores o supermercados españoles. Identifica exactamente la marca, modelo o variante, cantidad y formato; no mezcles tamaños, aromas, colores, presentaciones ni variantes.

Busca una fotografía frontal directa y pública que corresponda exactamente a este código de barras. Prioriza la web oficial del fabricante y las fichas de distribuidores. Si no puedes verificar la imagen exacta, devuelve null.

Devuelve exclusivamente un único bloque de código JSON, sin texto antes ni después, con esta estructura:
{
  "barcode": "${normalizedBarcode}",
  "productType": "Supermercado",
  "name": null,
  "brand": null,
  "description": null,
  "category": null,
  "subcategory": null,
  "modelOrVariant": null,
  "quantity": null,
  "format": null,
  "manufacturer": null,
  "countryOfOrigin": null,
  "materials": null,
  "usageInstructions": null,
  "warnings": [],
  "labels": [],
  "packaging": null,
  "storageInstructions": null,
  "imageUrl": null,
  "productPageUrl": null,
  "sourceUrls": [],
  "verificationStatus": "unverified",
  "verificationNotes": null
}

Reglas:
- No incluyas información nutricional ni clasifiques el producto como alimento.
- imageUrl solo puede contener una URL HTTPS directa, pública y estable de la imagen frontal exacta.
- sourceUrls solo debe contener URL realmente consultadas.
- No uses resultados de búsqueda, URL temporales, imágenes data: ni Markdown.
- No inventes datos; usa null o [] cuando no puedas verificarlos.`;
}

export function buildMusicCdLookupPrompt(barcode) {
  const normalizedBarcode = normalizePromptBarcode(barcode);

  return `Identifica la edición musical en CD con código de barras ${normalizedBarcode}.

Usa fuentes fiables como MusicBrainz, Discogs o el catálogo oficial del sello. Identifica la edición exacta sin mezclar países, reediciones ni formatos.

No busques imágenes ni carátulas.

Devuelve los datos en formato JSON con estas propiedades:
{
  "barcode": "${normalizedBarcode}",
  "productType": "Música",
  "title": null,
  "primaryArtist": null,
  "composer": null,
  "physicalFormat": "CD",
  "numberOfDiscs": null,
  "genre": null,
  "subgenre": null,
  "label": null,
  "releaseYear": null,
  "verificationStatus": "unverified",
  "verificationNotes": null
}

No inventes datos. Mantén los nombres de las propiedades.`;
}

export function buildBookLookupPrompt(barcode) {
  const normalizedBarcode = normalizePromptBarcode(barcode);

  return `Identifica el libro correspondiente exactamente al ISBN-13 ${normalizedBarcode}.

Comprueba el ISBN y consulta fuentes bibliográficas fiables como Open Library, la editorial, bibliotecas nacionales, WorldCat o Google Books. No mezcles otras ediciones, editoriales, idiomas, encuadernaciones o reimpresiones.

No busques imágenes ni cubiertas.

Devuelve los datos en formato JSON con estas propiedades:
{
  "barcode": "${normalizedBarcode}",
  "isbn13": "${normalizedBarcode}",
  "productType": "Libros",
  "title": null,
  "authors": [],
  "publisher": null,
  "publicationYear": null,
  "language": null,
  "pageCount": null,
  "category": null,
  "physicalFormat": null,
  "synopsis": null,
  "verificationStatus": "unverified",
  "verificationNotes": null
}

No inventes datos. Mantén los nombres de las propiedades.`;
}
