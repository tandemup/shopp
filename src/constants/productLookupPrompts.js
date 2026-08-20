function normalizePromptBarcode(value) {
  return String(value || "").replace(/\D/g, "");
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
