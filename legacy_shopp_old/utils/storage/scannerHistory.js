import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@scanner_history";

export async function getScannedHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addScanToHistory({ barcode }) {
  try {
    const history = await getScannedHistory();

    const existing = history.find((i) => i.barcode === barcode);

    if (existing) {
      existing.scanCount += 1;
      existing.scannedAt = Date.now();
    } else {
      history.unshift({
        barcode,
        name: barcode, // provisional, editable luego
        scannedAt: Date.now(),
        scanCount: 1,
        source: "scanner",
        isBook: false,
      });
    }

    await AsyncStorage.setItem(KEY, JSON.stringify(history));
  } catch (e) {
    console.warn("Error guardando historial", e);
  }
}

export async function removeScannedItem(barcode) {
  try {
    const history = await getScannedHistory();
    const filtered = history.filter((i) => i.barcode !== barcode);
    await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
  } catch {}
}
