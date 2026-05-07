import React, { useRef } from "react";
import { StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import BarcodeScannerView from "../../components/features/scanner/BarcodeScannerView";
import {
  getScannedEntryByBarcode,
  saveScannedEntry,
} from "../../services/scannerHistory";

import { lookupProductByBarcode } from "../../services/productLookup";

export default function ScannerScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const isHandlingScanRef = useRef(false);

  const onScan = route.params?.onScan;

  const continuous = route.params?.continuous ?? false;
  const closeOnScan = route.params?.closeOnScan ?? true;
  const shouldSaveToHistory = route.params?.saveToHistory ?? !onScan;
  const returnToTab = route.params?.returnToTab;

  /**
   * Importante:
   * No ponemos fallback ["ean13"] aquí.
   * Si barcodeTypes no viene por navegación, BarcodeScannerView usará
   * los formatos guardados en BarcodeSettingsScreen.
   */
  const barcodeTypes = route.params?.barcodeTypes;

  async function saveDetectedBarcode(code) {
    const barcode = String(code || "")
      .replace(/\D/g, "")
      .trim();

    if (!barcode) return null;

    const now = new Date().toISOString();

    const cachedItem = await getScannedEntryByBarcode(barcode);

    const hasUsefulCachedData =
      cachedItem?.name?.trim() || cachedItem?.imageUrl?.trim();

    if (hasUsefulCachedData) {
      await saveScannedEntry(barcode, {
        ...cachedItem,
        barcode,
        source: cachedItem.source || "scanner",
        updatedAt: now,
      });

      return cachedItem;
    }

    const lookup = await lookupProductByBarcode(barcode);
    const product = lookup.found ? lookup.product : null;

    const scannedItem = {
      id: barcode,
      barcode,

      name: product?.name || cachedItem?.name || "",
      brand: product?.brand || cachedItem?.brand || "",
      imageUrl: product?.imageUrl || cachedItem?.imageUrl || "",
      thumbnailUri: cachedItem?.thumbnailUri || null,
      url: product?.url || cachedItem?.url || "",
      notes: cachedItem?.notes || "",

      source: "scanner",
      lookupSource: product?.lookupSource || cachedItem?.lookupSource || null,

      scannedAt: cachedItem?.scannedAt || now,
      updatedAt: now,
    };

    await saveScannedEntry(barcode, scannedItem);

    return scannedItem;
  }

  function closeScanner() {
    if (returnToTab) {
      navigation.getParent()?.navigate(returnToTab);
      return;
    }

    navigation.goBack();
  }

  async function handleDetected(code) {
    if (isHandlingScanRef.current) return;

    isHandlingScanRef.current = true;

    try {
      if (typeof onScan === "function") {
        onScan(code);
      }

      if (shouldSaveToHistory) {
        await saveDetectedBarcode(code);
      }

      if (closeOnScan) {
        closeScanner();
      }
    } catch (error) {
      console.log("Error handling scanned barcode:", error);

      if (closeOnScan) {
        closeScanner();
      }
    } finally {
      setTimeout(() => {
        isHandlingScanRef.current = false;
      }, 800);
    }
  }

  function handleClose() {
    closeScanner();
  }

  return (
    <BarcodeScannerView
      onDetected={handleDetected}
      onClose={handleClose}
      continuous={continuous}
      barcodeTypes={barcodeTypes}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
