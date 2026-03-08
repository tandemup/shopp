import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_CACHE_KEY = "@expo-shop/location/cache";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

export async function getCachedLocation() {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_CACHE_KEY);

    if (!raw) {
      console.log("📍 Cache location: MISS");
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.coords || !parsed?.timestamp) {
      console.log("📍 Cache location: INVALID");
      return null;
    }

    const expired = Date.now() - parsed.timestamp > MAX_AGE_MS;
    if (expired) {
      console.log("📍 Cache location: EXPIRED");
      return null;
    }

    console.log("📍 Cache location: HIT");
    return {
      coords: parsed.coords,
      timestamp: parsed.timestamp,
    };
  } catch (e) {
    console.warn("Error leyendo caché de ubicación", e);
    return null;
  }
}

export async function setCachedLocation(coords) {
  try {
    const payload = {
      coords,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(payload));

    console.log("📍 Cache location: SAVED", payload);
  } catch (e) {
    console.warn("Error guardando caché de ubicación", e);
  }
}

export async function clearCachedLocation() {
  try {
    await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
    console.log("📍 Cache location: CLEARED");
  } catch (e) {
    console.warn("Error limpiando caché de ubicación", e);
  }
}
