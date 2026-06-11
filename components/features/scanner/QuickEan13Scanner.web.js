import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ZOOM_VALUES = [1, 1.2, 1.5, 2];

export default function QuickEan13Scanner({
  onDetected,
  onBarcode,
  onBarcodeScanned,
  onScan,
  onRead,
  onCancel,
  onClose,
  title = "Leer código de barras",
  subtitle = "El número se copiará automáticamente al producto cuando sea detectado.",
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const lastBarcodeRef = useRef(null);
  const lastTimeRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);

  const zoomValue = ZOOM_VALUES[zoomIndex] || 1;
  const zoomLabel = `${zoomValue.toFixed(1)}x`;

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeScanner = useCallback(() => {
    stopCamera();
    onCancel?.();
    onClose?.();
  }, [onCancel, onClose, stopCamera]);

  const emitBarcode = useCallback(
    (code) => {
      const value = String(code || "").trim();

      if (!/^\d{13}$/.test(value)) return;

      setLocked(true);
      stopCamera();

      onDetected?.(value);
      onBarcode?.(value);
      onBarcodeScanned?.(value);
      onScan?.(value);
      onRead?.(value);
    },
    [onBarcode, onBarcodeScanned, onDetected, onRead, onScan, stopCamera],
  );

  const applyZoom = useCallback(async (nextZoom) => {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks?.()[0];

    if (!track?.getCapabilities || !track?.applyConstraints) return;

    const capabilities = track.getCapabilities();

    if (!capabilities.zoom) return;

    const min = capabilities.zoom.min || 1;
    const max = capabilities.zoom.max || 1;
    const value = Math.max(min, Math.min(max, nextZoom));

    try {
      await track.applyConstraints({
        advanced: [{ zoom: value }],
      });
    } catch {
      // Algunos navegadores declaran zoom pero no permiten aplicarlo.
    }
  }, []);

  const cycleZoom = useCallback(() => {
    setZoomIndex((current) => {
      const nextIndex = (current + 1) % ZOOM_VALUES.length;
      applyZoom(ZOOM_VALUES[nextIndex]);
      return nextIndex;
    });
  }, [applyZoom]);

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks?.()[0];

    if (!track?.applyConstraints) return;

    const nextTorch = !torchOn;

    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch {
      setTorchOn(false);
    }
  }, [torchOn]);

  const scanLoop = useCallback(async () => {
    const video = videoRef.current;

    if (!video || locked || !detectorRef.current) return;

    if (video.readyState >= 2) {
      try {
        const codes = await detectorRef.current.detect(video);

        for (const code of codes || []) {
          const value = String(code.rawValue || "").trim();
          const format = String(code.format || "").toLowerCase();

          const isEan13 =
            format === "ean_13" ||
            format === "ean-13" ||
            format === "ean13" ||
            /^\d{13}$/.test(value);

          if (!isEan13 || !/^\d{13}$/.test(value)) continue;

          const now = Date.now();

          if (
            lastBarcodeRef.current === value &&
            now - lastTimeRef.current < 900
          ) {
            continue;
          }

          lastBarcodeRef.current = value;
          lastTimeRef.current = now;

          emitBarcode(value);
          return;
        }
      } catch {
        // Evita romper el loop si BarcodeDetector falla en un frame.
      }
    }

    rafRef.current = requestAnimationFrame(scanLoop);
  }, [emitBarcode, locked]);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        setError("");

        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Este navegador no permite usar la cámara.");
          return;
        }

        if (!("BarcodeDetector" in window)) {
          setError("Este navegador no soporta BarcodeDetector.");
          return;
        }

        detectorRef.current = new window.BarcodeDetector({
          formats: ["ean_13"],
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const track = stream.getVideoTracks?.()[0];
        const capabilities = track?.getCapabilities?.() || {};

        setTorchSupported(Boolean(capabilities.torch));
        setZoomSupported(Boolean(capabilities.zoom));

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.muted = true;

          await videoRef.current.play();

          setReady(true);

          if (capabilities.zoom) {
            applyZoom(zoomValue);
          }

          rafRef.current = requestAnimationFrame(scanLoop);
        }
      } catch (err) {
        setError(
          "No se pudo abrir la cámara. Revisa permisos, HTTPS o compatibilidad del navegador.",
        );
      }
    }

    startCamera();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [applyZoom, scanLoop, stopCamera, zoomValue]);

  return (
    <View style={styles.container}>
      <video ref={videoRef} style={styles.video} playsInline muted autoPlay />

      <View pointerEvents="none" style={styles.darkOverlay} />

      <Pressable style={styles.closeButton} onPress={closeScanner}>
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>

      {!ready && !error ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Preparando cámara...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Escáner no disponible</Text>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable style={styles.cancelButton} onPress={closeScanner}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}

      {!error ? (
        <>
          <View style={styles.scanArea}>
            <View style={styles.scanBox}>
              <View style={styles.scanLine} />
            </View>

            <Text style={styles.scanHint}>Apunta al código EAN-13</Text>

            <View style={styles.controlsRow}>
              <Pressable
                style={[
                  styles.controlButton,
                  !zoomSupported && styles.controlButtonDisabled,
                ]}
                onPress={cycleZoom}
                disabled={!zoomSupported}
              >
                <Text style={styles.controlButtonText}>Zoom {zoomLabel}</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.controlButton,
                  torchOn && styles.controlButtonActive,
                  !torchSupported && styles.controlButtonDisabled,
                ]}
                onPress={toggleTorch}
                disabled={!torchSupported}
              >
                <Text
                  style={[
                    styles.controlButtonText,
                    torchOn && styles.controlButtonTextActive,
                  ]}
                >
                  Linterna {torchOn ? "ON" : "OFF"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.bottomPanel}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <Pressable style={styles.cancelButton} onPress={closeScanner}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {locked && (
        <View style={styles.detectedBanner}>
          <Text style={styles.detectedText}>Código detectado</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
    overflow: "hidden",
  },

  video: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    backgroundColor: "#000",
  },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  center: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 80,
    backgroundColor: "rgba(0,0,0,0.72)",
  },

  loadingText: {
    marginTop: 12,
    color: "#fff",
    fontSize: 16,
  },

  errorTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },

  errorText: {
    color: "#d1d5db",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 22,
  },

  closeButton: {
    position: "absolute",
    top: 42,
    right: 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
  },

  closeButtonText: {
    color: "#fff",
    fontSize: 46,
    lineHeight: 46,
    fontWeight: "300",
  },

  scanArea: {
    position: "absolute",
    top: "38%",
    left: 20,
    right: 20,
    alignItems: "center",
    transform: [{ translateY: -130 }],
    zIndex: 40,
  },

  scanBox: {
    width: "92%",
    maxWidth: 380,
    height: 132,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  scanLine: {
    width: "90%",
    height: 3,
    backgroundColor: "#fff",
    opacity: 0.95,
  },

  scanHint: {
    marginTop: 28,
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  controlsRow: {
    marginTop: 26,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    zIndex: 70,
  },

  controlButton: {
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fff",
    minWidth: 118,
    alignItems: "center",
  },

  controlButtonActive: {
    backgroundColor: "#facc15",
    borderColor: "#facc15",
  },

  controlButtonDisabled: {
    opacity: 0.42,
  },

  controlButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },

  controlButtonTextActive: {
    color: "#111827",
  },

  bottomPanel: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 34,
    alignItems: "center",
    zIndex: 40,
  },

  title: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },

  subtitle: {
    color: "#d1d5db",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
    marginBottom: 22,
  },

  cancelButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  detectedBanner: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(34,197,94,0.96)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: 100,
  },

  detectedText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
});
