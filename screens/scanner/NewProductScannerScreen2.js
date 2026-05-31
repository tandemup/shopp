// screens/scanner/NewProductScannerScreen2.js

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import BarcodeScannerView from "../../components/features/scanner/BarcodeScannerView";

import { ROUTES } from "../../navigation/ROUTES";
import { buildHeaderConfig } from "../../utils/layout/headerStyles";
import { safeAlert, safeMenu } from "../../components/ui/alert/safeAlert";

import {
  getScannedEntryByBarcode,
  saveScannedEntry,
} from "../../services/scannerHistory";

import { lookupProductByBarcode } from "../../services/productLookup";

/* -------------------------------------------------
   Scanner configuration
-------------------------------------------------- */

const ZOOM_VALUES = [0, 0.15, 0.3, 0.45];

const ZOOM_LABELS = ["1x", "1.2x", "1.5x", "2x"];

const DEFAULT_BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"];

const ALLOWED_BARCODE_TYPES = new Set(["ean13", "ean8", "upc_a", "upc_e"]);

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function normalizeBarcodeTypes(value) {
  if (Array.isArray(value)) {
    const filtered = value.filter((type) => ALLOWED_BARCODE_TYPES.has(type));

    return filtered.length > 0 ? filtered : DEFAULT_BARCODE_TYPES;
  }

  if (value && typeof value === "object") {
    const filtered = Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([type]) => type)
      .filter((type) => ALLOWED_BARCODE_TYPES.has(type));

    return filtered.length > 0 ? filtered : DEFAULT_BARCODE_TYPES;
  }

  return DEFAULT_BARCODE_TYPES;
}

function normalizeBarcode(code) {
  const clean = String(code || "")
    .replace(/\D/g, "")
    .trim();

  /*
   * EAN-8, UPC-A y EAN-13.
   *
   * Para productos de supermercado no necesitamos interpretar
   * códigos QR ni formatos alfanuméricos.
   */
  if (clean.length === 8 || clean.length === 12 || clean.length === 13) {
    return clean;
  }

  return null;
}

/* -------------------------------------------------
   Component
-------------------------------------------------- */

export default function NewProductScannerScreen2() {
  const navigation = useNavigation();
  const route = useRoute();

  const scannedRef = useRef(false);
  const handlingScanRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();

  const [locked, setLocked] = useState(false);

  /*
   * Abrimos la cámara nativa inicialmente en 1.2x.
   * En este dispositivo mejora la lectura de códigos EAN.
   */
  const [zoomIndex, setZoomIndex] = useState(1);

  const [torchEnabled, setTorchEnabled] = useState(false);

  const { autoOpenEngine = false, barcodeTypes: routeBarcodeTypes = null } =
    route.params || {};

  const barcodeTypes = useMemo(
    () => normalizeBarcodeTypes(routeBarcodeTypes),
    [routeBarcodeTypes],
  );

  const headerConfig = useMemo(
    () =>
      buildHeaderConfig({
        title: "Escanear producto",
        preset: "light",
      }),
    [],
  );

  /* -------------------------------------------------
     Navigation configuration
  -------------------------------------------------- */

  useLayoutEffect(() => {
    navigation.setOptions({
      ...headerConfig.navigationOptions,
      headerShown: false,
    });
  }, [navigation, headerConfig]);

  /*
   * Rearmamos el lector cuando la pantalla recupera el foco.
   */
  useFocusEffect(
    useCallback(() => {
      scannedRef.current = false;
      handlingScanRef.current = false;

      setLocked(false);
      setTorchEnabled(false);
      setZoomIndex(1);

      return () => {
        scannedRef.current = false;
        handlingScanRef.current = false;

        setLocked(false);
        setTorchEnabled(false);
      };
    }, []),
  );

  /* -------------------------------------------------
     Product lookup and optional history persistence
  -------------------------------------------------- */

  async function getDetectedBarcodeProduct(
    code,
    { saveToHistory = false } = {},
  ) {
    const barcode = normalizeBarcode(code);

    if (!barcode) return null;

    const now = new Date().toISOString();

    const cachedItem = await getScannedEntryByBarcode(barcode);

    const hasUsefulCachedData =
      cachedItem?.name?.trim() || cachedItem?.imageUrl?.trim();

    /*
     * Evitamos repetir una consulta remota si el historial local
     * ya contiene información útil.
     */
    if (hasUsefulCachedData) {
      const updatedItem = {
        ...cachedItem,
        barcode,
        source: cachedItem.source || "scanner",
        updatedAt: now,
      };

      if (saveToHistory) {
        await saveScannedEntry(barcode, updatedItem);
      }

      return updatedItem;
    }

    const lookup = await lookupProductByBarcode(barcode);
    const product = lookup?.found ? lookup.product : null;

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

    if (saveToHistory) {
      await saveScannedEntry(barcode, scannedItem);
    }

    return scannedItem;
  }

  /* -------------------------------------------------
     Scanner state
  -------------------------------------------------- */

  function unlockScanner() {
    scannedRef.current = false;
    handlingScanRef.current = false;

    setLocked(false);
    setTorchEnabled(false);
  }

  function handleCancel() {
    unlockScanner();
    navigation.goBack();
  }

  function handleChangeZoom() {
    setZoomIndex((previous) => {
      return (previous + 1) % ZOOM_VALUES.length;
    });
  }

  function handleToggleTorch() {
    setTorchEnabled((previous) => !previous);
  }

  /* -------------------------------------------------
     Process detected barcode
  -------------------------------------------------- */

  async function processDetectedBarcode(barcode, saveToHistory) {
    try {
      const scannedItem = await getDetectedBarcodeProduct(barcode, {
        saveToHistory,
      });

      navigation.replace(ROUTES.PRODUCT_INFO, {
        barcode,
        product: scannedItem,
        autoOpenEngine,
      });
    } catch (error) {
      console.log("Error handling new product scan:", error);

      unlockScanner();

      safeAlert("Error", "No se pudo procesar el producto escaneado", [
        {
          text: "Cerrar",
          onPress: handleCancel,
        },
      ]);
    }
  }

  /* -------------------------------------------------
     Common detected barcode handler
  -------------------------------------------------- */

  function handleDetectedBarcode(code) {
    if (locked) return;
    if (scannedRef.current) return;
    if (handlingScanRef.current) return;

    const barcode = normalizeBarcode(code);

    if (!barcode) return;

    scannedRef.current = true;
    handlingScanRef.current = true;

    setLocked(true);
    setTorchEnabled(false);

    safeMenu(
      "Producto detectado",
      `Código: ${barcode}\n\n¿Quieres añadir este producto al historial de escaneos?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: unlockScanner,
        },
        {
          text: "No añadir",
          onPress: () => {
            processDetectedBarcode(barcode, false);
          },
        },
        {
          text: "Añadir",
          onPress: () => {
            processDetectedBarcode(barcode, true);
          },
        },
      ],
    );
  }

  /*
   * expo-camera devuelve un objeto { data, type }.
   */
  function handleNativeBarcodeScanned({ data }) {
    handleDetectedBarcode(data);
  }

  /*
   * BarcodeScannerView devuelve directamente el texto normalizado.
   */
  function handleWebDetected(code) {
    handleDetectedBarcode(code);
  }

  function handleCameraMountError(event) {
    console.log("Camera mount error:", event?.message);

    unlockScanner();

    safeAlert(
      "No se pudo iniciar la cámara",
      "Comprueba que el navegador o la aplicación tienen permiso para utilizar la cámara.",
      [
        {
          text: "Cerrar",
          onPress: handleCancel,
        },
      ],
    );
  }

  /* -------------------------------------------------
     Web implementation
  -------------------------------------------------- */

  /*
   * En navegador delegamos completamente en BarcodeScannerView.
   *
   * Ese componente seleccionará automáticamente:
   *
   *   UnifiedBarcodeScanner.web.js
   *
   * cuando la aplicación se compile para Netlify.
   */
  if (Platform.OS === "web") {
    return (
      <View style={styles.screen}>
        <StatusBar
          style="light"
          backgroundColor="#000000"
          translucent={false}
        />

        <BarcodeScannerView
          onDetected={handleWebDetected}
          onClose={handleCancel}
          continuous={true}
          duplicateCooldownMs={1500}
          showControls={true}
          barcodeTypes={barcodeTypes}
        />
      </View>
    );
  }
  /* -------------------------------------------------
     Native permissions
  -------------------------------------------------- */

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          style="light"
          backgroundColor="#000000"
          translucent={false}
        />

        <View style={styles.center}>
          <ActivityIndicator color="#111827" />

          <Text style={styles.message}>Comprobando permisos de cámara...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <StatusBar {...headerConfig.statusBar} />

        <View style={styles.center}>
          <Ionicons name="camera-outline" size={42} color="#64748b" />

          <Text style={styles.title}>Permiso de cámara necesario</Text>

          <Text style={styles.message}>
            Necesitas permitir el acceso a la cámara para escanear productos.
          </Text>

          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryText}>Permitir cámara</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={handleCancel}>
            <Text style={styles.secondaryText}>Cancelar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* -------------------------------------------------
     Native scanner
  -------------------------------------------------- */

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar style="light" backgroundColor="#000000" translucent={false} />

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          autofocus="on"
          zoom={ZOOM_VALUES[zoomIndex]}
          enableTorch={torchEnabled}
          onMountError={handleCameraMountError}
          onBarcodeScanned={locked ? undefined : handleNativeBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes,
          }}
        />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="box-none">
            <Pressable style={styles.closeButton} onPress={handleCancel}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.middle} pointerEvents="none">
            <View style={styles.scanBox}>
              <View style={styles.scanLine} />

              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>

            <Text style={styles.centerHint}>
              Coloca el código dentro del recuadro
            </Text>
          </View>

          <View style={styles.bottomPanel}>
            <Text style={styles.scanTitle}>Escanear nuevo producto</Text>

            <Text style={styles.scanHint}>
              Lee el código, guarda el escaneo y muestra la ficha del producto.
            </Text>

            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={handleChangeZoom}>
                <Ionicons name="scan-outline" size={18} color="#FFFFFF" />

                <Text style={styles.actionText}>
                  Zoom {ZOOM_LABELS[zoomIndex]}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  torchEnabled && styles.actionBtnActive,
                ]}
                onPress={handleToggleTorch}
              >
                <Ionicons
                  name={torchEnabled ? "flashlight" : "flashlight-outline"}
                  size={18}
                  color="#FFFFFF"
                />

                <Text style={styles.actionText}>
                  {torchEnabled ? "Luz ON" : "Linterna"}
                </Text>
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>

            {locked ? (
              <View style={styles.readingBox}>
                <ActivityIndicator color="#FFFFFF" />

                <Text style={styles.readingText}>
                  Código leído. Buscando producto...
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */

const CORNER_SIZE = 30;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },

  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },

  cameraWrap: {
    flex: 1,
    backgroundColor: "#000000",
  },

  camera: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },

  topBar: {
    minHeight: Platform.OS === "android" ? 56 : 48,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  middle: {
    alignItems: "center",
    justifyContent: "center",
  },

  scanBox: {
    width: "82%",
    height: 150,
    borderRadius: 18,
    position: "relative",
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  scanLine: {
    position: "absolute",
    left: 18,
    right: 18,
    top: "50%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.85)",
  },

  cornerTopLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
    borderTopLeftRadius: 18,
  },

  cornerTopRight: {
    position: "absolute",
    right: 0,
    top: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
    borderTopRightRadius: 18,
  },

  cornerBottomLeft: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
    borderBottomLeftRadius: 18,
  },

  cornerBottomRight: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
    borderBottomRightRadius: 18,
  },

  centerHint: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  bottomPanel: {
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.68)",
  },

  scanTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  scanHint: {
    marginTop: 6,
    color: "#D1D5DB",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  actionsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },

  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "rgba(37,99,235,0.95)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },

  actionBtnActive: {
    backgroundColor: "rgba(245,158,11,0.95)",
  },

  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  cancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
  },

  cancelText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  readingBox: {
    marginTop: 14,
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 10,
  },

  readingText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  center: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  message: {
    marginTop: 10,
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
  },

  primaryBtn: {
    marginTop: 20,
    width: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  secondaryBtn: {
    marginTop: 10,
    width: "100%",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  secondaryText: {
    color: "#374151",
    fontWeight: "700",
  },
});
