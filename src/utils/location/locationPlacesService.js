import AsyncStorage from "@react-native-async-storage/async-storage";

const HOME_KEY = "@expo-shop/location/home";
const SHOPPING_KEY = "@expo-shop/location/shopping";

// ────────────────────────────────────────────────
// CASA
// ────────────────────────────────────────────────
export async function saveHomeLocation(coords) {
  const payload = {
    coords,
    label: "Casa",
    timestamp: Date.now(),
  };

  await AsyncStorage.setItem(HOME_KEY, JSON.stringify(payload));
}

export async function loadHomeLocation() {
  const raw = await AsyncStorage.getItem(HOME_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ────────────────────────────────────────────────
// TIENDA ACTUAL
// ────────────────────────────────────────────────
export async function saveShoppingLocation({ coords, store }) {
  const payload = {
    coords,
    label: store?.name ?? "Tienda",
    storeId: store?.id ?? null,
    timestamp: Date.now(),
  };

  await AsyncStorage.setItem(SHOPPING_KEY, JSON.stringify(payload));
}

export async function loadShoppingLocation() {
  const raw = await AsyncStorage.getItem(SHOPPING_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearShoppingLocation() {
  await AsyncStorage.removeItem(SHOPPING_KEY);
}
