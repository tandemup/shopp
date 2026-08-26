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
- "Supermercado"
- "Libros"
- "CD / DVD"
- "Desconocido"

INSTRUCCIONES
1. Comprueba que el código normalizado tenga entre 8 y 14 dígitos.
2. Usa el tipo y la información adicional del usuario para orientar la búsqueda, pero no asumas que sean correctos.
3. Busca primero el código exacto entre comillas y contrasta al menos dos fuentes cuando sea posible.
4. Da prioridad a fuentes primarias y especializadas:
   - Supermercado: fabricante, GS1, Open Food Facts y supermercados.
   - Libros: editorial, ISBN, bibliotecas nacionales, Google Books, Open Library y WorldCat.
   - CD/DVD: sello, estudio, distribuidor, MusicBrainz, Discogs, Blu-ray.com, TMDB o catálogo oficial.
5. Identifica la edición exacta. No mezcles formatos, países, reediciones, idiomas, tamaños o variantes.
6. No deduzcas el país de fabricación únicamente a partir del prefijo GS1.
7. No inventes información. Usa null o [] para datos no confirmados.
8. Incluye únicamente URL consultadas realmente. Si las fuentes se contradicen, indícalo.
9. No devuelvas precios salvo que el usuario los solicite expresamente.
10. No uses resultados pertenecientes a códigos parecidos.

DATOS ESPECÍFICOS
- Supermercado: nombre, marca, fabricante, variedad, cantidad, formato, categorías, ingredientes, alérgenos, nutrición, Nutri-Score, NOVA, origen y conservación.
- Libros: ISBN-10/13, título, autores, editorial, publicación, idioma, páginas, encuadernación, edición, categoría y sinopsis.
- CD/DVD: determina si es CD musical, DVD musical, DVD de vídeo, Blu-ray u otro soporte; busca título, artista/compositor/director/reparto, sello/estudio, edición, país, discos, género, catálogo, pistas o contenidos, región, idiomas, subtítulos y duración.

DEVUELVE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA
{
  "barcode": "${normalizedBarcode}",
  "status": "found | partial | not_found | invalid_barcode",
  "productType": "Supermercado | Libros | CD / DVD | Desconocido",
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

export function buildSupermarketLookupPrompt(barcode) {
  const normalizedBarcode = normalizePromptBarcode(barcode);

  return `Identifica el producto de supermercado con código EAN/GTIN ${normalizedBarcode}, destinado al mercado español.

Usa fuentes fiables como Open Food Facts, el fabricante, GS1 o supermercados españoles. Identifica exactamente la marca, variedad y formato; no mezcles variantes.

No busques imágenes.

Devuelve los datos en formato JSON con estas propiedades:
{
  "barcode": "${normalizedBarcode}",
  "productType": "Supermercado",
  "name": null,
  "brand": null,
  "description": null,
  "category": null,
  "subcategory": null,
  "manufacturer": null,
  "countryOfOrigin": null,
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
  "labels": [],
  "packaging": null,
  "storageInstructions": null,
  "verificationStatus": "unverified",
  "verificationNotes": null
}

No inventes datos. Mantén los nombres de las propiedades.`;
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
