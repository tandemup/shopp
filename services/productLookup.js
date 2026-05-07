// services/productLookup.js

const OPEN_FOOD_FACTS_BASE_URL =
  "https://world.openfoodfacts.org/api/v2/product";

function normalizeBarcode(code) {
  return String(code || "")
    .replace(/\D/g, "")
    .trim();
}

function getBestImage(product) {
  return (
    product?.image_front_url ||
    product?.image_url ||
    product?.selected_images?.front?.display?.es ||
    product?.selected_images?.front?.display?.en ||
    product?.selected_images?.front?.small?.es ||
    product?.selected_images?.front?.small?.en ||
    null
  );
}

export async function lookupProductByBarcode(barcode) {
  const cleanBarcode = normalizeBarcode(barcode);

  if (!cleanBarcode) {
    return {
      found: false,
      product: null,
    };
  }

  try {
    const fields = [
      "code",
      "product_name",
      "product_name_es",
      "generic_name",
      "brands",
      "image_url",
      "image_front_url",
      "selected_images",
      "url",
    ].join(",");

    const url = `${OPEN_FOOD_FACTS_BASE_URL}/${cleanBarcode}.json?fields=${fields}`;

    const response = await fetch(url);

    if (!response.ok) {
      return {
        found: false,
        product: null,
      };
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return {
        found: false,
        product: null,
      };
    }

    const product = data.product;

    const name =
      product.product_name_es ||
      product.product_name ||
      product.generic_name ||
      "";

    const imageUrl = getBestImage(product);

    return {
      found: true,
      product: {
        barcode: cleanBarcode,
        name,
        brand: product.brands || "",
        imageUrl,
        url:
          product.url ||
          `https://world.openfoodfacts.org/product/${cleanBarcode}`,
        lookupSource: "openfoodfacts",
      },
    };
  } catch (error) {
    console.log("Error looking up product by barcode:", error);

    return {
      found: false,
      product: null,
    };
  }
}
