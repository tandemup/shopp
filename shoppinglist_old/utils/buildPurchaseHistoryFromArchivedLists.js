import { normalizeProductName } from "./normalize";

/**
 * Construye el índice purchaseHistory a partir de las listas archivadas.
 * @param {Array} archivedLists
 * @returns {Array} purchaseHistory
 */
export function buildPurchaseHistoryFromArchivedLists(archivedLists = []) {
  const map = new Map();

  for (const list of archivedLists) {
    const storeId = list.storeId ?? null;
    const purchasedAt = list.archivedAt ?? list.date ?? Date.now();

    for (const item of list.items || []) {
      if (!item?.name) continue;

      const normalizedName = normalizeProductName(item.name);
      const barcode = item.barcode ?? null;

      // clave estable:
      // - si hay barcode → manda el barcode
      // - si no → nombre normalizado
      const key = barcode || normalizedName;

      const prev = map.get(key);

      if (!prev) {
        map.set(key, {
          id: key,
          name: item.name,
          normalizedName,
          barcode,

          storeId,

          frequency: 1,
          lastPurchasedAt: purchasedAt,

          priceInfo: item.priceInfo ?? null,
        });
      } else {
        const isMoreRecent = purchasedAt >= prev.lastPurchasedAt;

        map.set(key, {
          ...prev,

          // conservar el nombre más reciente
          name: item.name,

          // aprender barcode si antes no había
          barcode: prev.barcode ?? barcode,

          // última tienda
          storeId,

          frequency: prev.frequency + 1,

          lastPurchasedAt: Math.max(prev.lastPurchasedAt, purchasedAt),

          // 👇 solo actualizar priceInfo si esta compra es más reciente
          priceInfo: isMoreRecent
            ? (item.priceInfo ?? prev.priceInfo)
            : prev.priceInfo,
        });
      }
    }
  }

  return Array.from(map.values());
}
