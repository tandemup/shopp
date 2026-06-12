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

import QuickEan13Scanner from "../../components/features/scanner/QuickEan13Scanner";
import ScannerOverlay from "../../components/features/scanner/ScannerOverlay";

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
    const filtered = value.filter((type) => {
      return ALLOWED_BARCODE_TYPES.has(type);
    });

    return filtered.length > 0 ? filtered : DEFAULT_BARCODE_TYPES;
  }

  if (value && typeof value === "object") {
    const filtered = Object.entries(value)
      .filter(([, enabled]) => {
        return Boolean(enabled);
      })
      .map(([type]) => {
        return type;
      })
      .filter((type) => {
        return ALLOWED_BARCODE_TYPES.has(type);
      });

    return filtered.length > 0 ? filtered : DEFAULT_BARCODE_TYPES;
  }

  return DEFAULT_BARCODE_TYPES;
}

function normalizeBarcode(code) {
  return String(code || "")
    .replace(/\D/g, "")
    .trim();
}

/**
 * Busca el navegador que contiene la ruta solicitada.
 *
 * NewProductScannerScreen2 pertenece al stack Scanner.
 * ItemDetailScreen pertenece al stack Shopping.
 */
function navigateToAvailableRoute(navigation, routeName, params) {
  let currentNavigation = navigation;

  while (currentNavigation) {
    const state = currentNavigation.getState?.();

    if (state?.routeNames?.includes(routeName)) {
      currentNavigation.navigate(routeName, params);

      return true;
    }

    currentNavigation = currentNavigation.getParent?.();
  }

  try {
    navigation.navigate(routeName, params);

    return true;
  } catch (error) {
    console.log("No se pudo navegar a la ruta:", routeName, error);

    return false;
  }
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

  /*
   * Leemos primero los parámetros de navegación.
   */
  const {
    autoOpenEngine = false,

    barcodeTypes: routeBarcodeTypes = null,

    captureMode = null,

    listId = null,

    itemId = null,

    returnToTab = ROUTES.SHOPPING_TAB,

    returnToScreen = ROUTES.ITEM_DETAIL,

    showControls = true,

    initialZoomIndex = 1,

    initialTorchEnabled = false,

    showStatusBadges = true,
  } = route.params || {};

  /*
   * Evita índices inexistentes.
   */
  const safeInitialZoomIndex =
    Number.isInteger(initialZoomIndex) &&
    initialZoomIndex >= 0 &&
    initialZoomIndex < ZOOM_VALUES.length
      ? initialZoomIndex
      : 1;

  const safeInitialTorchEnabled = Boolean(initialTorchEnabled);

  const [locked, setLocked] = useState(false);

  const [zoomIndex, setZoomIndex] = useState(safeInitialZoomIndex);

  const [torchEnabled, setTorchEnabled] = useState(safeInitialTorchEnabled);

  const isQuickEan13Input = captureMode === "ean13-input";

  const barcodeTypes = useMemo(() => {
    return normalizeBarcodeTypes(routeBarcodeTypes);
  }, [routeBarcodeTypes]);

  const headerConfig = useMemo(() => {
    return buildHeaderConfig({
      title: "Escanear producto",
      preset: "light",
    });
  }, []);

  /* -------------------------------------------------
     Navigation configuration
  -------------------------------------------------- */

  useLayoutEffect(() => {
    navigation.setOptions({
      ...headerConfig.navigationOptions,

      headerShown: false,
    });
  }, [navigation, headerConfig]);

  useFocusEffect(
    useCallback(() => {
      scannedRef.current = false;

      handlingScanRef.current = false;

      setLocked(false);

      /*
       * Recuperamos los valores iniciales cada vez
       * que se abre el lector.
       */
      setZoomIndex(safeInitialZoomIndex);

      setTorchEnabled(safeInitialTorchEnabled);

      return () => {
        scannedRef.current = false;

        handlingScanRef.current = false;

        setLocked(false);

        /*
         * La linterna siempre debe apagarse
         * al abandonar la pantalla.
         */
        setTorchEnabled(false);
      };
    }, [safeInitialTorchEnabled, safeInitialZoomIndex]),
  );

  /* -------------------------------------------------
     Common actions
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
    setTorchEnabled((previous) => {
      return !previous;
    });
  }

  /* -------------------------------------------------
     Fast EAN-13 input mode
  -------------------------------------------------- */

  function handleQuickEan13Detected(code) {
    if (scannedRef.current || handlingScanRef.current) {
      return;
    }

    const barcode = normalizeBarcode(code);

    if (barcode.length !== 13) {
      return;
    }

    /*
     * Bloqueamos inmediatamente el lector para evitar
     * detecciones consecutivas del mismo código.
     */
    scannedRef.current = true;

    handlingScanRef.current = true;

    setLocked(true);

    setTorchEnabled(false);

    const navigationParams = {
      screen: returnToScreen,

      params: {
        listId,

        itemId,

        scannedBarcode: barcode,
      },
    };

    const didNavigate = navigateToAvailableRoute(
      navigation,

      returnToTab,

      navigationParams,
    );

    if (!didNavigate) {
      console.log("No se encontró la ruta de retorno:", {
        returnToTab,

        returnToScreen,

        listId,

        itemId,

        scannedBarcode: barcode,
      });

      unlockScanner();

      safeAlert(
        "Error de navegación",

        "Se detectó el código, pero no se pudo regresar al producto.",
      );
    }
  }

  /*
   * Desde ItemDetailScreen utilizamos únicamente EAN-13.
   */
  if (isQuickEan13Input) {
    return (
      <View style={styles.screen}>
        <StatusBar
          style="light"
          backgroundColor="#000000"
          translucent={false}
        />

        <QuickEan13Scanner
          onDetected={handleQuickEan13Detected}
          onCancel={handleCancel}
          showControls={showControls}
          showStatusBadges={showStatusBadges}
          zoom={ZOOM_VALUES[zoomIndex]}
          zoomLabel={ZOOM_LABELS[zoomIndex]}
          torchEnabled={torchEnabled}
          onChangeZoom={handleChangeZoom}
          onToggleTorch={handleToggleTorch}
        />
      </View>
    );
  }

  /* -------------------------------------------------
     Product lookup and optional history persistence
  -------------------------------------------------- */

  async function getDetectedBarcodeProduct(
    code,

    { saveToHistory = false } = {},
  ) {
    const barcode = normalizeBarcode(code);

    if (!barcode) {
      return null;
    }

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

  function handleDetectedBarcode(code) {
    if (locked || scannedRef.current || handlingScanRef.current) {
      return;
    }

    const barcode = normalizeBarcode(code);

    if (!barcode) {
      return;
    }

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

  function handleNativeBarcodeScanned({ data }) {
    handleDetectedBarcode(data);
  }

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
     General web scanner
  -------------------------------------------------- */

  if (Platform.OS === "web") {
    return (
      <View style={styles.screen}>
        <StatusBar
          style="light"
          backgroundColor="#000000"
          translucent={false}
        />

        <QuickEan13Scanner
          onDetected={handleWebDetected}
          onCancel={handleCancel}
          showControls={showControls}
          showStatusBadges={showStatusBadges}
          zoom={ZOOM_VALUES[zoomIndex]}
          zoomLabel={ZOOM_LABELS[zoomIndex]}
          torchEnabled={torchEnabled}
          onChangeZoom={handleChangeZoom}
          onToggleTorch={handleToggleTorch}
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
          <ActivityIndicator color="#FFFFFF" />

          <Text style={styles.messageLight}>
            Comprobando permisos de cámara...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <StatusBar {...headerConfig.statusBar} />

        <View style={styles.center}>
          <Ionicons name="camera-outline" size={42} color="#64748B" />

          <Text style={styles.permissionTitle}>
            Permiso de cámara necesario
          </Text>

          <Text style={styles.permissionMessage}>
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
     General native scanner
  -------------------------------------------------- */

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar style="light" backgroundColor="#000000" translucent={false} />

      <View style={styles.cameraWrap}>
        {/*
         * CameraView solo muestra la vista previa.
         *
         * pointerEvents="none" evita que bloquee
         * los botones del overlay.
         */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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
        </View>

        <ScannerOverlay
          onCancel={handleCancel}
          onChangeZoom={handleChangeZoom}
          onToggleTorch={handleToggleTorch}
          zoomLabel={ZOOM_LABELS[zoomIndex]}
          torchEnabled={torchEnabled}
          showControls={showControls}
          showStatusBadges={showStatusBadges}
          badgeLabel="Scanner"
          processing={locked}
        />
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
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
    minHeight: 0,
    position: "relative",
    backgroundColor: "#000000",
  },

  camera: {
    flex: 1,
  },

  center: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  messageLight: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },

  permissionTitle: {
    marginTop: 14,
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  permissionMessage: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },

  primaryBtn: {
    width: "100%",
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  secondaryBtn: {
    width: "100%",
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },

  secondaryText: {
    color: "#374151",
    fontWeight: "700",
  },
});
