import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute } from "@react-navigation/native";

import BarcodeScannerView from "../../components/features/scanner/BarcodeScannerView";
import { safeAlert } from "../../components/ui/alert/safeAlert";
import { ROUTES } from "../../navigation/ROUTES";

import {
  getScannedEntryByBarcode,
  saveScannedEntry,
} from "../../services/scannerHistory";

import { lookupProductByBarcode } from "../../services/productLookup";

export default function NewProductScannerScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const isHandlingScanRef = useRef(false);

  const { barcodeTypes } = route.params || {};

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  function normalizeBarcode(code) {
    return String(code || "")
      .replace(/\D/g, "")
      .trim();
  }

  async function saveDetectedBarcode(code) {
    const barcode = normalizeBarcode(code);

    if (!barcode) return null;

    const now = new Date().toISOString();

    const cachedItem = await getScannedEntryByBarcode(barcode);

    const hasUsefulCachedData =
      cachedItem?.name?.trim() || cachedItem?.imageUrl?.trim();

    if (hasUsefulCachedData) {
      const updatedItem = {
        ...cachedItem,
        barcode,
        source: cachedItem.source || "scanner",
        updatedAt: now,
      };

      await saveScannedEntry(barcode, updatedItem);

      return updatedItem;
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

  async function handleDetected(code) {
    if (isHandlingScanRef.current) return;

    isHandlingScanRef.current = true;

    const barcode = normalizeBarcode(code);

    if (!barcode) {
      isHandlingScanRef.current = false;
      return;
    }

    try {
      await saveDetectedBarcode(barcode);

      navigation.replace(ROUTES.SCANNED_HISTORY, {
        scannedBarcode: barcode,
        showScannedFeedback: true,
      });
    } catch (error) {
      console.log("Error handling new product scan:", error);

      safeAlert("Error", "No se pudo guardar el producto escaneado", [
        {
          text: "Cerrar",
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } finally {
      setTimeout(() => {
        isHandlingScanRef.current = false;
      }, 800);
    }
  }

  function handleClose() {
    navigation.goBack();
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" backgroundColor="#000000" translucent={false} />

      <BarcodeScannerView
        onDetected={handleDetected}
        onClose={handleClose}
        continuous={false}
        barcodeTypes={barcodeTypes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
