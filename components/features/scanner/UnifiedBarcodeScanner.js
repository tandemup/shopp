import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const DEFAULT_ZOOM_LEVELS = [
  { label: "1.1x", value: 0.1 },
  { label: "1.2x", value: 0.2 },
  { label: "1.4x", value: 0.35 },
];

const DEFAULT_BARCODE_TYPES = ["ean13"];

export default function UnifiedBarcodeScanner({
  onDetected,
  onCancel,
  onStartScanning,
  onStopScanning,

  active = true,
  mode = "manual", // "manual" | "auto"

  barcodeTypes = DEFAULT_BARCODE_TYPES,
  zoomLevels = DEFAULT_ZOOM_LEVELS,
  initialZoomIndex = 1,

  showControls = true,
  showHint = true,
  hintText = "Apunta al código de barras",

  statusMessage = "",
  statusColor = "#2563eb",

  // NUEVO
  continuous = false,
  scanCooldownMs = 1200,
}) {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();

  const [torch, setTorch] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(initialZoomIndex);
  const [scanningEnabled, setScanningEnabled] = useState(mode === "auto");

  const lockRef = useRef(false);
  const unlockTimerRef = useRef(null);

  const cameraActive = active && isFocused && permission?.granted;

  const zoom = useMemo(() => {
    return zoomLevels[zoomIndex]?.value ?? zoomLevels[0]?.value ?? 0;
  }, [zoomIndex, zoomLevels]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!active || !isFocused) {
      resetScanner();
    }
  }, [active, isFocused]);

  useEffect(() => {
    if (mode === "auto" && active && isFocused) {
      lockRef.current = false;
      setScanningEnabled(true);
    }

    if (mode === "manual") {
      setScanningEnabled(false);
    }
  }, [mode, active, isFocused]);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

  function resetScanner() {
    lockRef.current = false;

    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }

    setScanningEnabled(mode === "auto");
    setTorch(false);
  }

  function startScanning() {
    lockRef.current = false;
    setScanningEnabled(true);
    onStartScanning?.();
  }

  function stopScanning() {
    lockRef.current = false;
    setScanningEnabled(false);
    onStopScanning?.();
  }

  function scheduleUnlock() {
    if (!continuous || mode !== "auto") return;

    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
    }

    unlockTimerRef.current = setTimeout(() => {
      lockRef.current = false;
      unlockTimerRef.current = null;
    }, scanCooldownMs);
  }

  function handleBarcodeScanned({ data, type }) {
    if (!cameraActive) return;
    if (!scanningEnabled) return;
    if (lockRef.current) return;
    if (!data) return;

    lockRef.current = true;

    if (mode === "manual") {
      setScanningEnabled(false);
    }

    try {
      onDetected?.({
        data: String(data),
        type: String(type),
      });
    } finally {
      scheduleUnlock();
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Solicitando permiso de cámara…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          Se necesita acceso a la cámara.
        </Text>

        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir cámara</Text>
        </Pressable>

        {onCancel ? (
          <Pressable
            style={[styles.primaryButton, styles.cancelPermissionButton]}
            onPress={onCancel}
          >
            <Text style={styles.primaryButtonText}>Cerrar</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {cameraActive ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          active={cameraActive}
          enableTorch={torch}
          zoom={zoom}
          barcodeScannerSettings={{
            barcodeTypes,
          }}
          onBarcodeScanned={scanningEnabled ? handleBarcodeScanned : undefined}
        />
      ) : (
        <View style={StyleSheet.absoluteFillObject} />
      )}

      {showHint ? (
        <View style={styles.hintContainer} pointerEvents="none">
          <Text style={styles.hintText}>{hintText}</Text>
        </View>
      ) : null}

      {statusMessage ? (
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {showControls ? (
        <View style={styles.bottomBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => setTorch((prev) => !prev)}
          >
            <MaterialCommunityIcons
              name={torch ? "flashlight" : "flashlight-off"}
              size={26}
              color="#fff"
            />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() =>
              setZoomIndex((prev) => (prev + 1) % zoomLevels.length)
            }
          >
            <MaterialCommunityIcons
              name="magnify-plus"
              size={26}
              color="#fff"
            />
            <Text style={styles.iconButtonText}>
              {zoomLevels[zoomIndex]?.label ?? "Zoom"}
            </Text>
          </Pressable>

          {mode === "manual" ? (
            <Pressable
              style={[
                styles.scanButton,
                scanningEnabled && styles.scanButtonActive,
              ]}
              onPress={scanningEnabled ? stopScanning : startScanning}
            >
              <MaterialCommunityIcons
                name="barcode-scan"
                size={24}
                color="#fff"
              />
              <Text style={styles.scanButtonText}>
                {scanningEnabled ? "Detener" : "Escanear"}
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.scanButton, styles.scanButtonActive]}>
              <MaterialCommunityIcons
                name="barcode-scan"
                size={24}
                color="#fff"
              />
              <Text style={styles.scanButtonText}>Activo</Text>
            </View>
          )}

          {onCancel ? (
            <Pressable
              style={styles.iconButton}
              onPress={() => {
                resetScanner();
                onCancel?.();
              }}
            >
              <MaterialCommunityIcons name="close" size={26} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  permissionText: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 15,
  },

  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },

  cancelPermissionButton: {
    backgroundColor: "#ef4444",
    marginTop: 10,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  hintContainer: {
    position: "absolute",
    bottom: 96,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  hintText: {
    color: "#fff",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    textAlign: "center",
  },

  statusBadge: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  statusText: {
    color: "#fff",
    fontWeight: "700",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    gap: 10,
  },

  iconButton: {
    minWidth: 56,
    minHeight: 56,
    padding: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  iconButtonText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  scanButton: {
    minWidth: 122,
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  scanButtonActive: {
    backgroundColor: "#16a34a",
  },

  scanButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
