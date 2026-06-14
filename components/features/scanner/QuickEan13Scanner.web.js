import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const ZOOM_LEVELS = [1, 1.2, 1.5, 2];

const DEFAULT_ZOOM_INDEX = 1;

const DUPLICATE_LOCK_MS = 1500;

const CAMERA_GRANTED_STORAGE_KEY = "shopp:web-camera-access-granted";

function normalizeBarcode(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidEan13(value) {
  const barcode = normalizeBarcode(value);

  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }

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

function hasRememberedCameraAccess() {
  try {
    return window.localStorage.getItem(CAMERA_GRANTED_STORAGE_KEY) === "true";
  } catch (error) {
    return false;
  }
}

function rememberCameraAccess() {
  try {
    window.localStorage.setItem(CAMERA_GRANTED_STORAGE_KEY, "true");
  } catch (error) {}
}

function forgetRememberedCameraAccess() {
  try {
    window.localStorage.removeItem(CAMERA_GRANTED_STORAGE_KEY);
  } catch (error) {}
}

function getReadableCameraError(error) {
  switch (error?.name) {
    case "NotAllowedError":
      return (
        "El navegador ha bloqueado el acceso a la cámara. " +
        "Activa el permiso para este sitio desde los ajustes del navegador."
      );

    case "NotFoundError":
      return "No se ha encontrado ninguna cámara compatible.";

    case "NotReadableError":
      return (
        "La cámara está siendo utilizada por otra aplicación " +
        "o por otra pestaña del navegador."
      );

    case "OverconstrainedError":
      return "La cámara no admite la configuración solicitada.";

    case "SecurityError":
      return (
        "El navegador no permite acceder a la cámara desde esta página. " +
        "Comprueba que estás utilizando HTTPS."
      );

    default:
      return (
        error?.message ||
        String(error || "") ||
        "No ha sido posible iniciar la cámara."
      );
  }
}

async function readCameraPermissionState() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    return "unsupported";
  }

  if (!navigator?.permissions?.query) {
    return "prompt";
  }

  try {
    const permission = await navigator.permissions.query({
      name: "camera",
    });

    return permission.state;
  } catch (error) {
    return "prompt";
  }
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function waitForDomElement(elementId, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const check = () => {
      const element = document.getElementById(elementId);

      if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
        resolve(element);
        return true;
      }

      return false;
    };

    if (check()) {
      return;
    }

    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      if (check()) {
        window.clearInterval(timer);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 100);
  });
}

export default function QuickEan13ScannerWeb({
  onDetected,
  onBarcodeScanned,
  onCancel,

  initialZoomIndex = DEFAULT_ZOOM_INDEX,
  initialTorchEnabled = false,

  showControls = true,
  showStatusBadges = true,
}) {
  const scannerElementIdRef = useRef(
    `quick-ean13-scanner-${Math.random().toString(36).slice(2)}`,
  );

  const scannerElementId = scannerElementIdRef.current;

  const scannerRef = useRef(null);

  const mountedRef = useRef(false);

  const runningRef = useRef(false);

  const startingRef = useRef(false);

  const permissionRef = useRef(null);

  const currentZoomRef = useRef(
    ZOOM_LEVELS[clamp(initialZoomIndex, 0, ZOOM_LEVELS.length - 1)] ?? 1.2,
  );

  const lastDetectedRef = useRef({
    barcode: "",
    timestamp: 0,
  });

  const [permissionState, setPermissionState] = useState("checking");

  const [cameraStarting, setCameraStarting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [scannerVisible, setScannerVisible] = useState(false);

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

  const getScannerCapabilities = useCallback(() => {
    try {
      return scannerRef.current?.getRunningTrackCapabilities?.() || {};
    } catch (error) {
      return {};
    }
  }, []);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;

    startingRef.current = false;

    if (!scanner) {
      if (mountedRef.current) {
        setScannerVisible(false);
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
      setScannerVisible(false);
      setTorchEnabled(false);
      setTorchSupported(false);
      setZoomSupported(false);
    }
  }, []);

  const notifyDetectedBarcode = useCallback(
    async (decodedText) => {
      const barcode = normalizeBarcode(decodedText);

      if (!isValidEan13(barcode)) {
        return;
      }

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
          console.warn("No se pudo detener el lector web:", error);
        }

        runningRef.current = false;
      }

      if (!mountedRef.current) {
        return;
      }

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

    if (!mountedRef.current) {
      return;
    }

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
          advanced: [
            {
              zoom: desiredZoom,
            },
          ],
        });
      } catch (error) {
        console.warn("No se pudo aplicar el zoom inicial:", error);

        if (mountedRef.current) {
          setZoomSupported(false);
        }
      }
    }

    if (supportsTorch && initialTorchEnabled) {
      try {
        await scannerRef.current?.applyVideoConstraints?.({
          advanced: [
            {
              torch: true,
            },
          ],
        });

        if (mountedRef.current) {
          setTorchEnabled(true);
        }
      } catch (error) {
        console.warn("No se pudo activar la linterna inicialmente:", error);

        if (mountedRef.current) {
          setTorchSupported(false);
          setTorchEnabled(false);
        }
      }
    }
  }, [getScannerCapabilities, initialTorchEnabled]);

  const startCamera = useCallback(async () => {
    if (startingRef.current || runningRef.current) {
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissionState("unsupported");

      setErrorMessage(
        "Este navegador no permite utilizar la cámara. " +
          "Abre Shopp mediante HTTPS con un navegador compatible.",
      );

      return;
    }

    startingRef.current = true;

    if (mountedRef.current) {
      setCameraStarting(true);
      setErrorMessage("");
      setScannerVisible(true);
    }

    /*
     * Necesario en React Native Web:
     * primero mostramos el contenedor con id={scannerElementId}
     * y después dejamos que React lo pinte en el DOM.
     *
     * Si Html5Qrcode se crea antes de que exista ese nodo,
     * aparece:
     *
     * Scanner container not found: quick-ean13-scanner-...
     */
    await waitForNextFrame();

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
          verbose: false,
        });
      }

      await scannerRef.current.start(
        {
          facingMode: {
            ideal: "environment",
          },
        },
        {
          fps: 10,
          disableFlip: true,
          qrbox: {
            width: 300,
            height: 150,
          },
        },
        notifyDetectedBarcode,
        () => {
          /*
           * La mayoría de los fotogramas no contienen
           * ningún código de barras.
           */
        },
      );

      if (!mountedRef.current) {
        try {
          await scannerRef.current?.stop?.();
          scannerRef.current?.clear?.();
        } catch (error) {
          console.warn("No se pudo cerrar la cámara desmontada:", error);
        }

        scannerRef.current = null;
        runningRef.current = false;

        return;
      }

      runningRef.current = true;

      rememberCameraAccess();

      setPermissionState("granted");

      await configureCameraCapabilities();
    } catch (error) {
      console.warn("No se pudo iniciar el lector web:", error);

      runningRef.current = false;

      if (error?.name === "NotAllowedError") {
        forgetRememberedCameraAccess();

        if (mountedRef.current) {
          setPermissionState("denied");
        }
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

      if (!zoomSupported) {
        return;
      }

      const capabilities = getScannerCapabilities();

      const zoomMinimum = capabilities?.zoom?.min ?? 1;

      const zoomMaximum = capabilities?.zoom?.max ?? selectedZoom;

      const constrainedZoom = clamp(selectedZoom, zoomMinimum, zoomMaximum);

      try {
        await scannerRef.current?.applyVideoConstraints?.({
          advanced: [
            {
              zoom: constrainedZoom,
            },
          ],
        });
      } catch (error) {
        console.warn("No se pudo modificar el zoom:", error);

        if (mountedRef.current) {
          setZoomSupported(false);
        }
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
    if (!torchSupported) {
      return;
    }

    const nextTorchEnabled = !torchEnabled;

    try {
      await scannerRef.current?.applyVideoConstraints?.({
        advanced: [
          {
            torch: nextTorchEnabled,
          },
        ],
      });

      if (mountedRef.current) {
        setTorchEnabled(nextTorchEnabled);
      }
    } catch (error) {
      console.warn("No se pudo modificar la linterna:", error);

      if (mountedRef.current) {
        setTorchSupported(false);
        setTorchEnabled(false);
      }
    }
  }, [torchEnabled, torchSupported]);

  useEffect(() => {
    mountedRef.current = true;

    const checkInitialPermission = async () => {
      const nextPermissionState = await readCameraPermissionState();

      if (!mountedRef.current) {
        return;
      }

      setPermissionState(nextPermissionState);

      if (
        nextPermissionState === "granted" ||
        (nextPermissionState === "prompt" && hasRememberedCameraAccess())
      ) {
        startCamera();
      }

      if (!navigator?.permissions?.query) {
        return;
      }

      try {
        const permission = await navigator.permissions.query({
          name: "camera",
        });

        permissionRef.current = permission;

        permission.onchange = () => {
          if (!mountedRef.current) {
            return;
          }

          setPermissionState(permission.state);

          if (permission.state === "denied") {
            forgetRememberedCameraAccess();

            return;
          }

          if (permission.state === "granted" && !runningRef.current) {
            startCamera();
          }
        };
      } catch (error) {}
    };

    checkInitialPermission();

    return () => {
      mountedRef.current = false;

      if (permissionRef.current) {
        permissionRef.current.onchange = null;
      }

      stopCamera();
    };
  }, [startCamera, stopCamera]);

  if (permissionState === "checking") {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.centeredTitle}>
          Comprobando acceso a la cámara…
        </Text>
      </View>
    );
  }

  if (permissionState === "unsupported") {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionIcon}>⚠️</Text>

        <Text style={styles.centeredTitle}>Cámara no disponible</Text>

        <Text style={styles.centeredText}>{errorMessage}</Text>

        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Cerrar</Text>
        </Pressable>
      </View>
    );
  }

  if (permissionState === "prompt" || permissionState === "denied") {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionIcon}>📷</Text>

        <Text style={styles.centeredTitle}>Acceso a la cámara</Text>

        <Text style={styles.centeredText}>
          {permissionState === "denied"
            ? "El navegador ha bloqueado el acceso. " +
              "Revisa los permisos de cámara de este sitio y vuelve a intentarlo."
            : "Pulsa el botón para permitir que Shopp utilice la cámara mientras lees el código de barras."}
        </Text>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

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
            <Text style={styles.primaryButtonText}>
              {permissionState === "denied" ? "Reintentar" : "Permitir cámara"}
            </Text>
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

      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.topShade} />

        <View style={styles.middleRow}>
          <View style={styles.sideShade} />

          <View style={styles.scanWindow}>
            <View style={[styles.corner, styles.cornerTopLeft]} />

            <View style={[styles.corner, styles.cornerTopRight]} />

            <View style={[styles.corner, styles.cornerBottomLeft]} />

            <View style={[styles.corner, styles.cornerBottomRight]} />

            <View style={styles.scanLine} />
          </View>

          <View style={styles.sideShade} />
        </View>

        <View style={styles.bottomShade} />
      </View>

      <View pointerEvents="none" style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Apunta al código de barras</Text>

        <Text style={styles.instructionsText}>
          Mantén el EAN-13 dentro del recuadro
        </Text>
      </View>

      {showStatusBadges ? (
        <View pointerEvents="none" style={styles.statusBadges}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              Zoom {currentZoom.toFixed(1)}×
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {torchEnabled ? "Luz activada" : "Luz apagada"}
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>EAN-13</Text>
          </View>
        </View>
      ) : null}

      {showControls ? (
        <View style={styles.controls}>
          <Pressable
            disabled={!zoomSupported}
            onPress={cycleZoom}
            style={({ pressed }) => [
              styles.controlButton,
              pressed && styles.buttonPressed,
              !zoomSupported && styles.controlButtonDisabled,
            ]}
          >
            <Text style={styles.controlButtonText}>
              Zoom {currentZoom.toFixed(1)}×
            </Text>
          </Pressable>

          <Pressable
            disabled={!torchSupported}
            onPress={toggleTorch}
            style={({ pressed }) => [
              styles.controlButton,
              torchEnabled && styles.controlButtonActive,
              pressed && styles.buttonPressed,
              !torchSupported && styles.controlButtonDisabled,
            ]}
          >
            <Text style={styles.controlButtonText}>
              {torchEnabled ? "Linterna encendida" : "Linterna"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}
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

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  topShade: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
  },

  middleRow: {
    height: 220,
    flexDirection: "row",
  },

  sideShade: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
  },

  scanWindow: {
    width: "86%",
    maxWidth: 480,
    position: "relative",
  },

  scanLine: {
    position: "absolute",
    top: "50%",
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#ffffff",
    opacity: 0.92,
  },

  corner: {
    width: 34,
    height: 34,
    position: "absolute",
    borderColor: "#ffffff",
  },

  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },

  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },

  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },

  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 12,
  },

  bottomShade: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
  },

  instructions: {
    position: "absolute",
    top: 28,
    left: 20,
    right: 20,
    alignItems: "center",
  },

  instructionsTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  instructionsText: {
    color: "#f0f4f8",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },

  statusBadges: {
    position: "absolute",
    top: 94,
    left: 16,
    right: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },

  statusBadge: {
    minHeight: 31,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(10, 24, 39, 0.84)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },

  statusBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  controls: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    alignItems: "center",
    gap: 10,
  },

  controlButton: {
    minWidth: 214,
    minHeight: 46,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "rgba(10, 24, 39, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.36)",
    alignItems: "center",
    justifyContent: "center",
  },

  controlButtonActive: {
    backgroundColor: "rgba(182, 122, 0, 0.94)",
  },

  controlButtonDisabled: {
    opacity: 0.42,
  },

  controlButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  cancelButton: {
    minWidth: 214,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.34)",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
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

  errorText: {
    maxWidth: 440,
    color: "#ffd58a",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 13,
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
