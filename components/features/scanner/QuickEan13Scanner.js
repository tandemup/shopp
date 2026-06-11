import React, {
  useCallback,
  useEffect,
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
import { CameraView, useCameraPermissions } from "expo-camera";

const ZOOM_VALUES = [0, 0.08, 0.16, 0.25];

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
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [locked, setLocked] = useState(false);

  const lastBarcodeRef = useRef(null);
  const lastTimeRef = useRef(0);

  const zoom = ZOOM_VALUES[zoomIndex] || 0;
  const zoomLabel = useMemo(() => {
    if (zoomIndex === 0) return "1.0x";
    if (zoomIndex === 1) return "1.2x";
    if (zoomIndex === 2) return "1.4x";
    return "1.6x";
  }, [zoomIndex]);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const emitBarcode = useCallback(
    (code) => {
      const value = String(code || "").trim();

      if (!/^\d{13}$/.test(value)) return;

      setLocked(true);

      onDetected?.(value);
      onBarcode?.(value);
      onBarcodeScanned?.(value);
      onScan?.(value);
      onRead?.(value);
    },
    [onBarcode, onBarcodeScanned, onDetected, onRead, onScan],
  );

  const handleBarcodeScanned = useCallback(
    ({ data, type }) => {
      if (locked) return;

      const now = Date.now();
      const value = String(data || "").trim();

      if (!/^\d{13}$/.test(value)) return;

      const typeText = String(type || "").toLowerCase();
      const looksEan13 =
        typeText.includes("ean13") ||
        typeText.includes("ean-13") ||
        typeText.includes("ean_13") ||
        typeText.includes("ean");

      if (!looksEan13 && Platform.OS !== "ios") return;

      if (lastBarcodeRef.current === value && now - lastTimeRef.current < 900) {
        return;
      }

      lastBarcodeRef.current = value;
      lastTimeRef.current = now;

      emitBarcode(value);
    },
    [emitBarcode, locked],
  );

  const cycleZoom = useCallback(() => {
    setZoomIndex((current) => (current + 1) % ZOOM_VALUES.length);
  }, []);

  const toggleTorch = useCallback(() => {
    setTorchOn((current) => !current);
  }, []);

  const closeScanner = useCallback(() => {
    onCancel?.();
    onClose?.();
  }, [onCancel, onClose]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Preparando cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>Permiso de cámara necesario</Text>
        <Text style={styles.permissionText}>
          Activa la cámara para poder leer códigos EAN-13.
        </Text>

        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir cámara</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={closeScanner}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        zoom={zoom}
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13"],
        }}
        onBarcodeScanned={locked ? undefined : handleBarcodeScanned}
      />

      <View pointerEvents="none" style={styles.darkOverlay} />

      <Pressable style={styles.closeButton} onPress={closeScanner}>
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>

      <View style={styles.scanArea}>
        <View style={styles.scanBox}>
          <View style={styles.scanLine} />
        </View>

        <Text style={styles.scanHint}>Apunta al código EAN-13</Text>

        <View style={styles.controlsRow}>
          <Pressable style={styles.controlButton} onPress={cycleZoom}>
            <Text style={styles.controlButtonText}>Zoom {zoomLabel}</Text>
          </Pressable>

          <Pressable
            style={[
              styles.controlButton,
              torchOn && styles.controlButtonActive,
            ]}
            onPress={toggleTorch}
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
  },

  center: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    color: "#fff",
    fontSize: 16,
  },

  permissionTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },

  permissionText: {
    color: "#d1d5db",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 22,
  },

  primaryButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 12,
  },

  primaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },

  secondaryButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fff",
  },

  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
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
    zIndex: 50,
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
    zIndex: 20,
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
    zIndex: 40,
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
    zIndex: 20,
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
    zIndex: 60,
  },

  detectedText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
});
