// 🛒 Obtener datos de productos de supermercado
export async function fetchProductInfo(code) {
  try {
    // API pública de OpenFoodFacts
    const url = `https://world.openfoodfacts.org/api/v0/product/${code}.json`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.status !== 1) return null;

    const p = data.product;

    return {
      name: p.product_name ?? "Producto desconocido",
      brand: p.brands ?? "",
      image: p.image_front_small_url ?? null,
      url: p.url ?? null,
    };
  } catch (e) {
    console.log("Error fetchProductInfo:", e);
    return null;
  }
}
