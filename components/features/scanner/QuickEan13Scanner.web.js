// components/features/scanner/QuickEan13Scanner.web.js

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

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

function getScanBox(viewfinderWidth, viewfinderHeight) {
  const safeWidth = Math.max(1, viewfinderWidth);
  const safeHeight = Math.max(1, viewfinderHeight);

  return {
    width: Math.max(1, Math.min(Math.floor(safeWidth * 0.92), safeWidth - 4)),

    height: Math.max(
      1,
      Math.min(Math.max(84, Math.floor(safeHeight * 0.28)), safeHeight - 4),
    ),
  };
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

/* -------------------------------------------------
   Component
-------------------------------------------------- */

export default function QuickEan13Scanner({ onDetected, onCancel }) {
  const isFocused = useIsFocused();

  const readerIdRef = useRef(
    `quick-ean13-reader-${Math.random().toString(36).slice(2)}`,
  );

  const scannerRef = useRef(null);

  /*
   * Invalida cualquier operación de arranque antigua.
   */
  const operationIdRef = useRef(0);

  const lockRef = useRef(false);

  const onDetectedRef = useRef(onDetected);

  const [starting, setStarting] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [restartToken, setRestartToken] = useState(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

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
       * arrancando o ya se había detenido.
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
    /*
     * Cualquier arranque pendiente deja de ser válido.
     */
    operationIdRef.current += 1;

    const scanner = scannerRef.current;

    scannerRef.current = null;

    await stopScannerInstance(scanner);
  }, [stopScannerInstance]);

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
         * Solo EAN-13.
         *
         * Evitamos decodificadores innecesarios.
         */
        formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],

        /*
         * En Safari para iPhone forzamos el motor
         * JavaScript.
         *
         * BarcodeDetector todavía no ofrece un
         * comportamiento uniforme.
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

        /*
         * Dejamos de considerar activa esta instancia
         * antes de detenerla.
         */
        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }

        /*
         * Evita que cualquier operación anterior o
         * posterior interfiera durante la navegación.
         */
        operationIdRef.current += 1;

        await stopScannerInstance(scanner);

        if (!disposed) {
          onDetectedRef.current?.(barcode);
        }
      }

      function handleDecodeFailure() {
        /*
         * Ignoramos los fotogramas que todavía no
         * contienen un código EAN-13 válido.
         */
      }

      try {
        await scanner.start(
          cameraConfig,
          {
            /*
             * En Safari resulta más estable que
             * analizar 15 fps.
             */
            fps: 10,

            qrbox: getScanBox,

            /*
             * La cámara trasera no necesita una
             * segunda pasada reflejada.
             */
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

      let scanner = null;

      try {
        /*
         * Primer intento: solicitar directamente
         * la cámara trasera.
         */
        try {
          scanner = await createScannerAndStart({
            facingMode: "environment",
          });
        } catch (firstError) {
          /*
           * Algunos navegadores móviles no respetan
           * correctamente facingMode.
           *
           * Como fallback elegimos explícitamente una
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
         * Cerramos el stream si la pantalla ya no
         * está activa cuando termina el arranque.
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

      if (scannerRef.current === ownedScanner) {
        scannerRef.current = null;
      }

      stopScannerInstance(ownedScanner);
    };
  }, [isFocused, restartToken, stopCurrentScanner, stopScannerInstance]);

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

  /* -------------------------------------------------
     Render
  -------------------------------------------------- */

  return (
    <View style={styles.container}>
      <View nativeID={readerIdRef.current} style={styles.reader} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={25} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.middle} pointerEvents="none">
          <View style={styles.scanFrame}>
            <View style={styles.scanLine} />
          </View>

          <Text style={styles.hint}>Apunta al código EAN-13</Text>
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.title}>Leer código de barras</Text>

          <Text style={styles.subtitle}>
            El número se copiará automáticamente al producto cuando sea
            detectado.
          </Text>

          {starting ? (
            <Text style={styles.statusText}>Iniciando cámara...</Text>
          ) : null}

          {errorMessage ? (
            <>
              <Text style={styles.errorText}>{errorMessage}</Text>

              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
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
    height: "100dvh",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#000000",
  },

  reader: {
    flex: 1,
    width: "100%",
    minHeight: 320,
    backgroundColor: "#000000",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },

  topBar: {
    paddingTop: 16,
    paddingHorizontal: 16,
    alignItems: "flex-end",
  },

  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  middle: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },

  scanFrame: {
    width: "90%",
    maxWidth: 560,
    height: 120,
    borderWidth: 2,
    borderRadius: 16,
    borderColor: "#22C55E",
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  scanLine: {
    height: 2,
    width: "100%",
    backgroundColor: "#22C55E",
  },

  hint: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 4,
  },

  bottomPanel: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    backgroundColor: "rgba(0,0,0,0.72)",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 8,
    color: "#E5E7EB",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  statusText: {
    marginTop: 12,
    color: "#BFDBFE",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  errorText: {
    marginTop: 12,
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },

  retryButton: {
    alignSelf: "center",
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#2563EB",
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
