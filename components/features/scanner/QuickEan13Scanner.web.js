import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useIsFocused } from "@react-navigation/native";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import ScannerOverlay from "./ScannerOverlay.js";

const ZOOM_LEVELS = [1, 1.2, 1.5, 2];

const DEFAULT_ZOOM_INDEX = 1;

const DUPLICATE_LOCK_MS = 1500;

const CAMERA_GRANTED_STORAGE_KEY = "shopp:web-camera-access-granted";

const CAMERA_CONSTRAINTS = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

function rememberCameraAccess() {
  try {
    window.localStorage.setItem(CAMERA_GRANTED_STORAGE_KEY, "true");
  } catch {}
}

function forgetRememberedCameraAccess() {
  try {
    window.localStorage.removeItem(CAMERA_GRANTED_STORAGE_KEY);
  } catch {}
}

function normalizeBarcode(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidEan13(value) {
  const barcode = normalizeBarcode(value);

  if (!/^\d{13}$/.test(barcode)) return false;

  const digits = barcode.split("").map(Number);
  const expectedCheckDigit = digits[12];

  const weightedSum = digits.slice(0, 12).reduce((total, digit, index) => {
    return total + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);

  const calculatedCheckDigit = (10 - (weightedSum % 10)) % 10;

  return calculatedCheckDigit === expectedCheckDigit;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getReadableCameraError(error) {
  const message = String(error?.message ?? error ?? "");

  if (error?.name === "NotFoundError") {
    return "No se ha encontrado ninguna cámara compatible.";
  }

  if (error?.name === "NotAllowedError") {
    return "El navegador ha bloqueado la cámara. Activa el permiso desde los ajustes del sitio.";
  }

  if (error?.name === "NotReadableError") {
    return "La cámara está siendo utilizada por otra aplicación o pestaña.";
  }

  if (error?.name === "OverconstrainedError") {
    return "La cámara no admite la configuración solicitada.";
  }

  if (error?.name === "SecurityError") {
    return "El navegador no permite usar la cámara. Comprueba que estás usando HTTPS.";
  }

  return message || "No ha sido posible iniciar la cámara.";
}

function waitForScannerElement(elementId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 45;

    const check = () => {
      const element = document.getElementById(elementId);

      if (element) {
        resolve(element);
        return;
      }

      attempts += 1;

      if (attempts >= maxAttempts) {
        reject(new Error(`HTML Element with id=${elementId} not found`));
        return;
      }

      window.requestAnimationFrame(check);
    };

    check();
  });
}

export default function QuickEan13ScannerWeb({
  onDetected,
  onBarcodeScanned,
  onCancel,

  initialZoomIndex = DEFAULT_ZOOM_INDEX,
  initialTorchEnabled = false,

  showControls = true,
}) {
  const isFocused = useIsFocused();

  const scannerElementIdRef = useRef(
    `quick-ean13-scanner-${Math.random().toString(36).slice(2)}`,
  );

  const scannerElementId = scannerElementIdRef.current;

  const scannerRef = useRef(null);
  const mountedRef = useRef(false);
  const focusedRef = useRef(false);
  const runningRef = useRef(false);
  const startingRef = useRef(false);

  const currentZoomRef = useRef(
    ZOOM_LEVELS[clamp(initialZoomIndex, 0, ZOOM_LEVELS.length - 1)] ?? 1.2,
  );

  const lastDetectedRef = useRef({
    barcode: "",
    timestamp: 0,
  });

  const [cameraStarting, setCameraStarting] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [zoomIndex, setZoomIndex] = useState(
    clamp(initialZoomIndex, 0, ZOOM_LEVELS.length - 1),
  );

  const [zoomSupported, setZoomSupported] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(
    initialTorchEnabled === true,
  );

  const currentZoom = ZOOM_LEVELS[zoomIndex] ?? 1.2;

  useEffect(() => {
    currentZoomRef.current = currentZoom;
  }, [currentZoom]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const styleElement = document.createElement("style");

    styleElement.textContent = `
      #${scannerElementId},
      #${scannerElementId} video,
      #${scannerElementId} canvas {
        width: 100% !important;
        height: 100% !important;
      }

      #${scannerElementId} {
        position: absolute !important;
        inset: 0 !important;
        overflow: hidden !important;
        background: #000000 !important;
      }

      #${scannerElementId} > div {
        width: 100% !important;
        height: 100% !important;
      }

      #${scannerElementId} img,
      #${scannerElementId} button,
      #${scannerElementId} select,
      #${scannerElementId}__dashboard,
      #${scannerElementId}__dashboard_section,
      #${scannerElementId}__dashboard_section_csr,
      #${scannerElementId}__header_message,
      #${scannerElementId}__camera_selection,
      #${scannerElementId}__scan_region {
        display: none !important;
      }

      #${scannerElementId} .qr-shaded-region {
        display: none !important;
        opacity: 0 !important;
        background: transparent !important;
      }

      #${scannerElementId} video {
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }

      #${scannerElementId} canvas {
        display: none !important;
      }
    `;

    document.head.appendChild(styleElement);

    return () => {
      styleElement.remove();
    };
  }, [scannerElementId]);

  const getScannerCapabilities = useCallback(() => {
    if (!runningRef.current || !scannerRef.current) return {};

    try {
      return scannerRef.current.getRunningTrackCapabilities?.() || {};
    } catch {
      return {};
    }
  }, []);

  const stopCamera = useCallback(async () => {
    startingRef.current = false;

    const scanner = scannerRef.current;

    if (!scanner) {
      if (mountedRef.current) {
        setTorchEnabled(false);
        setTorchSupported(false);
        setZoomSupported(false);
      }

      return;
    }

    if (runningRef.current) {
      try {
        await scanner.stop();
      } catch (error) {
        console.warn("No se pudo detener el lector web:", error);
      }
    }

    runningRef.current = false;

    try {
      scanner.clear();
    } catch (error) {
      console.warn("No se pudo limpiar el lector web:", error);
    }

    scannerRef.current = null;

    if (mountedRef.current) {
      setTorchEnabled(false);
      setTorchSupported(false);
      setZoomSupported(false);
    }
  }, []);

  const notifyDetectedBarcode = useCallback(
    async (decodedText) => {
      const barcode = normalizeBarcode(decodedText);

      if (!isValidEan13(barcode)) return;

      const now = Date.now();
      const previousDetection = lastDetectedRef.current;

      if (
        previousDetection.barcode === barcode &&
        now - previousDetection.timestamp < DUPLICATE_LOCK_MS
      ) {
        return;
      }

      lastDetectedRef.current = {
        barcode,
        timestamp: now,
      };

      if (runningRef.current && scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (error) {
          console.warn("No se pudo detener el lector tras detectar:", error);
        }

        runningRef.current = false;
      }

      if (!mountedRef.current || !focusedRef.current) return;

      const result = {
        type: "ean13",
        data: barcode,
        rawValue: barcode,
      };

      if (typeof onDetected === "function") {
        onDetected(barcode);
        return;
      }

      onBarcodeScanned?.(result);
    },
    [onBarcodeScanned, onDetected],
  );

  const configureCameraCapabilities = useCallback(async () => {
    const capabilities = getScannerCapabilities();

    const supportsZoom =
      capabilities?.zoom &&
      Number.isFinite(capabilities.zoom.min) &&
      Number.isFinite(capabilities.zoom.max);

    const supportsTorch = Boolean(capabilities?.torch);

    if (!mountedRef.current || !focusedRef.current) return;

    setZoomSupported(Boolean(supportsZoom));
    setTorchSupported(supportsTorch);

    if (supportsZoom) {
      const desiredZoom = clamp(
        currentZoomRef.current,
        capabilities.zoom.min,
        capabilities.zoom.max,
      );

      try {
        await scannerRef.current?.applyVideoConstraints?.({
          advanced: [{ zoom: desiredZoom }],
        });
      } catch (error) {
        console.warn("No se pudo aplicar el zoom inicial:", error);
        setZoomSupported(false);
      }
    }

    if (supportsTorch && initialTorchEnabled) {
      try {
        await scannerRef.current?.applyVideoConstraints?.({
          advanced: [{ torch: true }],
        });

        setTorchEnabled(true);
      } catch (error) {
        console.warn("No se pudo activar la linterna inicialmente:", error);
        setTorchSupported(false);
        setTorchEnabled(false);
      }
    }
  }, [getScannerCapabilities, initialTorchEnabled]);

  const startCamera = useCallback(async () => {
    if (!mountedRef.current || !focusedRef.current) return;
    if (startingRef.current || runningRef.current) return;

    if (
      typeof navigator === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      setErrorMessage(
        "Este navegador no permite utilizar la cámara. Abre Shopp mediante HTTPS con un navegador compatible.",
      );
      return;
    }

    startingRef.current = true;

    setCameraStarting(true);
    setScannerVisible(true);
    setErrorMessage("");

    try {
      await waitForScannerElement(scannerElementId);

      if (!mountedRef.current || !focusedRef.current) return;

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
          verbose: false,
        });
      }

      await scannerRef.current.start(
        CAMERA_CONSTRAINTS,
        {
          fps: 18,
          disableFlip: true,
          aspectRatio: 1.7777778,

          /*
           * Mejora clave:
           * html5-qrcode deja de analizar toda la pantalla
           * y procesa una franja central parecida al overlay.
           */
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.floor(viewfinderWidth * 0.84);
            const height = Math.floor(viewfinderHeight * 0.22);

            return {
              width,
              height,
            };
          },

          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        },
        notifyDetectedBarcode,
        () => {},
      );

      if (!mountedRef.current || !focusedRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch {}

        scannerRef.current = null;
        runningRef.current = false;
        return;
      }

      runningRef.current = true;
      rememberCameraAccess();

      await configureCameraCapabilities();
    } catch (error) {
      console.warn("No se pudo iniciar el lector web:", error);

      runningRef.current = false;

      try {
        scannerRef.current?.clear?.();
      } catch {}

      scannerRef.current = null;

      if (error?.name === "NotAllowedError") {
        forgetRememberedCameraAccess();
      }

      if (mountedRef.current) {
        setScannerVisible(false);
        setErrorMessage(getReadableCameraError(error));
      }
    } finally {
      startingRef.current = false;

      if (mountedRef.current) {
        setCameraStarting(false);
      }
    }
  }, [configureCameraCapabilities, notifyDetectedBarcode, scannerElementId]);

  const applyZoomIndex = useCallback(
    async (nextZoomIndex) => {
      const normalizedIndex = clamp(nextZoomIndex, 0, ZOOM_LEVELS.length - 1);
      const selectedZoom = ZOOM_LEVELS[normalizedIndex] ?? 1.2;

      setZoomIndex(normalizedIndex);
      currentZoomRef.current = selectedZoom;

      if (!zoomSupported) return;

      const capabilities = getScannerCapabilities();

      const zoomMinimum = capabilities?.zoom?.min ?? 1;
      const zoomMaximum = capabilities?.zoom?.max ?? selectedZoom;

      const constrainedZoom = clamp(selectedZoom, zoomMinimum, zoomMaximum);

      try {
        await scannerRef.current?.applyVideoConstraints?.({
          advanced: [{ zoom: constrainedZoom }],
        });
      } catch (error) {
        console.warn("No se pudo modificar el zoom:", error);
        setZoomSupported(false);
      }
    },
    [getScannerCapabilities, zoomSupported],
  );

  const cycleZoom = useCallback(() => {
    const nextZoomIndex =
      zoomIndex >= ZOOM_LEVELS.length - 1 ? 0 : zoomIndex + 1;

    applyZoomIndex(nextZoomIndex);
  }, [applyZoomIndex, zoomIndex]);

  const toggleTorch = useCallback(async () => {
    if (!torchSupported) return;

    const nextTorchEnabled = !torchEnabled;

    try {
      await scannerRef.current?.applyVideoConstraints?.({
        advanced: [{ torch: nextTorchEnabled }],
      });

      setTorchEnabled(nextTorchEnabled);
    } catch (error) {
      console.warn("No se pudo modificar la linterna:", error);
      setTorchSupported(false);
      setTorchEnabled(false);
    }
  }, [torchEnabled, torchSupported]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      focusedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    focusedRef.current = isFocused;

    if (!isFocused) {
      stopCamera();
      return;
    }

    window.setTimeout(() => {
      if (
        mountedRef.current &&
        focusedRef.current &&
        !startingRef.current &&
        !runningRef.current
      ) {
        startCamera();
      }
    }, 120);
  }, [isFocused, startCamera, stopCamera]);

  if (!scannerVisible && errorMessage) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionIcon}>⚠️</Text>

        <Text style={styles.centeredTitle}>No se pudo abrir la cámara</Text>

        <Text style={styles.centeredText}>{errorMessage}</Text>

        <Pressable
          disabled={cameraStarting}
          onPress={startCamera}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            cameraStarting && styles.buttonDisabled,
          ]}
        >
          {cameraStarting ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.primaryButtonText}>Reintentar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        nativeID={scannerElementId}
        id={scannerElementId}
        style={styles.scannerElement}
      />

      <ScannerOverlay
        onCancel={onCancel}
        onChangeZoom={cycleZoom}
        onToggleTorch={toggleTorch}
        zoomLabel={`${currentZoom.toFixed(1)}x`}
        torchEnabled={torchEnabled}
        zoomAvailable={zoomSupported}
        torchAvailable={torchSupported}
        showControls={showControls}
        hint="Apunta al código de barras"
        title="Leer código de barras"
        subtitle="Mantén el EAN-13 dentro del marco. El número se copiará automáticamente cuando sea detectado."
        starting={cameraStarting}
        errorMessage={errorMessage}
        onRetry={startCamera}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#000000",
  },

  scannerElement: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },

  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    backgroundColor: "#07111f",
  },

  permissionIcon: {
    fontSize: 46,
    marginBottom: 6,
  },

  centeredTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },

  centeredText: {
    maxWidth: 440,
    color: "#c6d3df",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },

  primaryButton: {
    minWidth: 210,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: "#1f8f57",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  secondaryButton: {
    minWidth: 210,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.72,
  },

  buttonDisabled: {
    opacity: 0.56,
  },
});
