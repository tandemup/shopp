import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_GENERAL_ENGINE = "config.search.generalEngine";

const DEFAULT_GENERAL_ENGINE = "openfoodfacts";

export async function getGeneralSearchEngine() {
  const value = await AsyncStorage.getItem(KEY_GENERAL_ENGINE);
  return value ?? DEFAULT_GENERAL_ENGINE;
}

export async function setGeneralSearchEngine(engineId) {
  await AsyncStorage.setItem(KEY_GENERAL_ENGINE, engineId);
}
