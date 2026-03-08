import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import ScannerControls from "./ScannerControls";
import { EAN_ZOOM, getZoomValue } from "../constants/cameraZoom";

const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"];

export default function BarcodeScannerEAN13({
  onDetected,
  showControls = true,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);

  const zoom = getZoomValue(EAN_ZOOM, zoomIndex);

  /* -----------------------------------------
     🔐 PERMISOS
  ------------------------------------------ */
  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission || !permission.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionText}>
          Se necesita acceso a la cámara
        </Text>
        <Pressable style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Permitir cámara</Text>
        </Pressable>
      </View>
    );
  }

  /* -----------------------------------------
     🖥 RENDER
  ------------------------------------------ */
  return (
    <View style={styles.container}>
      {/* Cámara */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
        enableTorch={torch}
        zoom={zoom}
        barcodeScannerSettings={{
          barcodeTypes: BARCODE_TYPES,
        }}
        onBarcodeScanned={({ data }) => {
          if (scanned) return;
          setScanned(true);
          onDetected?.(data);
          setTimeout(() => setScanned(false), 800);
        }}
      />

      {/* Texto de ayuda */}
      <View style={styles.hintContainer} pointerEvents="none">
        <Text style={styles.hintText}>Apunta al código de barras (EAN-13)</Text>
      </View>

      {/* Controles reutilizados */}
      {showControls && (
        <ScannerControls
          torch={torch}
          zoomIndex={zoomIndex}
          zoomLabels={EAN_ZOOM.labels}
          onToggleTorch={() => setTorch((v) => !v)}
          onZoomPress={() =>
            setZoomIndex((i) => (i + 1) % EAN_ZOOM.levels.length)
          }
        />
      )}
    </View>
  );
}

/* -----------------------------------------
   🎨 ESTILOS
------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  hintContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
  },
  hintText: {
    color: "#fff",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  permission: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionText: {
    fontSize: 15,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
});
