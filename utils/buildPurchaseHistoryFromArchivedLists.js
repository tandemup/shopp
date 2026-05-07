import { normalizeProductName } from "./normalize";

/**
 * Construye el índice purchaseHistory a partir de las listas archivadas.
 *
 * Cada producto queda agrupado por:
 * - barcode, si existe
 * - nombre normalizado, si no existe barcode
 *
 * Además conserva purchases[], que usa PurchaseDetailScreen.
 *
 * @param {Array} archivedLists
 * @returns {Array} purchaseHistory
 */
export function buildPurchaseHistoryFromArchivedLists(archivedLists = []) {
  const map = new Map();

  for (const list of archivedLists) {
    const listId = list.id ?? null;
    const listName = list.name ?? "";
    const storeId = list.storeId ?? null;
    const purchasedAt =
      list.archivedAt ?? list.date ?? list.createdAt ?? Date.now();

    for (const item of list.items || []) {
      if (!item?.name) continue;

      const normalizedName = normalizeProductName(item.name);
      const barcode = item.barcode ?? null;

      // Clave estable:
      // - si hay barcode → manda el barcode
      // - si no → nombre normalizado
      const key = barcode || normalizedName;

      const purchase = {
        id: `${listId ?? "list"}-${item.id ?? key}-${purchasedAt}`,
        listId,
        listName,
        storeId,
        purchasedAt,

        itemId: item.id ?? null,
        name: item.name,
        normalizedName,
        barcode,

        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? item.priceInfo?.unitPrice ?? 0,
        unit: item.unit ?? "u",
        promo: item.promo ?? null,
        priceInfo: item.priceInfo ?? null,
      };

      const prev = map.get(key);

      if (!prev) {
        map.set(key, {
          id: key,
          name: item.name,
          normalizedName,
          barcode,

          // Última tienda conocida
          storeId,

          frequency: 1,
          lastPurchasedAt: purchasedAt,

          // Último precio conocido
          priceInfo: item.priceInfo ?? null,

          // Detalle histórico usado por PurchaseDetailScreen
          purchases: [purchase],
        });

        continue;
      }

      const isMoreRecent = purchasedAt >= prev.lastPurchasedAt;

      map.set(key, {
        ...prev,

        // Conserva el nombre más reciente
        name: isMoreRecent ? item.name : prev.name,

        // Aprende barcode si antes no había
        barcode: prev.barcode ?? barcode,

        // Última tienda conocida
        storeId: isMoreRecent ? storeId : prev.storeId,

        frequency: prev.frequency + 1,

        lastPurchasedAt: Math.max(prev.lastPurchasedAt, purchasedAt),

        // Solo actualizar priceInfo si esta compra es más reciente
        priceInfo: isMoreRecent
          ? (item.priceInfo ?? prev.priceInfo)
          : prev.priceInfo,

        // Añadir compra individual
        purchases: [...(prev.purchases ?? []), purchase],
      });
    }
  }

  return Array.from(map.values()).map((product) => ({
    ...product,
    purchases: [...(product.purchases ?? [])].sort(
      (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt),
    ),
  }));
}
