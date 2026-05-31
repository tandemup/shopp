// components/features/scanner/UnifiedBarcodeScanner.web.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const DEFAULT_BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"];

const FORMAT_MAP = {
  aztec: Html5QrcodeSupportedFormats.AZTEC,
  codabar: Html5QrcodeSupportedFormats.CODABAR,
  code39: Html5QrcodeSupportedFormats.CODE_39,
  code93: Html5QrcodeSupportedFormats.CODE_93,
  code128: Html5QrcodeSupportedFormats.CODE_128,
  datamatrix: Html5QrcodeSupportedFormats.DATA_MATRIX,
  ean8: Html5QrcodeSupportedFormats.EAN_8,
  ean13: Html5QrcodeSupportedFormats.EAN_13,
  itf14: Html5QrcodeSupportedFormats.ITF,
  pdf417: Html5QrcodeSupportedFormats.PDF_417,
  qr: Html5QrcodeSupportedFormats.QR_CODE,
  upc_a: Html5QrcodeSupportedFormats.UPC_A,
  upc_e: Html5QrcodeSupportedFormats.UPC_E,
};

function getFormatsToSupport(barcodeTypes) {
  const source =
    Array.isArray(barcodeTypes) && barcodeTypes.length > 0
      ? barcodeTypes
      : DEFAULT_BARCODE_TYPES;

  const formats = source
    .map((type) => FORMAT_MAP[type])
    .filter((format) => format !== undefined);

  return formats.length > 0
    ? formats
    : DEFAULT_BARCODE_TYPES.map((type) => FORMAT_MAP[type]);
}

function getScanBox(viewfinderWidth, viewfinderHeight) {
  return {
    width: Math.floor(viewfinderWidth * 0.88),
    height: Math.max(90, Math.floor(viewfinderHeight * 0.22)),
  };
}

function getErrorMessage(error) {
  const text = String(error?.message || error || "");

  if (text.includes("NotAllowedError")) {
    return "No se ha permitido el acceso a la cámara. Revisa los permisos del navegador.";
  }

  if (text.includes("NotFoundError")) {
    return "No se ha encontrado una cámara compatible.";
  }

  if (text.includes("NotReadableError")) {
    return "La cámara está siendo utilizada por otra aplicación o pestaña.";
  }

  if (text.includes("OverconstrainedError")) {
    return "No se ha podido seleccionar la cámara trasera.";
  }

  return "No se pudo iniciar el lector de códigos de barras.";
}

export default function UnifiedBarcodeScanner({
  onDetected,
  onCancel,
  onStartScanning,
  onStopScanning,

  active = true,
  mode = "manual",

  barcodeTypes = DEFAULT_BARCODE_TYPES,

  showControls = true,
  showHint = true,
  hintText = "Apunta al código de barras",

  statusMessage = "",
  statusColor = "#2563eb",

  continuous = false,
  scanCooldownMs = 1200,
}) {
  const isFocused = useIsFocused();

  const readerIdRef = useRef(
    `shopp-barcode-reader-${Math.random().toString(36).slice(2)}`,
  );

  const scannerRef = useRef(null);
  const scannerStartedRef = useRef(false);
  const scannerStartingRef = useRef(false);

  const lockRef = useRef(false);
  const unlockTimerRef = useRef(null);

  const [scanningEnabled, setScanningEnabled] = useState(mode === "auto");
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const [zoomCapability, setZoomCapability] = useState(null);
  const [zoomValue, setZoomValue] = useState(null);

  const formatsToSupport = useMemo(
    () => getFormatsToSupport(barcodeTypes),
    [barcodeTypes],
  );

  const formatsKey = formatsToSupport.join(",");

  const cameraShouldRun = active && isFocused && scanningEnabled;

  const clearUnlockTimer = useCallback(() => {
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, []);

  const unlockScanner = useCallback(() => {
    lockRef.current = false;
    clearUnlockTimer();
  }, [clearUnlockTimer]);

  const scheduleUnlock = useCallback(() => {
    if (!continuous || mode !== "auto") return;

    clearUnlockTimer();

    unlockTimerRef.current = setTimeout(() => {
      lockRef.current = false;
      unlockTimerRef.current = null;
    }, scanCooldownMs);
  }, [clearUnlockTimer, continuous, mode, scanCooldownMs]);

  const stopScanner = useCallback(async () => {
    clearUnlockTimer();

    const scanner = scannerRef.current;

    scannerRef.current = null;
    scannerStartedRef.current = false;
    scannerStartingRef.current = false;

    setStarting(false);
    setTorchEnabled(false);
    setTorchSupported(false);
    setZoomCapability(null);
    setZoomValue(null);

    if (!scanner) return;

    try {
      await scanner.stop();
    } catch (error) {
      // Puede ocurrir si la cámara todavía no había terminado de arrancar.
    }

    try {
      scanner.clear();
    } catch (error) {
      // La limpieza es defensiva: no bloqueamos la navegación.
    }
  }, [clearUnlockTimer]);

  const inspectCameraCapabilities = useCallback((scanner) => {
    try {
      const capabilities = scanner.getRunningTrackCapabilities();

      setTorchSupported(capabilities?.torch === true);

      const zoom = capabilities?.zoom;

      if (
        zoom &&
        typeof zoom.min === "number" &&
        typeof zoom.max === "number"
      ) {
        setZoomCapability({
          min: zoom.min,
          max: zoom.max,
          step:
            typeof zoom.step === "number" && zoom.step > 0 ? zoom.step : 0.1,
        });

        setZoomValue(zoom.min);
      }
    } catch (error) {
      setTorchSupported(false);
      setZoomCapability(null);
      setZoomValue(null);
    }
  }, []);

  const handleSuccessfulRead = useCallback(
    (decodedText, decodedResult) => {
      if (!decodedText) return;
      if (lockRef.current) return;

      lockRef.current = true;

      const type =
        decodedResult?.result?.format?.formatName ||
        decodedResult?.result?.format ||
        "unknown";

      onDetected?.({
        data: String(decodedText),
        type: String(type),
      });

      scheduleUnlock();
    },
    [onDetected, scheduleUnlock],
  );

  useEffect(() => {
    let disposed = false;

    async function startScanner() {
      if (!cameraShouldRun) return;
      if (scannerRef.current) return;
      if (scannerStartingRef.current) return;

      scannerStartingRef.current = true;

      setStarting(true);
      setErrorMessage("");

      const scanner = new Html5Qrcode(readerIdRef.current, {
        formatsToSupport,
        useBarCodeDetectorIfSupported: false,
        verbose: false,
      });

      scannerRef.current = scanner;

      try {
        await scanner.start(
          {
            facingMode: "environment",
          },
          {
            fps: 12,
            qrbox: getScanBox,
            aspectRatio: 1.777778,
            disableFlip: true,
          },
          handleSuccessfulRead,
          () => {
            // No mostramos errores durante cada fotograma sin coincidencias.
          },
        );

        if (disposed) {
          await stopScanner();
          return;
        }

        scannerStartedRef.current = true;
        inspectCameraCapabilities(scanner);
      } catch (error) {
        console.log("Error starting web barcode scanner:", error);

        if (!disposed) {
          setErrorMessage(getErrorMessage(error));
        }

        await stopScanner();
      } finally {
        scannerStartingRef.current = false;

        if (!disposed) {
          setStarting(false);
        }
      }
    }

    startScanner();

    return () => {
      disposed = true;
      stopScanner();
    };
  }, [
    cameraShouldRun,
    formatsKey,
    formatsToSupport,
    handleSuccessfulRead,
    inspectCameraCapabilities,
    stopScanner,
  ]);

  useEffect(() => {
    if (!active || !isFocused) {
      unlockScanner();
      setScanningEnabled(mode === "auto");
    }
  }, [active, isFocused, mode, unlockScanner]);

  useEffect(() => {
    if (mode === "auto" && active && isFocused) {
      unlockScanner();
      setScanningEnabled(true);
    }

    if (mode === "manual") {
      setScanningEnabled(false);
    }
  }, [mode, active, isFocused, unlockScanner]);

  useEffect(() => {
    return () => {
      clearUnlockTimer();
    };
  }, [clearUnlockTimer]);

  function startScanning() {
    unlockScanner();
    setErrorMessage("");
    setScanningEnabled(true);
    onStartScanning?.();
  }

  async function stopScanning() {
    unlockScanner();
    setScanningEnabled(false);
    await stopScanner();
    onStopScanning?.();
  }

  async function toggleTorch() {
    const scanner = scannerRef.current;

    if (!scanner || !torchSupported) return;

    const nextValue = !torchEnabled;

    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextValue }],
      });

      setTorchEnabled(nextValue);
    } catch (error) {
      console.log("Torch is not available in this browser:", error);
      setTorchSupported(false);
      setTorchEnabled(false);
    }
  }

  async function changeZoom() {
    const scanner = scannerRef.current;

    if (!scanner || !zoomCapability) return;

    const { min, max, step } = zoomCapability;

    const nextValue =
      zoomValue == null || zoomValue + step > max ? min : zoomValue + step;

    try {
      await scanner.applyVideoConstraints({
        advanced: [{ zoom: nextValue }],
      });

      setZoomValue(nextValue);
    } catch (error) {
      console.log("Zoom is not available in this browser:", error);
      setZoomCapability(null);
      setZoomValue(null);
    }
  }

  async function handleCancel() {
    unlockScanner();
    await stopScanner();
    onCancel?.();
  }

  return (
    <View style={styles.container}>
      <View nativeID={readerIdRef.current} style={styles.reader} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable style={styles.closeButton} onPress={handleCancel}>
            <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.middle} pointerEvents="none">
          <View style={styles.scanFrame}>
            <View style={styles.scanLine} />
          </View>

          {showHint ? <Text style={styles.hintText}>{hintText}</Text> : null}
        </View>

        <View style={styles.bottomPanel}>
          {starting ? (
            <Text style={styles.message}>Iniciando cámara...</Text>
          ) : null}

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          {statusMessage ? (
            <Text style={[styles.statusText, { backgroundColor: statusColor }]}>
              {statusMessage}
            </Text>
          ) : null}

          {showControls ? (
            <View style={styles.actionsRow}>
              {torchSupported ? (
                <Pressable
                  style={[
                    styles.actionButton,
                    torchEnabled && styles.actionButtonActive,
                  ]}
                  onPress={toggleTorch}
                >
                  <MaterialCommunityIcons
                    name={torchEnabled ? "flashlight" : "flashlight-off"}
                    size={22}
                    color="#FFFFFF"
                  />

                  <Text style={styles.actionText}>
                    {torchEnabled ? "Luz ON" : "Linterna"}
                  </Text>
                </Pressable>
              ) : null}

              {zoomCapability ? (
                <Pressable style={styles.actionButton} onPress={changeZoom}>
                  <MaterialCommunityIcons
                    name="magnify-plus"
                    size={22}
                    color="#FFFFFF"
                  />

                  <Text style={styles.actionText}>
                    {zoomValue == null ? "Zoom" : `${zoomValue.toFixed(1)}x`}
                  </Text>
                </Pressable>
              ) : null}

              {mode === "manual" ? (
                <Pressable
                  style={[
                    styles.actionButton,
                    scanningEnabled && styles.actionButtonActive,
                  ]}
                  onPress={scanningEnabled ? stopScanning : startScanning}
                >
                  <MaterialCommunityIcons
                    name="barcode-scan"
                    size={22}
                    color="#FFFFFF"
                  />

                  <Text style={styles.actionText}>
                    {scanningEnabled ? "Detener" : "Escanear"}
                  </Text>
                </Pressable>
              ) : (
                <View style={[styles.actionButton, styles.actionButtonActive]}>
                  <MaterialCommunityIcons
                    name="barcode-scan"
                    size={22}
                    color="#FFFFFF"
                  />

                  <Text style={styles.actionText}>Activo</Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
    overflow: "hidden",
  },

  reader: {
    flex: 1,
    width: "100%",
    backgroundColor: "#000000",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },

  topBar: {
    paddingTop: 18,
    paddingHorizontal: 18,
    alignItems: "flex-end",
  },

  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },

  middle: {
    alignItems: "center",
    justifyContent: "center",
  },

  scanFrame: {
    width: "88%",
    height: 130,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
  },

  scanLine: {
    height: 2,
    marginHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  hintText: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.72)",
  },

  message: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 10,
  },

  errorText: {
    color: "#FCA5A5",
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 10,
  },

  statusText: {
    alignSelf: "center",
    color: "#FFFFFF",
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 10,
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
  },

  actionButton: {
    minHeight: 48,
    minWidth: 108,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  actionButtonActive: {
    backgroundColor: "rgba(22,163,74,0.95)",
  },

  actionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
