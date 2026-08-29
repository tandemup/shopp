export const PRODUCT_SEARCH_TYPE = Object.freeze({
  FOOD: "Alimentos",
  SUPERMARKET: "Supermercado",
  BOOKS: "Libros",
  MUSIC: "Música",
  ALL: "Todos",
});

export const PRODUCT_SEARCH_TYPES = [
  {
    value: PRODUCT_SEARCH_TYPE.FOOD,
    label: "Alimentos",
    icon: "fast-food-outline",
  },
  {
    value: PRODUCT_SEARCH_TYPE.SUPERMARKET,
    label: "Supermercado",
    icon: "basket-outline",
  },
  {
    value: PRODUCT_SEARCH_TYPE.BOOKS,
    label: "Libros",
    icon: "book-outline",
  },
  {
    value: PRODUCT_SEARCH_TYPE.MUSIC,
    label: "Música",
    icon: "disc-outline",
  },
];

export const DEFAULT_PRODUCT_SEARCH_TYPE = PRODUCT_SEARCH_TYPE.FOOD;

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
    return PRODUCT_SEARCH_TYPE.FOOD;
  }
  if (normalized === "supermercado" || normalized === "supermarket") {
    return PRODUCT_SEARCH_TYPE.SUPERMARKET;
  }
  if (normalized === "libros" || normalized === "libro" || normalized === "book") {
    return PRODUCT_SEARCH_TYPE.BOOKS;
  }
  if (
    normalized === "musica" ||
    normalized === "music" ||
    normalized === "cd" ||
    normalized === "cd/dvd"
  ) {
    return PRODUCT_SEARCH_TYPE.MUSIC;
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
