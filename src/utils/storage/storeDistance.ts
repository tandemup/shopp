import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "store_distances";

export async function saveDistances(data: Record<string, number>) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function loadDistances(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}
