import AsyncStorage from "@react-native-async-storage/async-storage";

const SCANNED_KEY = "scannedItems";

/* -------------------------------------------------
   Helpers internos
-------------------------------------------------- */
const loadAll = async () => {
  try {
    const raw = await AsyncStorage.getItem(SCANNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Error loading scanned items:", err);
    return [];
  }
};

const saveAll = async (items) => {
  try {
    await AsyncStorage.setItem(SCANNED_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("Error saving scanned items:", err);
  }
};

/* -------------------------------------------------
   API pública
-------------------------------------------------- */

/**
 * Devuelve todo el historial de escaneos
 */
export const getScannedHistory = async () => {
  return await loadAll();
};

/**
 * Añade o actualiza un escaneo
 * - Si existe el barcode → incrementa scanCount
 * - Si no existe → lo añade
 */
export const addScannedItem = async (item) => {
  if (!item?.barcode) return null;

  const all = await loadAll();
  const index = all.findIndex((i) => i.barcode === item.barcode);
  const now = new Date().toISOString();

  if (index !== -1) {
    const updatedItem = {
      ...all[index],
      scanCount: (all[index].scanCount || 1) + 1,
      updatedAt: now,
    };

    const updated = [
      updatedItem,
      ...all.filter((i) => i.barcode !== item.barcode),
    ];

    await saveAll(updated);
    return updatedItem;
  }

  const newItem = {
    ...item,
    scanCount: 1,
    scannedAt: now,
    updatedAt: now,
    source: "scanner",
  };

  await saveAll([newItem, ...all]);
  return newItem;
};

/**
 * Actualiza campos editables de un escaneo
 */
export const updateScannedEntry = async (barcode, updates) => {
  if (!barcode) return;

  const all = await loadAll();

  const updated = all.map((item) =>
    item.barcode === barcode
      ? {
          ...item,
          ...updates,
          barcode,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );

  await saveAll(updated);
};

/**
 * Elimina un escaneo por código de barras
 */
export const removeScannedItem = async (barcode) => {
  if (!barcode) return;

  const all = await loadAll();
  const filtered = all.filter((item) => item.barcode !== barcode);

  await saveAll(filtered);
};

/**
 * Borra todo el historial de escaneos
 */
export const clearScannedHistory = async () => {
  try {
    await AsyncStorage.removeItem(SCANNED_KEY);
  } catch (err) {
    console.error("Error clearing scanned history:", err);
  }
};
