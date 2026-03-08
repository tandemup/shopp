export function getProductImage(barcode) {
  if (!barcode) return null;

  return `https://images.openfoodfacts.org/images/products/${barcode}/front_small.jpg`;
}
