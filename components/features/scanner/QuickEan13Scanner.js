// components/features/scanner/QuickEan13Scanner.js

import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";

import { CameraView, useCameraPermissions } from "expo-camera";

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function normalizeEan13(value) {
  const code = String(value || "")
    .replace(/\D/g, "")
    .trim();

  return code.length === 13 ? code : null;
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

/* -------------------------------------------------
   Component
-------------------------------------------------- */

export default function QuickEan13Scanner({ onDetected, onCancel }) {
  const isFocused = useIsFocused();

  const [permission, requestPermission] = useCameraPermissions();

  const lockedRef = useRef(false);

  const [mountError, setMountError] = useState("");

  const [cameraKey, setCameraKey] = useState(0);

  useEffect(() => {
    if (isFocused) {
      lockedRef.current = false;
      setMountError("");
    }

    return () => {
      lockedRef.current = false;
    };
  }, [isFocused]);

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      if (lockedRef.current) {
        return;
      }

      const barcode = normalizeEan13(data);

      if (!barcode) {
        return;
      }

      if (!isValidEan13(barcode)) {
        return;
      }

      lockedRef.current = true;

      onDetected?.(barcode);
    },
    [onDetected],
  );

  function handleRetry() {
    lockedRef.current = false;
    setMountError("");
    setCameraKey((previous) => {
      return previous + 1;
    });
  }

  function handleClose() {
    lockedRef.current = false;

    onCancel?.();
  }

  function handleCameraMountError(event) {
    console.log("Quick EAN-13 camera mount error:", event?.message);

    setMountError(
      "No se pudo iniciar la cámara. Comprueba los permisos e inténtalo de nuevo.",
    );
  }

  /* -------------------------------------------------
     Permissions
  -------------------------------------------------- */

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFFFFF" />

        <Text style={styles.message}>Preparando cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={44} color="#64748B" />

        <Text style={styles.permissionTitle}>Permiso de cámara necesario</Text>

        <Text style={styles.permissionText}>
          Permite el acceso a la cámara para leer el código EAN-13 del producto.
        </Text>

        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir cámara</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={handleClose}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  /* -------------------------------------------------
     Camera
  -------------------------------------------------- */

  return (
    <View style={styles.container}>
      {isFocused ? (
        <CameraView
          key={cameraKey}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          autofocus="on"
          /*
           * Has comprobado que un pequeño zoom mejora
           * la lectura en tu dispositivo.
           */
          zoom={0.15}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13"],
          }}
          onMountError={handleCameraMountError}
          onBarcodeScanned={
            lockedRef.current ? undefined : handleBarcodeScanned
          }
        />
      ) : null}

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

          {mountError ? (
            <>
              <Text style={styles.errorText}>{mountError}</Text>

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
    backgroundColor: "#000000",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#000000",
  },

  message: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  permissionScreen: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
  },

  permissionTitle: {
    marginTop: 14,
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  permissionText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },

  primaryButton: {
    width: "100%",
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  secondaryButton: {
    width: "100%",
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#E5E7EB",
  },

  secondaryButtonText: {
    color: "#374151",
    fontWeight: "700",
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
    backgroundColor: "rgba(0,0,0,0.62)",
  },

  middle: {
    alignItems: "center",
    justifyContent: "center",
  },

  scanFrame: {
    width: "88%",
    height: 132,
    borderWidth: 3,
    borderRadius: 16,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  scanLine: {
    height: 2,
    marginHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  hint: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
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
    marginTop: 6,
    color: "#D1D5DB",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  errorText: {
    marginTop: 12,
    color: "#FCA5A5",
    fontWeight: "700",
    textAlign: "center",
  },

  retryButton: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
