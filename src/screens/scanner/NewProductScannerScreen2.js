// screens/scanner/NewProductScannerScreen2.js

import React, {
  useCallback,
  useEffect,
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
  View
} from "react-native";
import { I18nText as Text } from "@/src/i18n";


import { SafeAreaView } from "react-native-safe-area-context";

import { CameraView, useCameraPermissions } from "expo-camera";

import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import QuickEan13Scanner from "@/src/components/features/scanner/QuickEan13Scanner";

import ScannerOverlay from "@/src/components/features/scanner/ScannerOverlay";

import { ROUTES } from "@/src/navigation/ROUTES";

import { buildHeaderConfig } from "@/src/utils/layout/headerStyles";

import { safeAlert, safeMenu } from "@/src/components/ui/alert/safeAlert";

import { useProductLookupWithCache } from "@/src/hooks/useProductLookupWithCache";
import { useScannedHistoryStorage } from "@/src/hooks/useScannedHistoryStorage";
import { normalizeBarcode } from "@/src/utils/barcodeNormalization";
import { storage } from "@/src/storage";
import {
  DEFAULT_PRODUCT_SEARCH_TYPE,
  PRODUCT_SEARCH_TYPES,
  normalizeProductSearchType,
} from "@/src/constants/productSearchTypes";
import {
  DEFAULT_SCANNER_ZOOM,
  SCANNER_ZOOM_VALUES,
  getNextScannerZoom,
  getScannerZoomIndex,
  getScannerZoomLabel,
  loadScannerZoom,
  saveScannerZoom,
} from "@/src/utils/scannerZoomStorage";

const DEFAULT_BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"];

const ALLOWED_BARCODE_TYPES = new Set(["ean13", "ean8", "upc_a", "upc_e"]);

function normalizeBarcodeTypes(value) {
  if (Array.isArray(value)) {
    const filtered = value.filter((type) => {
      return ALLOWED_BARCODE_TYPES.has(type);
    });

    return filtered.length > 0 ? filtered : DEFAULT_BARCODE_TYPES;
  }

  if (value && typeof value === "object") {
    const filtered = Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([type]) => type)
      .filter((type) => {
        return ALLOWED_BARCODE_TYPES.has(type);
      });

    return filtered.length > 0 ? filtered : DEFAULT_BARCODE_TYPES;
  }

  return DEFAULT_BARCODE_TYPES;
}

const SCANNER_PRODUCT_TYPE_STORAGE_KEY = "@shopping/scanner-product-type";

function ProductTypeSelector({ value, onChange }) {
  return (
    <View style={styles.productTypeSelector} pointerEvents="box-none">
      <Text style={styles.productTypeTitle}>¿Qué quieres buscar?</Text>
      <View style={styles.productTypeOptions}>
        {PRODUCT_SEARCH_TYPES.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Buscar en ${option.label}`}
              style={({ pressed }) => [
                styles.productTypeOption,
                selected && styles.productTypeOptionSelected,
                pressed && styles.productTypeOptionPressed,
              ]}
              onPress={() => onChange(option.value)}
            >
              <Ionicons
                name={option.icon}
                size={17}
                color={selected ? "#FFFFFF" : "#D6E4FF"}
              />
              <Text style={styles.productTypeOptionText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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

async function requestWebCameraAccess() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return { ok: false, blocked: true, reason: "unsupported" };
  }

  let stream = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });

    return { ok: true, blocked: false, reason: null };
  } catch (error) {
    const blocked =
      error?.name === "NotAllowedError" || error?.name === "SecurityError";

    return {
      ok: false,
      blocked,
      reason: error?.name || "camera-error",
    };
  } finally {
    stream?.getTracks?.().forEach((track) => track.stop());
  }
}

export default function NewProductScannerScreen2() {
  const navigation = useNavigation();
  const route = useRoute();

  const scannedRef = useRef(false);
  const handlingScanRef = useRef(false);

  const { lookupWithCache } = useProductLookupWithCache();
  const scanHistoryStorage = useScannedHistoryStorage();

  const {
    autoOpenEngine = false,

    barcodeTypes: routeBarcodeTypes = null,

    captureMode = null,

    manualBarcode = "",
    userHint = "",

    productType = DEFAULT_PRODUCT_SEARCH_TYPE,

    saveToHistory: routeSaveToHistory = null,

    listId = null,
    itemId = null,

    returnToTab = ROUTES.SHOPPING_TAB,

    returnToScreen = ROUTES.ITEM_DETAIL,

    showControls = true,

    initialZoomIndex = null,

    initialTorchEnabled = false,

    showStatusBadges = true,
  } = route.params || {};

  const routeInitialZoom =
    Number.isInteger(initialZoomIndex) &&
    initialZoomIndex >= 0 &&
    initialZoomIndex < SCANNER_ZOOM_VALUES.length
      ? SCANNER_ZOOM_VALUES[initialZoomIndex]
      : null;

  const safeInitialTorchEnabled = Boolean(initialTorchEnabled);

  const [locked, setLocked] = useState(false);

  const [zoom, setZoom] = useState(routeInitialZoom ?? DEFAULT_SCANNER_ZOOM);

  const [torchEnabled, setTorchEnabled] = useState(safeInitialTorchEnabled);

  const [scannerSession, setScannerSession] = useState(0);

  const [selectedProductType, setSelectedProductType] = useState(() =>
    normalizeProductSearchType(productType),
  );

  const [webCameraState, setWebCameraState] = useState(
    Platform.OS === "web" ? "checking" : "ready",
  );

  useEffect(() => {
    let active = true;

    async function restoreProductType() {
      try {
        const storedProductType = await storage.getString(
          SCANNER_PRODUCT_TYPE_STORAGE_KEY,
        );

        if (!active || !storedProductType) {
          return;
        }

        setSelectedProductType(
          normalizeProductSearchType(storedProductType, selectedProductType),
        );
      } catch (error) {
        console.warn(
          "[NewProductScannerScreen2] product type restore error",
          error,
        );
      }
    }

    restoreProductType();

    return () => {
      active = false;
    };
  }, []);

  const handleProductTypeChange = useCallback(async (nextProductType) => {
    const normalizedProductType = normalizeProductSearchType(nextProductType);

    setSelectedProductType(normalizedProductType);

    try {
      await storage.setString(
        SCANNER_PRODUCT_TYPE_STORAGE_KEY,
        normalizedProductType,
      );
    } catch (error) {
      console.warn(
        "[NewProductScannerScreen2] product type persist error",
        error,
      );
    }
  }, []);

  const isQuickEan13Input = captureMode === "ean13-input";
  const isManualBarcodeInput = __DEV__ && captureMode === "manual-barcode";

  const barcodeTypes = useMemo(() => {
    return normalizeBarcodeTypes(routeBarcodeTypes);
  }, [routeBarcodeTypes]);

  const headerConfig = useMemo(() => {
    return buildHeaderConfig({
      title: "Escanear producto",
      preset: "light",
    });
  }, []);

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
      setTorchEnabled(safeInitialTorchEnabled);
      setScannerSession((previous) => previous + 1);

      let active = true;

      async function restoreZoom() {
        const storedZoom = routeInitialZoom ?? (await loadScannerZoom());

        if (active) {
          setZoom(storedZoom);
        }
      }

      restoreZoom();

      return () => {
        active = false;
        scannedRef.current = false;

        handlingScanRef.current = false;

        setLocked(false);

        setTorchEnabled(false);
      };
    }, [safeInitialTorchEnabled, routeInitialZoom]),
  );

  function resetScannerForNextScan() {
    scannedRef.current = false;

    handlingScanRef.current = false;

    setLocked(false);

    setTorchEnabled(false);

    setScannerSession((previous) => previous + 1);
  }

  function handleCancel() {
    scannedRef.current = true;

    handlingScanRef.current = true;

    setLocked(true);

    setTorchEnabled(false);

    if (navigation.canGoBack()) {
      navigation.goBack();

      return;
    }

    resetScannerForNextScan();
  }

  async function handleChangeZoom() {
    const nextZoom = getNextScannerZoom(zoom);
    setZoom(nextZoom);
    await saveScannerZoom(nextZoom);
  }

  function handleToggleTorch() {
    setTorchEnabled((previous) => !previous);
  }

  useEffect(() => {
    if (Platform.OS !== "web" || isManualBarcodeInput) return;

    let active = true;

    async function prepareWebCamera() {
      setWebCameraState("checking");
      const result = await requestWebCameraAccess();

      if (!active) return;
      setWebCameraState(
        result.ok ? "ready" : result.blocked ? "blocked" : "error",
      );
    }

    prepareWebCamera();

    return () => {
      active = false;
    };
  }, [scannerSession, isManualBarcodeInput]);

  async function retryWebCamera() {
    setWebCameraState("checking");
    const result = await requestWebCameraAccess();
    setWebCameraState(
      result.ok ? "ready" : result.blocked ? "blocked" : "error",
    );
  }

  useEffect(() => {
    if (!isManualBarcodeInput) return;

    const barcode = normalizeBarcode(manualBarcode);

    if (barcode.length < 8 || barcode.length > 14) {
      safeAlert(
        "Código no válido",
        "Introduce un código de entre 8 y 14 dígitos.",
        [{ key: "close", text: "Volver", onPress: handleCancel }],
      );
      return;
    }

    if (scannedRef.current || handlingScanRef.current) return;

    scannedRef.current = true;
    handlingScanRef.current = true;
    processDetectedBarcode(barcode, true);
  }, [isManualBarcodeInput, manualBarcode]);

  function handleQuickEan13Detected(code) {
    if (scannedRef.current || handlingScanRef.current) {
      return;
    }

    const barcode = normalizeBarcode(code);

    if (barcode.length !== 13) {
      return;
    }

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
        productType: selectedProductType,
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

      resetScannerForNextScan();

      safeAlert(
        "Error de navegación",
        "Se detectó el código, pero no se pudo regresar al producto.",
      );
    }
  }

  if (isQuickEan13Input) {
    return (
      <View style={styles.screen}>
        <StatusBar
          style="light"
          backgroundColor="#000000"
          translucent={false}
        />

        <QuickEan13Scanner
          key={`quick-ean13-session-${scannerSession}`}
          onDetected={handleQuickEan13Detected}
          onCancel={handleCancel}
          initialZoomIndex={getScannerZoomIndex(zoom)}
          initialTorchEnabled={torchEnabled}
          zoom={zoom}
          zoomLabel={getScannerZoomLabel(zoom)}
          torchEnabled={torchEnabled}
          onChangeZoom={handleChangeZoom}
          onToggleTorch={handleToggleTorch}
          showControls={showControls}
          showStatusBadges={showStatusBadges}
        />
      </View>
    );
  }

  async function getDetectedBarcodeProduct(
    code,
    { saveToHistory = false } = {},
  ) {
    const barcode = normalizeBarcode(code);

    if (!barcode) {
      return null;
    }

    const now = new Date().toISOString();

    const cachedItem =
      await scanHistoryStorage.getScannedEntryByBarcode(barcode);

    const hasUsefulCachedData =
      cachedItem?.name?.trim() || cachedItem?.imageUrl?.trim();

    if (hasUsefulCachedData) {
      const updatedItem = {
        ...cachedItem,

        barcode,

        source: cachedItem.source || "scanner",

        productType: selectedProductType,

        updatedAt: now,
      };

      if (saveToHistory) {
        await scanHistoryStorage.saveScannedEntry(barcode, updatedItem);
      }

      return updatedItem;
    }

    const lookup = await lookupWithCache(barcode, {
      productType: selectedProductType,
    });

    const product = lookup?.product || null;

    const scannedItem = {
      id: barcode,
      barcode,

      name: product?.name || cachedItem?.name || "",

      productType: selectedProductType,

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
      await scanHistoryStorage.saveScannedEntry(barcode, scannedItem);
    }

    return scannedItem;
  }

  async function processDetectedBarcode(barcode, saveToHistory) {
    try {
      setLocked(true);

      setTorchEnabled(false);

      const scannedItem = await getDetectedBarcodeProduct(barcode, {
        saveToHistory,
      });

      navigation.replace(ROUTES.EDIT_SCANNED_ITEM, {
        barcode,

        product: scannedItem,
        item: scannedItem,

        productType: selectedProductType,

        autoOpenEngine,
        userHint,
      });
    } catch (error) {
      console.log("Error handling new product scan:", error);

      resetScannerForNextScan();

      safeAlert("Error", "No se pudo procesar el producto escaneado", [
        {
          key: "close",
          text: "Cerrar",
          style: "cancel",
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

    if (typeof routeSaveToHistory === "boolean") {
      processDetectedBarcode(barcode, routeSaveToHistory);
      return;
    }

    safeMenu(
      "Producto detectado",
      `Código: ${barcode}\n\n¿Quieres añadir este producto al historial de escaneos?`,
      [
        {
          key: "skip",
          text: "No añadir",
          style: "cancel",
          onPress: () => {
            processDetectedBarcode(barcode, false);
          },
        },
        {
          key: "add",
          text: "Añadir",
          style: "default",
          onPress: () => {
            processDetectedBarcode(barcode, true);
          },
        },
        {
          key: "scan-again",
          text: "Escanear otro",
          style: "default",
          onPress: resetScannerForNextScan,
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

    resetScannerForNextScan();

    safeAlert(
      "No se pudo iniciar la cámara",

      "Comprueba que el navegador o la aplicación tienen permiso para utilizar la cámara.",

      [
        {
          key: "close",

          text: "Cerrar",

          style: "cancel",

          onPress: handleCancel,
        },
      ],
    );
  }

  if (isManualBarcodeInput) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <StatusBar {...headerConfig.statusBar} />
        <View style={styles.center}>
          <ActivityIndicator color="#7C3AED" />
          <Text style={styles.permissionTitle}>Procesando código</Text>
          <Text style={styles.permissionMessage}>
            {normalizeBarcode(manualBarcode)}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS === "web") {
    if (webCameraState !== "ready") {
      const blocked = webCameraState === "blocked";
      const checking = webCameraState === "checking";

      return (
        <SafeAreaView style={styles.webPermissionContainer}>
          <StatusBar
            style="light"
            backgroundColor="#07111F"
            translucent={false}
          />
          <View style={styles.center}>
            {checking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="warning-outline" size={52} color="#FBBF24" />
            )}

            <Text style={styles.webPermissionTitle}>
              {checking
                ? "Comprobando la cámara..."
                : blocked
                  ? "No se pudo abrir la cámara"
                  : "Cámara no disponible"}
            </Text>

            {!checking ? (
              <Text style={styles.webPermissionMessage}>
                {blocked
                  ? "El navegador ha bloqueado la cámara. Activa el permiso de cámara para este sitio y vuelve a intentarlo."
                  : "No ha sido posible acceder a la cámara de este dispositivo."}
              </Text>
            ) : null}

            {!checking ? (
              <>
                <Pressable style={styles.webRetryBtn} onPress={retryWebCamera}>
                  <Text style={styles.webRetryText}>Reintentar</Text>
                </Pressable>
                <Pressable style={styles.webCancelBtn} onPress={handleCancel}>
                  <Text style={styles.webCancelText}>Cancelar</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.screen}>
        <StatusBar
          style="light"
          backgroundColor="#000000"
          translucent={false}
        />

        <QuickEan13Scanner
          key={`web-scanner-session-${scannerSession}`}
          onDetected={handleWebDetected}
          onCancel={handleCancel}
          initialZoomIndex={getScannerZoomIndex(zoom)}
          initialTorchEnabled={torchEnabled}
          zoom={zoom}
          zoomLabel={getScannerZoomLabel(zoom)}
          torchEnabled={torchEnabled}
          onChangeZoom={handleChangeZoom}
          onToggleTorch={handleToggleTorch}
          showControls={showControls}
          showStatusBadges={showStatusBadges}
        />

        <ProductTypeSelector
          value={selectedProductType}
          onChange={handleProductTypeChange}
        />
      </View>
    );
  }

  return (
    <NativeProductScannerCamera
      barcodeTypes={barcodeTypes}
      scannerSession={scannerSession}
      locked={locked}
      zoom={zoom}
      torchEnabled={torchEnabled}
      showControls={showControls}
      productType={selectedProductType}
      onChangeProductType={handleProductTypeChange}
      headerConfig={headerConfig}
      handleCancel={handleCancel}
      handleChangeZoom={handleChangeZoom}
      handleToggleTorch={handleToggleTorch}
      handleCameraMountError={handleCameraMountError}
      handleNativeBarcodeScanned={handleNativeBarcodeScanned}
    />
  );
}

function NativeProductScannerCamera({
  barcodeTypes,
  scannerSession,
  locked,
  zoom,
  torchEnabled,
  showControls,
  productType,
  onChangeProductType,
  headerConfig,
  handleCancel,
  handleChangeZoom,
  handleToggleTorch,
  handleCameraMountError,
  handleNativeBarcodeScanned,
}) {
  const [permission, requestPermission] = useCameraPermissions();

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

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar style="light" backgroundColor="#000000" translucent={false} />

      <View style={styles.cameraWrap}>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <CameraView
            key={`native-camera-session-${scannerSession}`}
            style={styles.camera}
            facing="back"
            autofocus="on"
            zoom={zoom}
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
          zoomLabel={getScannerZoomLabel(zoom)}
          torchEnabled={torchEnabled}
          zoomAvailable
          torchAvailable
          showControls={showControls}
          processing={locked}
          hint="Apunta al código de barras"
          title="Leer código de barras"
          subtitle="El número se procesará automáticamente cuando sea detectado."
        />

        <ProductTypeSelector
          value={productType}
          onChange={onChangeProductType}
        />
      </View>
    </SafeAreaView>
  );
}

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

  webPermissionContainer: {
    flex: 1,
    backgroundColor: "#07111F",
  },

  webPermissionTitle: {
    marginTop: 24,
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },

  webPermissionMessage: {
    marginTop: 14,
    maxWidth: 520,
    color: "#CBD5E1",
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
  },

  webRetryBtn: {
    width: "100%",
    maxWidth: 420,
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#239B63",
  },

  webRetryText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  webCancelBtn: {
    width: "100%",
    maxWidth: 420,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#293444",
  },

  webCancelText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  productTypeSelector: {
    position: "absolute",
    top: 16,
    left: 12,
    right: 12,
    zIndex: 30,

    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(7, 17, 31, 0.88)",
  },

  productTypeTitle: {
    marginBottom: 8,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  productTypeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
  },

  productTypeOption: {
    minHeight: 38,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,

    paddingHorizontal: 11,
    paddingVertical: 8,

    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#54709A",
    backgroundColor: "#24344C",
  },

  productTypeOptionSelected: {
    borderColor: "#60A5FA",
    backgroundColor: "#2563EB",
  },

  productTypeOptionPressed: {
    opacity: 0.82,
  },

  productTypeOptionText: {
    color: "#FFFFFF",

    fontSize: 12,
    fontWeight: "800",
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
