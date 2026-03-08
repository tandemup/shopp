import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Busca productos en TODAS las listas archivadas / históricas
 * (excluye la lista activa actual)
 *
 * Devuelve resultados normalizados para sugerencias inteligentes
 */
export async function searchItemsAcrossLists(query) {
  if (!query || query.trim().length < 2) return [];

  const q = normalize(query);

  try {
    // 📦 Cargar todas las listas guardadas
    const raw = await AsyncStorage.getItem("@shoppingLists");
    if (!raw) return [];

    const lists = JSON.parse(raw);
    if (!Array.isArray(lists)) return [];

    const results = [];

    for (const list of lists) {
      if (!list?.items || !Array.isArray(list.items)) continue;

      for (const item of list.items) {
        if (!item?.name) continue;

        // 🔍 match por nombre
        if (!normalize(item.name).includes(q)) continue;

        results.push({
          item: {
            id: item.id,
            name: item.name,
            priceInfo: item.priceInfo ?? null,
            unitPrice: item.priceInfo?.unitPrice ?? null,
            unitType: item.priceInfo?.unitType ?? "unidad",
          },

          // contexto
          listId: list.id,
          listName: list.name ?? "Lista sin nombre",
          storeId: list.storeId ?? null,

          // 🕒 fecha de compra (CLAVE para ranking temporal)
          purchasedAt:
            item.purchasedAt ?? list.purchasedAt ?? list.updatedAt ?? null,
        });
      }
    }

    return results;
  } catch (e) {
    console.warn("searchItemsAcrossLists error:", e);
    return [];
  }
}

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
