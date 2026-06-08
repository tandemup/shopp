// services/productLookup.js

/* -------------------------------------------------
   Open Food Facts configuration
-------------------------------------------------- */

const OPEN_FOOD_FACTS_API_BASE_URL =
  "https://world.openfoodfacts.org/api/v2/product";

const OPEN_FOOD_FACTS_PRODUCT_BASE_URL =
  "https://world.openfoodfacts.org/product";

const REQUEST_TIMEOUT_MS = 10000;

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

/*
 * Los códigos utilizados por supermercados son numéricos.
 * Eliminamos espacios, guiones y otros caracteres accidentales.
 */
function normalizeBarcode(code) {
  return String(code || "")
    .replace(/\D/g, "")
    .trim();
}

/*
 * Permitimos EAN-8, UPC-A y EAN-13.
 */
function isSupportedBarcode(barcode) {
  return barcode.length === 8 || barcode.length === 12 || barcode.length === 13;
}

/*
 * Recupera la mejor imagen disponible.
 * Se prioriza la imagen frontal del producto.
 */
function getBestImage(product) {
  return (
    product?.image_front_url ||
    product?.image_url ||
    product?.selected_images?.front?.display?.es ||
    product?.selected_images?.front?.display?.en ||
    product?.selected_images?.front?.small?.es ||
    product?.selected_images?.front?.small?.en ||
    ""
  );
}

/*
 * Recupera el mejor nombre posible.
 * Se prioriza el nombre en español.
 */
function getBestProductName(product) {
  return (
    product?.product_name_es ||
    product?.product_name ||
    product?.generic_name_es ||
    product?.generic_name ||
    ""
  ).trim();
}

/*
 * Recupera la URL pública del producto.
 */
function getProductUrl(product, barcode) {
  return product?.url || `${OPEN_FOOD_FACTS_PRODUCT_BASE_URL}/${barcode}`;
}

/*
 * Fetch con límite de tiempo.
 *
 * AbortController funciona en navegadores modernos y en entornos
 * compatibles con fetch. Si no estuviera disponible, la petición
 * sigue funcionando sin cancelación automática.
 */
async function fetchWithTimeout(url, options = {}) {
  if (typeof AbortController === "undefined") {
    return fetch(url, options);
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/* -------------------------------------------------
   Lookup product by barcode
-------------------------------------------------- */

export async function lookupProductByBarcode(barcode) {
  const cleanBarcode = normalizeBarcode(barcode);

  if (!cleanBarcode || !isSupportedBarcode(cleanBarcode)) {
    return {
      found: false,
      product: null,
      reason: "invalid_barcode",
    };
  }

  try {
    /*
     * Solicitamos únicamente los campos necesarios.
     * Esto reduce el tamaño de la respuesta.
     */
    const fields = [
      "code",
      "product_name",
      "product_name_es",
      "generic_name",
      "generic_name_es",
      "brands",
      "image_url",
      "image_front_url",
      "selected_images",
      "url",
    ].join(",");

    const url =
      `${OPEN_FOOD_FACTS_API_BASE_URL}/${cleanBarcode}.json` +
      `?fields=${encodeURIComponent(fields)}`;

    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        found: false,
        product: null,
        reason: "http_error",
        status: response.status,
      };
    }

    const data = await response.json();

    if (data?.status !== 1 || !data?.product) {
      return {
        found: false,
        product: null,
        reason: "not_found",
      };
    }

    const product = data.product;

    return {
      found: true,

      product: {
        barcode: cleanBarcode,

        name: getBestProductName(product),
        brand: String(product?.brands || "").trim(),

        imageUrl: getBestImage(product),

        url: getProductUrl(product, cleanBarcode),

        lookupSource: "openfoodfacts",
      },
    };
  } catch (error) {
    const isAbortError = error?.name === "AbortError";

    console.log(
      isAbortError
        ? "Open Food Facts request timed out"
        : "Error looking up product by barcode:",
      error,
    );

    return {
      found: false,
      product: null,
      reason: isAbortError ? "timeout" : "network_error",
    };
  }
}
