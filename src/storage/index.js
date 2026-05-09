import { storage } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";

export { storage } from "./storage";
export { STORAGE_KEYS } from "./storageKeys";

export * from "./listsStorage";
export * from "./settingsStorage";
export * from "./barcodeSettingsStorage";
export * from "./favoritesStorage";

export async function clearActiveLists() {
  const lists = await storage.getJSON(STORAGE_KEYS.LISTS, []);

  if (!Array.isArray(lists)) {
    await storage.setJSON(STORAGE_KEYS.LISTS, []);
    return;
  }

  const archivedLists = lists.filter((list) => list?.archived === true);
  await storage.setJSON(STORAGE_KEYS.LISTS, archivedLists);
}

export async function clearArchivedLists() {
  const lists = await storage.getJSON(STORAGE_KEYS.LISTS, []);

  if (!Array.isArray(lists)) {
    await storage.setJSON(STORAGE_KEYS.LISTS, []);
    return;
  }

  const activeLists = lists.filter((list) => list?.archived !== true);
  await storage.setJSON(STORAGE_KEYS.LISTS, activeLists);
}

export async function clearPurchaseHistory() {
  await storage.remove(STORAGE_KEYS.PURCHASES);
}

export async function clearScannedHistory() {
  await storage.remove(STORAGE_KEYS.SCANNED_ITEMS);
}

export async function clearStoresData() {
  await storage.remove(STORAGE_KEYS.STORES);
}

export async function clearStorage() {
  await storage.clearByPrefix("@shopping/");
}
