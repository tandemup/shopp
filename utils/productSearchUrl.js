// src/utils/productSearchUrl.js

export function buildProductSearchUrl(engineId, barcode) {
  const safeBarcode = String(barcode || "").trim();

  if (!safeBarcode) {
    return null;
  }

  const encodedBarcode = encodeURIComponent(safeBarcode);

  switch (engineId) {
    case "google":
      return `https://www.google.com/search?q=${encodedBarcode}`;

    case "google_shopping":
      return `https://www.google.com/search?tbm=shop&q=${encodedBarcode}`;

    case "bing":
      return `https://www.bing.com/search?q=${encodedBarcode}`;

    case "duckduckgo":
      return `https://duckduckgo.com/?q=${encodedBarcode}`;

    case "open_food_facts":
      return `https://world.openfoodfacts.org/product/${encodedBarcode}`;

    case "barcode_lookup":
      return `https://www.barcodelookup.com/${encodedBarcode}`;

    default:
      return `https://world.openfoodfacts.org/product/${encodedBarcode}`;
  }
}

export function getProductSearchEngineLabel(engineId) {
  switch (engineId) {
    case "google":
      return "Google";

    case "google_shopping":
      return "Google Shopping";

    case "bing":
      return "Bing";

    case "duckduckgo":
      return "DuckDuckGo";

    case "open_food_facts":
      return "OpenFoodFacts";

    case "barcode_lookup":
      return "BarcodeLookup";

    default:
      return "OpenFoodFacts";
  }
}
