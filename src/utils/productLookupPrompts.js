function normalizePromptBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

export function buildUnifiedProductLookupPrompt(barcode, productType = "Automático", userHint = "", market = "España") {
  const normalizedBarcode = normalizePromptBarcode(barcode);
  const hint = String(userHint || "").trim() || "sin información adicional";
  const requestedType = String(productType || "Automático").trim();

  return `Investiga en Internet el artículo identificado exactamente por el código ${normalizedBarcode}.
Tipo indicado por el usuario: ${requestedType}.
Información adicional del usuario: ${hint}.
Mercado preferente: ${market}.

Clasifica primero el artículo como Supermercado, Libros, CD/DVD o Desconocido. Si el tipo indicado es incorrecto, corrígelo. Un código que empiece por 978 o 979 suele ser ISBN: compruébalo como libro antes de consultar fuentes de alimentación. No uses Open Food Facts para un ISBN.

Busca el código exacto entre comillas y contrasta, cuando sea posible, al menos dos fuentes fiables. Prioriza fabricante/GS1/Open Food Facts para supermercado; editorial, ISBN, bibliotecas, Google Books u Open Library para libros; sello, MusicBrainz, Discogs, catálogos oficiales y bases audiovisuales para CD/DVD. No mezcles ediciones, idiomas, países, tamaños, sabores, envases ni reediciones. No inventes datos. Devuelve null o [] si no están confirmados y solo incluye URL realmente consultadas.

Devuelve exclusivamente un objeto JSON con esta estructura:
{
  "barcode": "${normalizedBarcode}",
  "status": "found | partial | not_found | invalid_barcode",
  "productType": "Supermercado | Libros | CD/DVD | Desconocido",
  "mediaType": null,
  "name": null,
  "brand": null,
  "title": null,
  "description": null,
  "authors": [],
  "artist": null,
  "composer": null,
  "publisher": null,
  "manufacturer": null,
  "category": null,
  "subcategory": null,
  "details": {},
  "imageUrl": null,
  "productUrl": null,
  "sources": [],
  "confidence": "high | medium | low",
  "verificationStatus": "verified | partially_verified | unverified",
  "verificationNotes": null
}

La imagen debe ser una URL HTTPS directa, pública y estable, correspondiente exactamente a esta edición o variante; si no puede verificarse, usa null.`;
}

export function buildSupermarketLookupPrompt(barcode) {
  const normalizedBarcode = normalizePromptBarcode(barcode);

  return `Busca información fiable sobre el producto de supermercado con código de barras EAN/GTIN ${normalizedBarcode}, destinado al mercado español.

Identifica exactamente el producto, la marca, la variedad y el formato asociados a este código. No mezcles tamaños, sabores, envases ni variantes diferentes aunque pertenezcan a la misma gama.

Consulta y contrasta, cuando estén disponibles, estas fuentes:
- Open Food Facts: https://world.openfoodfacts.org/product/${normalizedBarcode}
- La web oficial de la marca o del fabricante.
- GS1 y otras bases de datos fiables de códigos EAN/GTIN.
- Fichas del producto en supermercados españoles como Carrefour, Alcampo, Eroski, Dia, Consum, El Corte Inglés, Hipercor o Mercadona.

Busca también una fotografía frontal exacta del producto. Prioriza la web oficial del fabricante y Open Food Facts. No uses una imagen de otro tamaño, sabor, envase o variante.

Devuelve exclusivamente un único bloque de código JSON, sin texto antes ni después, con esta estructura:
{
  "barcode": "${normalizedBarcode}",
  "productType": "Supermercado",
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
  "originCountry": null,
  "manufacturer": null,
  "labels": [],
  "packaging": null,
  "storageInstructions": null,
  "imageUrl": null,
  "productPageUrl": null,
  "openFoodFactsUrl": "https://world.openfoodfacts.org/product/${normalizedBarcode}",
  "sourceUrls": [],
  "verificationStatus": "unverified",
  "verificationNotes": null
}

Reglas:
- description debe ser una explicación breve y útil para un cliente, con un máximo de 500 caracteres.
- allergens, labels y sourceUrls son arrays de strings.
- Los valores de nutritionPer100 son números o null y deben corresponder a 100 g o 100 ml, no a una ración.
- nutriScore solo puede ser A, B, C, D, E o null.
- novaGroup solo puede ser 1, 2, 3, 4 o null.
- imageUrl solo puede contener una URL HTTPS directa, pública y estable de la imagen frontal correspondiente exactamente a este código de barras.
- Una ficha de supermercado o página HTML no es una imagen. Si no encuentras una imagen directa verificable, devuelve null.
- productPageUrl debe apuntar a una ficha concreta del producto y sourceUrls debe incluir únicamente las fuentes realmente consultadas.
- No uses resultados de búsqueda, imágenes incrustadas como data: ni URL temporales.
- Las URL deben ser texto plano, sin Markdown, espacios ni saltos de línea.
- No inventes datos; usa null o un array vacío cuando no puedas verificarlos.
- Si las fuentes se contradicen, explícalo brevemente en verificationNotes.
- verificationStatus solo puede ser verified, partially_verified o unverified.
- Debe existir exactamente un objeto JSON y un único botón Copiar.`;
}

export function buildMusicCdLookupPrompt(barcode) {
  const normalizedBarcode = normalizePromptBarcode(barcode);

  return `Busca información fiable sobre la edición musical en CD con código de barras ${normalizedBarcode}.

Identifica la edición exacta sin mezclar países, reediciones ni formatos. Contrasta el código en MusicBrainz, Discogs y, cuando exista, el catálogo oficial del sello.

Busca también la carátula frontal exacta de esa edición. Prioriza Cover Art Archive/MusicBrainz y después Discogs o el catálogo oficial del sello. No uses una carátula de otra edición aunque el título y el artista coincidan.

Devuelve exclusivamente un único bloque de código JSON, sin texto antes ni después, con esta estructura:
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
  "coverImageUrl": null,
  "productPageUrl": null,
  "verificationStatus": "unverified",
  "verificationNotes": null
}

coverImageUrl solo puede contener una URL HTTPS directa y pública de la carátula frontal correspondiente a esta edición. No uses páginas HTML, resultados de búsqueda, imágenes incrustadas como data: ni URL temporales. Si no encuentras una imagen directa verificable, devuelve null. Las URL deben ser texto plano, sin Markdown, espacios ni saltos de línea. No inventes datos. verificationStatus solo puede ser verified, partially_verified o unverified. Debe existir exactamente un objeto JSON y un único botón Copiar.`;
}

export function buildBookLookupPrompt(barcode, userHint = "") {
  const normalizedBarcode = normalizePromptBarcode(barcode);
  const additionalInformation = String(userHint || "").trim();

  return `Busca en Internet información bibliográfica del libro identificado por este ISBN-13:

ISBN-13: ${normalizedBarcode}

Additional information provided by the user: ${additionalInformation || "None"}

El ISBN-13 corresponde a una edición concreta. Usa el ISBN como identificador principal y no confundas el libro con otras ediciones, traducciones, formatos o reimpresiones con ISBN diferente.

Consulta y contrasta fuentes fiables como editoriales, catálogos bibliográficos, Google Books, Open Library, librerías reconocidas u otras bases de datos bibliográficas.

Necesito obtener ISBN-13, título, autor o autores, año de publicación de esta edición, editorial, idioma, número de páginas, categoría, formato físico, imagen de portada, URL de la ficha y resumen o sinopsis.

Para la portada, devuelve una URL pública de la imagen correspondiente exactamente a este ISBN. Si no puedes identificar una portada fiable, devuelve null.

Para el resumen, redacta un resumen breve, objetivo y original, con un máximo de 500 caracteres. No copies literalmente la descripción de una editorial o librería.

Devuelve EXCLUSIVAMENTE JSON válido. No utilices Markdown. No incluyas explicaciones antes ni después del JSON. No inventes información. Cuando un dato no pueda verificarse, utiliza null.

Usa exactamente esta estructura:
{
  "type": "book",
  "isbn13": "${normalizedBarcode}",
  "title": null,
  "authors": [],
  "publicationYear": null,
  "publisher": null,
  "language": null,
  "pageCount": null,
  "category": null,
  "physicalFormat": null,
  "coverImageUrl": null,
  "productPageUrl": null,
  "summary": null
}`;
}
