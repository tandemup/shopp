// components/UnifiedBarcodeScannerBase.js

import React, { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { CameraView, useCameraPermissions } from "expo-camera";

import {
  DEFAULT_SCANNER_ZOOM,
  MAX_SCANNER_ZOOM,
  MIN_SCANNER_ZOOM,
  SCANNER_ZOOM_STEP,
  loadScannerZoom,
  normalizeScannerZoom,
  resetScannerZoom,
  saveScannerZoom,
} from "../utils/scannerZoomStorage";

export default function UnifiedBarcodeScannerBase({
  onBarcodeScanned,
  onClose,
  title = "Escanear código de barras",
  subtitle = "Acerca la cámara a un código EAN-13",
}) {
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraZoom, setCameraZoom] = useState(DEFAULT_SCANNER_ZOOM);

  const [hasScanned, setHasScanned] = useState(false);
  const [isLoadingZoom, setIsLoadingZoom] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreZoom = async () => {
      const storedZoom = await loadScannerZoom();

      if (isMounted) {
        setCameraZoom(storedZoom);
        setIsLoadingZoom(false);
      }
    };

    restoreZoom();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateZoom = useCallback(async (nextValue) => {
    const normalizedValue = normalizeScannerZoom(nextValue);

    setCameraZoom(normalizedValue);
    await saveScannerZoom(normalizedValue);
  }, []);

  const decreaseZoom = useCallback(() => {
    updateZoom(cameraZoom - SCANNER_ZOOM_STEP);
  }, [cameraZoom, updateZoom]);

  const increaseZoom = useCallback(() => {
    updateZoom(cameraZoom + SCANNER_ZOOM_STEP);
  }, [cameraZoom, updateZoom]);

  const restoreDefaultZoom = useCallback(async () => {
    const restoredZoom = await resetScannerZoom();
    setCameraZoom(restoredZoom);
  }, []);

  const handleBarcodeScanned = useCallback(
    (result) => {
      if (hasScanned) return;

      setHasScanned(true);

      if (typeof onBarcodeScanned === "function") {
        onBarcodeScanned(result);
      }
    },
    [hasScanned, onBarcodeScanned],
  );

  const scanAgain = useCallback(() => {
    setHasScanned(false);
  }, []);

  if (!permission || isLoadingZoom) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Preparando la cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={50} color="#374151" />

          <Text style={styles.permissionTitle}>
            Permiso de cámara necesario
          </Text>

          <Text style={styles.permissionText}>
            Debes permitir el acceso a la cámara para leer códigos de barras.
          </Text>

          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Permitir acceso</Text>
          </Pressable>

          {typeof onClose === "function" && (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        zoom={cameraZoom}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13"],
        }}
        onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
      />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {typeof onClose === "function" && (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          )}
        </View>

        <View style={styles.scannerArea}>
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />

            <View style={[styles.corner, styles.cornerTopRight]} />

            <View style={[styles.corner, styles.cornerBottomLeft]} />

            <View style={[styles.corner, styles.cornerBottomRight]} />

            {hasScanned && (
              <View style={styles.successOverlay}>
                <Ionicons name="checkmark-circle" size={82} color="#39FF14" />

                <Text style={styles.successText}>Código detectado</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.zoomTitle}>Zoom de la cámara</Text>

          <Text style={styles.zoomValue}>{Math.round(cameraZoom * 100)} %</Text>

          <View style={styles.zoomControls}>
            <Pressable
              onPress={decreaseZoom}
              disabled={cameraZoom <= MIN_SCANNER_ZOOM}
              style={({ pressed }) => [
                styles.zoomIconButton,
                cameraZoom <= MIN_SCANNER_ZOOM && styles.disabledButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="remove" size={24} color="#FFFFFF" />
            </Pressable>

            <Pressable
              onPress={restoreDefaultZoom}
              style={({ pressed }) => [
                styles.restoreButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />

              <Text style={styles.restoreButtonText}>Restaurar</Text>
            </Pressable>

            <Pressable
              onPress={increaseZoom}
              disabled={cameraZoom >= MAX_SCANNER_ZOOM}
              style={({ pressed }) => [
                styles.zoomIconButton,
                cameraZoom >= MAX_SCANNER_ZOOM && styles.disabledButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {hasScanned && (
            <Pressable
              onPress={scanAgain}
              style={({ pressed }) => [
                styles.scanAgainButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="scan-outline" size={18} color="#111827" />

              <Text style={styles.scanAgainButtonText}>
                Escanear otro código
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },

  loadingText: {
    color: "#374151",
    fontSize: 15,
  },

  permissionScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#F3F4F6",
  },

  permissionCard: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },

  permissionTitle: {
    marginTop: 14,
    color: "#111827",
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },

  permissionText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },

  primaryButton: {
    width: "100%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },

  secondaryButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },

  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  subtitle: {
    marginTop: 3,
    color: "#E5E7EB",
    fontSize: 13,
  },

  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },

  scannerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  scannerFrame: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: 1.55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },

  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: "#39FF14",
  },

  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 14,
  },

  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 14,
  },

  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 14,
  },

  cornerBottomRight: {
    right: -2,
    bottom: -2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 14,
  },

  successOverlay: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },

  successText: {
    marginTop: 4,
    color: "#39FF14",
    fontSize: 15,
    fontWeight: "700",
  },

  bottomPanel: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },

  zoomTitle: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  zoomValue: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
  },

  zoomIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },

  restoreButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },

  restoreButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.35,
  },

  buttonPressed: {
    opacity: 0.65,
  },

  scanAgainButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },

  scanAgainButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
});
