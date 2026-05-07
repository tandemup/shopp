import { storage } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";

async function getFavorites() {
  return await storage.getJSON(STORAGE_KEYS.FAVORITES, []);
}

async function saveFavorites(favorites) {
  return await storage.setJSON(STORAGE_KEYS.FAVORITES, favorites);
}

export const favoritesStorage = {
  getFavorites,
  saveFavorites,
};
