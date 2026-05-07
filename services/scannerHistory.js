// services/scannerHistory.js

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SCANNER_HISTORY_KEY = "scanner_history_v1";

/* -------------------------------------------------
   Storage helpers
-------------------------------------------------- */
async function getItem(key) {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
}

async function setItem(key, value) {
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

export async function getScannedEntryByBarcode(barcode) {
  const cleanBarcode = String(barcode || "").trim();

  if (!cleanBarcode) return null;

  const all = await getScannedHistory();

  return (
    all.find((item) => String(item.barcode || "").trim() === cleanBarcode) ||
    null
  );
}
/* -------------------------------------------------
   Leer historial completo
-------------------------------------------------- */
export async function getScannedHistory() {
  try {
    const raw = await getItem(SCANNER_HISTORY_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    console.log("Error reading scanned history:", error);
    return [];
  }
}

/* -------------------------------------------------
   Guardar historial completo
-------------------------------------------------- */
export async function saveScannedHistory(items) {
  try {
    const safeItems = Array.isArray(items) ? items : [];

    await setItem(SCANNER_HISTORY_KEY, JSON.stringify(safeItems));

    return safeItems;
  } catch (error) {
    console.log("Error saving scanned history:", error);
    return [];
  }
}

/* -------------------------------------------------
   Crear o actualizar escaneo
-------------------------------------------------- */
export async function updateScannedEntry(barcode, patch = {}) {
  const cleanBarcode = String(barcode || "").trim();

  if (!cleanBarcode) return null;

  const all = await getScannedHistory();
  const now = new Date().toISOString();

  const index = all.findIndex(
    (item) => String(item.barcode || "").trim() === cleanBarcode,
  );

  let nextItem;

  if (index >= 0) {
    const previous = all[index];

    nextItem = {
      ...previous,
      ...patch,
      id: previous.id || cleanBarcode,
      barcode: cleanBarcode,
      source: patch.source ?? previous.source ?? "scanner",
      scannedAt: previous.scannedAt ?? patch.scannedAt ?? now,
      updatedAt: patch.updatedAt ?? now,
    };

    all[index] = nextItem;
  } else {
    nextItem = {
      id: cleanBarcode,
      barcode: cleanBarcode,
      name: "",
      brand: "",
      url: "",
      imageUrl: "",
      thumbnailUri: null,
      notes: "",
      source: "scanner",
      scannedAt: now,
      updatedAt: now,
      scanCount: 1,
      ...patch,
    };

    all.unshift(nextItem);
  }

  await saveScannedHistory(all);

  return nextItem;
}

/* -------------------------------------------------
   Guardar escaneo nuevo desde scanner
-------------------------------------------------- */
export async function saveScannedEntry(barcode, patch = {}) {
  const cleanBarcode = String(barcode || "").trim();

  if (!cleanBarcode) return null;

  const all = await getScannedHistory();
  const now = new Date().toISOString();

  const index = all.findIndex(
    (item) => String(item.barcode || "").trim() === cleanBarcode,
  );

  let nextItem;

  if (index >= 0) {
    const previous = all[index];

    nextItem = {
      ...previous,
      ...patch,
      id: previous.id || cleanBarcode,
      barcode: cleanBarcode,
      source: patch.source ?? previous.source ?? "scanner",
      scanCount: Number(previous.scanCount ?? 0) + 1,
      scannedAt: previous.scannedAt ?? patch.scannedAt ?? now,
      updatedAt: now,
    };

    all[index] = nextItem;
  } else {
    nextItem = {
      id: cleanBarcode,
      barcode: cleanBarcode,
      name: "",
      brand: "",
      url: "",
      imageUrl: "",
      thumbnailUri: null,
      notes: "",
      source: "scanner",
      scannedAt: now,
      updatedAt: now,
      scanCount: 1,
      ...patch,
    };

    all.unshift(nextItem);
  }

  await saveScannedHistory(all);

  return nextItem;
}

/* -------------------------------------------------
   Eliminar escaneo
-------------------------------------------------- */
export async function removeScannedItem(barcode) {
  const cleanBarcode = String(barcode || "").trim();

  if (!cleanBarcode) return [];

  const all = await getScannedHistory();

  const next = all.filter(
    (item) => String(item.barcode || "").trim() !== cleanBarcode,
  );

  await saveScannedHistory(next);

  return next;
}

/* -------------------------------------------------
   Borrar todo el historial
-------------------------------------------------- */
export async function clearScannedHistory() {
  await saveScannedHistory([]);
  return [];
}
