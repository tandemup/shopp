import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_GENERAL_ENGINE = "config.search.generalEngine";
const KEY_BOOK_ENGINE = "config.search.bookEngine";

const DEFAULT_GENERAL_ENGINE = "openfoodfacts";
const DEFAULT_BOOK_ENGINE = "google_books";

export async function getGeneralSearchEngine() {
  const value = await AsyncStorage.getItem(KEY_GENERAL_ENGINE);
  return value ?? DEFAULT_GENERAL_ENGINE;
}

export async function setGeneralSearchEngine(engineId) {
  await AsyncStorage.setItem(KEY_GENERAL_ENGINE, engineId);
}

export async function getBookSearchEngine() {
  const value = await AsyncStorage.getItem(KEY_BOOK_ENGINE);
  return value ?? DEFAULT_BOOK_ENGINE;
}

export async function setBookSearchEngine(engineId) {
  await AsyncStorage.setItem(KEY_BOOK_ENGINE, engineId);
}
