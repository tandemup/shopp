import { storage } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";

export async function loadLists() {
  return await storage.getJSON(STORAGE_KEYS.LISTS, []);
}

export async function saveLists(lists) {
  return await storage.setJSON(STORAGE_KEYS.LISTS, lists);
}
