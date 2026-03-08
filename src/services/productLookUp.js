export async function fetchProductInfo(barcode) {
  try {
    // 📘 ISBN
    if (barcode.startsWith("978") || barcode.startsWith("979")) {
      const r = await fetch(`https://openlibrary.org/isbn/${barcode}.json`);
      if (r.ok) {
        const b = await r.json();
        return {
          code: barcode,
          name: b.title ?? "Libro desconocido",
          brand: b.publishers?.join(", ") ?? "Editorial desconocida",
          image: b.covers
            ? `https://covers.openlibrary.org/b/id/${b.covers[0]}-M.jpg`
            : null,
          url: `https://openlibrary.org/isbn/${barcode}`,
        };
      }
    }

    // 🍎 OpenFoodFacts
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    );
    const data = await r.json();
    if (data.status === 1) {
      const p = data.product;
      return {
        code: barcode,
        name: p.product_name ?? "Producto desconocido",
        brand: p.brands ?? "Sin marca",
        image: p.image_small_url ?? null,
        url: p.url,
      };
    }

    return null;
  } catch (e) {
    console.error("fetchProductInfo error", e);
    return null;
  }
}
