// components/features/scanner/QuickEan13Scanner.web.js

import React, { useCallback, useEffect, useRef, useState } from "react";

import { StyleSheet, View } from "react-native";

import { useIsFocused } from "@react-navigation/native";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import ScannerOverlay from "./ScannerOverlay";

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function normalizeEan13(value) {
  const code = String(value || "").trim();

  if (!/^\d{13}$/.test(code)) {
    return null;
  }

  return code;
}

function isValidEan13(value) {
  const code = normalizeEan13(value);

  if (!code) {
    return false;
  }

  const digits = code.split("").map(Number);

  const checksum = digits.slice(0, 12).reduce((sum, digit, index) => {
    return sum + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);

  const expectedCheckDigit = (10 - (checksum % 10)) % 10;

  return expectedCheckDigit === digits[12];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeZoom(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return clamp(number, 0, 1);
}

function findPreferredCamera(cameras) {
  if (!Array.isArray(cameras) || cameras.length === 0) {
    return null;
  }

  const rearCamera = cameras.find((camera) => {
    const label = String(camera?.label || "");

    return /back|rear|environment|trasera|posterior/i.test(label);
  });

  return rearCamera || cameras[cameras.length - 1] || cameras[0];
}

function getErrorMessage(error) {
  const text = String(error?.message || error || "");

  if (text.includes("NotAllowedError")) {
    return "No se ha permitido el acceso a la cámara. Revisa los permisos del navegador.";
  }

  if (text.includes("NotFoundError")) {
    return "No se ha encontrado una cámara disponible.";
  }

  if (text.includes("NotReadableError")) {
    return "La cámara está siendo utilizada por otra aplicación o pestaña.";
  }

  if (text.includes("OverconstrainedError")) {
    return "El navegador no ha podido seleccionar la cámara solicitada.";
  }

  return "No se pudo iniciar la cámara. Comprueba los permisos e inténtalo de nuevo.";
}

function getZoomCapability(capabilities) {
  const zoomCapability = capabilities?.zoom;

  if (!zoomCapability) {
    return null;
  }

  const min = Number(zoomCapability.min);

  const max = Number(zoomCapability.max);

  const step = Number(zoomCapability.step);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  if (max <= min) {
    return null;
  }

  return {
    min,

    max,

    step: Number.isFinite(step) && step > 0 ? step : 0.1,
  };
}

function mapNormalizedZoomToTrackZoom(normalizedZoom, zoomCapability) {
  if (!zoomCapability) {
    return null;
  }

  const normalized = normalizeZoom(normalizedZoom);

  const value =
    zoomCapability.min + normalized * (zoomCapability.max - zoomCapability.min);

  const rounded = Math.round(value / zoomCapability.step) * zoomCapability.step;

  return clamp(rounded, zoomCapability.min, zoomCapability.max);
}

/* -------------------------------------------------
   Component
-------------------------------------------------- */

export default function QuickEan13Scanner({
  onDetected,
  onCancel,

  showControls = true,
  showStatusBadges = true,

  /*
   * Igual que expo-camera:
   * zoom usa un rango normalizado entre 0 y 1.
   */
  zoom = 0.15,
  zoomLabel = "1.2x",
  torchEnabled = false,

  onChangeZoom,
  onToggleTorch,
}) {
  const isFocused = useIsFocused();

  const readerIdRef = useRef(
    `quick-ean13-reader-${Math.random().toString(36).slice(2)}`,
  );

  const scannerRef = useRef(null);

  /*
   * Permite invalidar arranques antiguos cuando
   * la pantalla se cierra o el lector se reinicia.
   */
  const operationIdRef = useRef(0);

  const lockRef = useRef(false);

  const onDetectedRef = useRef(onDetected);

  const zoomCapabilityRef = useRef(null);

  const [starting, setStarting] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [restartToken, setRestartToken] = useState(0);

  const [cameraReady, setCameraReady] = useState(false);

  const [zoomAvailable, setZoomAvailable] = useState(false);

  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  /* -------------------------------------------------
     Web video layout
  -------------------------------------------------- */

  useEffect(() => {
    /*
     * html5-qrcode crea dinámicamente varios nodos HTML.
     *
     * El vídeo debe ocupar todo el contenedor. Nuestro
     * ScannerOverlay será la única interfaz visible.
     */
    const readerId = readerIdRef.current;

    const styleId = `${readerId}-scanner-layout`;

    const styleElement = document.createElement("style");

    styleElement.id = styleId;

    styleElement.textContent = `
      #${readerId} {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
        border: 0 !important;
        background: #000000 !important;
      }

      #${readerId} video {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border: 0 !important;
      }

      #${readerId} canvas {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      #${readerId}__scan_region {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 100% !important;
        overflow: hidden !important;
        border: 0 !important;
      }

      #${readerId}__dashboard,
      #${readerId}__dashboard_section {
        display: none !important;
      }

      #${readerId} img {
        display: none !important;
      }
    `;

    document.head.appendChild(styleElement);

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  /* -------------------------------------------------
     Camera cleanup
  -------------------------------------------------- */

  const stopScannerInstance = useCallback(async (scanner) => {
    if (!scanner) {
      return;
    }

    try {
      await scanner.stop();
    } catch (error) {
      /*
       * Puede ocurrir si el lector todavía estaba
       * arrancando o si ya se había detenido.
       */
    }

    try {
      scanner.clear();
    } catch (error) {
      /*
       * Limpieza defensiva.
       */
    }
  }, []);

  const stopCurrentScanner = useCallback(async () => {
    operationIdRef.current += 1;

    const scanner = scannerRef.current;

    scannerRef.current = null;

    zoomCapabilityRef.current = null;

    setCameraReady(false);

    setZoomAvailable(false);

    setTorchAvailable(false);

    await stopScannerInstance(scanner);
  }, [stopScannerInstance]);

  /* -------------------------------------------------
     Camera capabilities
  -------------------------------------------------- */

  const readCapabilities = useCallback((scanner) => {
    let capabilities = {};

    try {
      capabilities = scanner.getRunningTrackCapabilities?.() || {};
    } catch (error) {
      capabilities = {};
    }

    const zoomCapability = getZoomCapability(capabilities);

    const hasTorch = Boolean(capabilities?.torch);

    zoomCapabilityRef.current = zoomCapability;

    setZoomAvailable(Boolean(zoomCapability));

    setTorchAvailable(hasTorch);

    return {
      zoomCapability,

      hasTorch,
    };
  }, []);

  /* -------------------------------------------------
     Apply controlled values to the web stream
  -------------------------------------------------- */

  const applyZoom = useCallback(async (scanner, normalizedZoom) => {
    const zoomCapability = zoomCapabilityRef.current;

    if (!scanner || !zoomCapability) {
      return;
    }

    const trackZoom = mapNormalizedZoomToTrackZoom(
      normalizedZoom,
      zoomCapability,
    );

    if (!Number.isFinite(trackZoom)) {
      return;
    }

    try {
      await scanner.applyVideoConstraints({
        advanced: [
          {
            zoom: trackZoom,
          },
        ],
      });
    } catch (error) {
      console.log("No se pudo aplicar el zoom web:", error);
    }
  }, []);

  const applyTorch = useCallback(
    async (scanner, enabled) => {
      if (!scanner || !torchAvailable) {
        return;
      }

      try {
        await scanner.applyVideoConstraints({
          advanced: [
            {
              torch: Boolean(enabled),
            },
          ],
        });
      } catch (error) {
        console.log("No se pudo aplicar la linterna web:", error);
      }
    },
    [torchAvailable],
  );

  /* -------------------------------------------------
     Start scanner
  -------------------------------------------------- */

  useEffect(() => {
    let disposed = false;

    if (!isFocused) {
      stopCurrentScanner();

      return () => {
        disposed = true;
      };
    }

    lockRef.current = false;

    const operationId = operationIdRef.current + 1;

    operationIdRef.current = operationId;

    let ownedScanner = null;

    async function createScannerAndStart(cameraConfig) {
      const scanner = new Html5Qrcode(readerIdRef.current, {
        /*
         * Solo cargamos el decodificador EAN-13.
         */
        formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],

        /*
         * ZXing ofrece un comportamiento más
         * consistente en navegadores móviles.
         */
        useBarCodeDetectorIfSupported: false,

        verbose: false,
      });

      ownedScanner = scanner;

      scannerRef.current = scanner;

      async function handleDecodedText(decodedText) {
        if (lockRef.current) {
          return;
        }

        const barcode = normalizeEan13(decodedText);

        if (!barcode || !isValidEan13(barcode)) {
          return;
        }

        lockRef.current = true;

        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }

        operationIdRef.current += 1;

        setCameraReady(false);

        await stopScannerInstance(scanner);

        if (!disposed) {
          onDetectedRef.current?.(barcode);
        }
      }

      function handleDecodeFailure() {
        /*
         * Ignoramos los fotogramas que no contienen
         * un EAN-13 válido.
         */
      }

      try {
        await scanner.start(
          cameraConfig,
          {
            /*
             * El overlay lo dibujamos nosotros.
             *
             * No añadas qrbox: html5-qrcode dibujaría
             * un marco adicional y oscurecería el vídeo.
             */
            fps: 10,

            disableFlip: true,
          },
          handleDecodedText,
          handleDecodeFailure,
        );

        return scanner;
      } catch (error) {
        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }

        await stopScannerInstance(scanner);

        throw error;
      }
    }

    async function startScanner() {
      setStarting(true);

      setErrorMessage("");

      setCameraReady(false);

      setZoomAvailable(false);

      setTorchAvailable(false);

      zoomCapabilityRef.current = null;

      let scanner = null;

      try {
        /*
         * Primer intento: cámara trasera mediante
         * facingMode.
         */
        try {
          scanner = await createScannerAndStart({
            facingMode: "environment",
          });
        } catch (firstError) {
          /*
           * Fallback: elegimos explícitamente una
           * cámara trasera disponible.
           */
          const cameras = await Html5Qrcode.getCameras();

          const preferredCamera = findPreferredCamera(cameras);

          if (!preferredCamera?.id) {
            throw firstError;
          }

          scanner = await createScannerAndStart(preferredCamera.id);
        }

        /*
         * Si el usuario abandona la pantalla mientras
         * arranca la cámara, cerramos el stream.
         */
        if (disposed || operationId !== operationIdRef.current) {
          if (scannerRef.current === scanner) {
            scannerRef.current = null;
          }

          await stopScannerInstance(scanner);

          return;
        }

        scannerRef.current = scanner;

        ownedScanner = scanner;

        const capabilities = readCapabilities(scanner);

        setCameraReady(true);

        /*
         * Solo podemos aplicar el zoom después de
         * iniciar el stream y leer sus capacidades.
         */
        if (capabilities.zoomCapability) {
          await applyZoom(scanner, zoom);
        }

        /*
         * La linterna inicial también se aplica
         * después de iniciar el stream.
         */
        if (capabilities.hasTorch && torchEnabled) {
          try {
            await scanner.applyVideoConstraints({
              advanced: [
                {
                  torch: true,
                },
              ],
            });
          } catch (error) {
            console.log("No se pudo activar la linterna inicial:", error);
          }
        }
      } catch (error) {
        console.log("Quick EAN-13 web scanner error:", error);

        if (!disposed && operationId === operationIdRef.current) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!disposed && operationId === operationIdRef.current) {
          setStarting(false);
        }
      }
    }

    startScanner();

    return () => {
      disposed = true;

      lockRef.current = false;

      operationIdRef.current += 1;

      zoomCapabilityRef.current = null;

      setCameraReady(false);

      setZoomAvailable(false);

      setTorchAvailable(false);

      if (scannerRef.current === ownedScanner) {
        scannerRef.current = null;
      }

      stopScannerInstance(ownedScanner);
    };
  }, [
    applyZoom,
    isFocused,
    readCapabilities,
    restartToken,
    stopCurrentScanner,
    stopScannerInstance,
  ]);

  /* -------------------------------------------------
     Synchronize stream without restarting camera
  -------------------------------------------------- */

  useEffect(() => {
    if (!cameraReady) {
      return;
    }

    const scanner = scannerRef.current;

    if (!scanner) {
      return;
    }

    applyZoom(scanner, zoom);
  }, [applyZoom, cameraReady, zoom]);

  useEffect(() => {
    if (!cameraReady) {
      return;
    }

    const scanner = scannerRef.current;

    if (!scanner) {
      return;
    }

    applyTorch(scanner, torchEnabled);
  }, [applyTorch, cameraReady, torchEnabled]);

  /* -------------------------------------------------
     Controls
  -------------------------------------------------- */

  async function handleClose() {
    lockRef.current = true;

    await stopCurrentScanner();

    onCancel?.();
  }

  function handleRetry() {
    lockRef.current = false;

    setErrorMessage("");

    setRestartToken((previous) => {
      return previous + 1;
    });
  }

  function handleZoomPress() {
    if (!zoomAvailable) {
      return;
    }

    onChangeZoom?.();
  }

  function handleTorchPress() {
    if (!torchAvailable) {
      return;
    }

    onToggleTorch?.();
  }

  /* -------------------------------------------------
     Render
  -------------------------------------------------- */

  return (
    <View style={styles.container}>
      {/*
       * html5-qrcode inserta dinámicamente el vídeo
       * y sus nodos auxiliares en este contenedor.
       *
       * pointerEvents="none" evita que la vista previa
       * bloquee los taps de los botones del overlay.
       */}
      <View
        nativeID={readerIdRef.current}
        style={styles.reader}
        pointerEvents="none"
      />

      <ScannerOverlay
        onCancel={handleClose}
        onChangeZoom={handleZoomPress}
        onToggleTorch={handleTorchPress}
        zoomLabel={zoomLabel}
        torchEnabled={torchEnabled}
        zoomAvailable={zoomAvailable}
        torchAvailable={torchAvailable}
        showControls={showControls}
        showStatusBadges={showStatusBadges}
        badgeLabel="Scanner"
        starting={starting}
        errorMessage={errorMessage}
        onRetry={handleRetry}
      />
    </View>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    height: "100%",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#000000",
  },

  reader: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#000000",
  },
});
