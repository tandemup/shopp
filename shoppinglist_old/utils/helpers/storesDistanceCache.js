import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "stores_distance_cache";

/**
 * Guarda distancias y ubicación
 */
export async function saveStoresDistance(data) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Error guardando cache:", err);
  }
}

/**
 * Carga cache si existe
 */
export async function loadStoresDistance() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Error cargando cache:", err);
    return null;
  }
}
