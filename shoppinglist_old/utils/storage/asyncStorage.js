import AsyncStorage from "@react-native-async-storage/async-storage";

export async function clearStoresData() {
  await AsyncStorage.removeItem("STORES_DATA");
}

export const getItem = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("AsyncStorage getItem error", key, e);
    return null;
  }
};

export const setItem = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("AsyncStorage setItem error", key, e);
  }
};

export const removeItem = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn("AsyncStorage removeItem error", key, e);
  }
};
