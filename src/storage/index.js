import { storage } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";

export async function clearLists() {
  await storage.remove(STORAGE_KEYS.LISTS);
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

export async function clearAppStorage() {
  await storage.clearByPrefix("@shopping/");
}
