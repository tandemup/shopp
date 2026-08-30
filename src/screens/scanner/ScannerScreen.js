import React, { useRef } from "react";
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { I18nText as Text } from "@/src/i18n";

import BarcodeScannerView from "@/src/components/features/scanner/BarcodeScannerView";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { ROUTES } from "@/src/navigation/ROUTES";
import { useProductLookupWithCache } from "@/src/hooks/useProductLookupWithCache";
import { useScannedHistoryStorage } from "@/src/hooks/useScannedHistoryStorage";
import { normalizeBarcode } from "@/src/utils/barcodeNormalization";
import { normalizeScannedProduct } from "@/src/utils/scannedProductModel";

const SCANNER_PRODUCTS_FORMAT = "shopp-scanner-products";
const SCANNER_PRODUCTS_VERSION = 1;

function buildJsonFilename() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  return `shopp-scanner-products-${yyyy}${mm}${dd}-${hh}${min}.json`;
}

function normalizeDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details)
      .map(([key, value]) => [key, String(value ?? "").trim()])
      .filter(([, value]) => Boolean(value)),
  );
}

function normalizeExportProduct(product) {
  const normalized = normalizeScannedProduct(product, product?.barcode);
  const scanCount = Number(normalized.scanCount || 1);

  return {
    id: normalized.id,
    barcode: normalized.barcode,
    name: normalized.name,
    brand: normalized.brand,
    productType: normalized.productType,
    category: normalized.category,
    subcategory: normalized.subcategory,
    imageUrl: normalized.imageUrl,
    url: normalized.url,
    productUrl: normalized.productUrl,
    thumbnailUri: normalized.thumbnailUri || null,
    details: normalizeDetails(normalized.details),
    notes: String(normalized.notes || "").trim(),
    source: String(normalized.source || "scanner").trim() || "scanner",
    lookupSource: normalized.lookupSource || null,
    dataSource: String(normalized.dataSource || "").trim(),
    scannedAt: String(normalized.scannedAt || "").trim(),
    updatedAt: String(normalized.updatedAt || "").trim(),
    scanCount: Number.isFinite(scanCount) ? Math.max(1, scanCount) : 1,
  };
}

function getImportedProducts(parsed) {
  if (
    !parsed ||
    parsed.format !== SCANNER_PRODUCTS_FORMAT ||
    parsed.version !== SCANNER_PRODUCTS_VERSION
  ) {
    throw new Error("El fichero no es una exportación del scanner compatible.");
  }

  if (!Array.isArray(parsed.data?.products)) {
    throw new Error("El fichero no contiene una lista válida de productos.");
  }

  const productsByBarcode = new Map();

  parsed.data.products.forEach((product) => {
    const normalized = normalizeExportProduct(product);
    if (normalized.barcode) {
      productsByBarcode.set(normalized.barcode, normalized);
    }
  });

  return Array.from(productsByBarcode.values());
}

function downloadJsonOnWeb(filename, json) {
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function ScannerScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const isHandlingScanRef = useRef(false);
  const { lookupWithCache } = useProductLookupWithCache();
  const scanHistoryStorage = useScannedHistoryStorage();

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
    const barcode = normalizeBarcode(code);

    if (!barcode) return null;

    const now = new Date().toISOString();

    const cachedItem =
      await scanHistoryStorage.getScannedEntryByBarcode(barcode);

    const hasUsefulCachedData =
      cachedItem?.name?.trim() || cachedItem?.imageUrl?.trim();

    if (hasUsefulCachedData) {
      const updatedItem = normalizeScannedProduct(
        {
          ...cachedItem,
          barcode,
          source: cachedItem.source || "scanner",
          updatedAt: now,
        },
        barcode,
      );

      await scanHistoryStorage.saveScannedEntry(barcode, updatedItem);

      return updatedItem;
    }

    const lookup = await lookupWithCache(barcode);
    const product = lookup?.product || null;

    const scannedItem = normalizeScannedProduct(
      {
        id: barcode,
        barcode,
        name: product?.name || cachedItem?.name || "",
        brand: product?.brand || cachedItem?.brand || "",
        productType:
          product?.productType ||
          product?.product_type ||
          cachedItem?.productType ||
          "",
        category: product?.category || cachedItem?.category || "",
        subcategory: product?.subcategory || cachedItem?.subcategory || "",
        imageUrl: product?.imageUrl || cachedItem?.imageUrl || "",
        thumbnailUri: cachedItem?.thumbnailUri || null,
        url: product?.url || product?.productUrl || cachedItem?.url || "",
        productUrl:
          product?.productUrl || cachedItem?.productUrl || cachedItem?.url || "",
        details: product?.details || cachedItem?.details || {},
        notes: cachedItem?.notes || "",
        source: "scanner",
        lookupSource: product?.lookupSource || cachedItem?.lookupSource || null,
        scannedAt: cachedItem?.scannedAt || now,
        updatedAt: now,
        scanCount: cachedItem?.scanCount || 1,
      },
      barcode,
    );

    await scanHistoryStorage.saveScannedEntry(barcode, scannedItem);

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

    const barcode = normalizeBarcode(code);

    if (!barcode) {
      isHandlingScanRef.current = false;
      return;
    }

    try {
      if (typeof onScan === "function") {
        onScan(barcode);

        if (closeOnScan) {
          closeScanner();
        }

        return;
      }

      if (shouldSaveToHistory) {
        await saveDetectedBarcode(barcode);

        navigation.replace(ROUTES.SCANNED_HISTORY, {
          scannedBarcode: barcode,
          showScannedFeedback: true,
        });

        return;
      }

      if (closeOnScan) {
        closeScanner();
      }
    } catch (error) {
      console.log("Error handling scanned barcode:", error);

      safeAlert("Error", "No se pudo procesar el código escaneado", [
        {
          text: "Cerrar",
          onPress: () => {
            if (closeOnScan) {
              closeScanner();
            }
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
    closeScanner();
  }

  async function handleExportProducts() {
    try {
      const history = await scanHistoryStorage.getScannedHistory();
      const products = history
        .map(normalizeExportProduct)
        .filter((product) => Boolean(product.barcode));

      if (!products.length) {
        safeAlert("Exportar productos", "No hay productos escaneados para exportar.");
        return;
      }

      const filename = buildJsonFilename();
      const json = JSON.stringify(
        {
          app: "Shopp",
          format: SCANNER_PRODUCTS_FORMAT,
          version: SCANNER_PRODUCTS_VERSION,
          exportedAt: new Date().toISOString(),
          data: { products },
        },
        null,
        2,
      );

      if (Platform.OS === "web" && typeof document !== "undefined") {
        downloadJsonOnWeb(filename, json);
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Share.share({
        title: filename,
        url: fileUri,
        message: Platform.OS === "android" ? json : undefined,
      });
    } catch (error) {
      safeAlert(
        "No se pudo exportar",
        error?.message || "No se pudieron exportar los productos.",
      );
    }
  }

  async function handleImportProducts() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error("No se pudo leer el fichero seleccionado.");
      }

      const jsonText =
        Platform.OS === "web" && asset.file
          ? await asset.file.text()
          : await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
      const importedProducts = getImportedProducts(JSON.parse(jsonText));

      if (!importedProducts.length) {
        throw new Error("El fichero no contiene productos con código de barras.");
      }

      const currentHistory = await scanHistoryStorage.getScannedHistory();
      const productsByBarcode = new Map(
        currentHistory
          .map(normalizeExportProduct)
          .filter((product) => Boolean(product.barcode))
          .map((product) => [product.barcode, product]),
      );

      importedProducts.forEach((imported) => {
        const previous = productsByBarcode.get(imported.barcode);
        productsByBarcode.set(
          imported.barcode,
          normalizeExportProduct({
            ...previous,
            ...imported,
            details: {
              ...(previous?.details || {}),
              ...(imported.details || {}),
            },
            scanCount: Math.max(
              Number(previous?.scanCount || 1),
              Number(imported.scanCount || 1),
            ),
          }),
        );
      });

      await scanHistoryStorage.replaceScannedHistory(
        Array.from(productsByBarcode.values()),
      );

      safeAlert(
        "Importación completada",
        `Se han incorporado ${importedProducts.length} productos normalizados.`,
      );
    } catch (error) {
      safeAlert(
        "No se pudo importar",
        error?.name === "SyntaxError"
          ? "El fichero seleccionado no contiene JSON válido."
          : error?.message || "No se pudieron importar los productos.",
      );
    }
  }

  return (
    <View style={styles.container}>
      <BarcodeScannerView
        onDetected={handleDetected}
        onClose={handleClose}
        continuous={continuous}
        barcodeTypes={barcodeTypes}
      />

      {!onScan ? (
        <View style={styles.transferBar} pointerEvents="box-none">
          <Pressable
            onPress={handleImportProducts}
            style={({ pressed }) => [
              styles.transferButton,
              pressed && styles.transferButtonPressed,
            ]}
          >
            <Text style={styles.transferButtonText}>Importar JSON</Text>
          </Pressable>
          <Pressable
            onPress={handleExportProducts}
            style={({ pressed }) => [
              styles.transferButton,
              pressed && styles.transferButtonPressed,
            ]}
          >
            <Text style={styles.transferButtonText}>Exportar JSON</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  transferBar: {
    position: "absolute",
    top: 18,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },

  transferButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  transferButtonPressed: {
    backgroundColor: "#DBEAFE",
  },

  transferButtonText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "700",
  },
});
