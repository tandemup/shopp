export const PRODUCT_SEARCH_TYPES = [
  { value: "Alimentos", label: "Alimentos", icon: "fast-food-outline" },
  { value: "Supermercado", label: "Supermercado", icon: "basket-outline" },
  { value: "Libros", label: "Libros", icon: "book-outline" },
  { value: "Música", label: "Música", icon: "disc-outline" },
];

export const DEFAULT_PRODUCT_SEARCH_TYPE = "Alimentos";

export function normalizeProductSearchType(
  value,
  fallback = DEFAULT_PRODUCT_SEARCH_TYPE,
) {
  const normalized = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized === "alimentos" || normalized === "alimento" || normalized === "food") {
    return "Alimentos";
  }
  if (normalized === "supermercado" || normalized === "supermarket") {
    return "Supermercado";
  }
  if (normalized === "libros" || normalized === "libro" || normalized === "book") {
    return "Libros";
  }
  if (
    normalized === "musica" ||
    normalized === "music" ||
    normalized === "cd" ||
    normalized === "cd/dvd"
  ) {
    return "Música";
  }

  return fallback;
}

export function getProductSearchType(value) {
  const normalized = normalizeProductSearchType(value);
  return (
    PRODUCT_SEARCH_TYPES.find((option) => option.value === normalized) ||
    PRODUCT_SEARCH_TYPES[0]
  );
}
