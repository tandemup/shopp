import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, Dimensions, Animated } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function BarcodeScanner({
  onScanned,
  onCancel,
  onReenable,
  hideScanArea = false,
  active = true,
  statusMessage = "",
  statusColor = "#2563eb", // por defecto azul
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [torch, setTorch] = useState(false);
  const mounted = useRef(true);

  const { width, height } = Dimensions.get("window");
  const rectHeight = height / 3.5;
  const rectTop = height * 0.35;
  const rectBottom = rectTop + rectHeight;
  const rectLeft = width * 0.1;
  const rectRight = width * 0.9;

  useEffect(() => {
    mounted.current = true;
    if (!permission) requestPermission();
    return () => (mounted.current = false);
  }, [permission]);

  const handleBarcodeScanned = async ({ bounds, data, type }) => {
    if (!scanningEnabled || !active) return;
    const origin = bounds?.origin;
    const size = bounds?.size;
    if (!origin || !size) return;

    const xCenter = origin.x + size.width / 2;
    const yCenter = origin.y + size.height / 2;

    if (
      xCenter > rectLeft &&
      xCenter < rectRight &&
      yCenter > rectTop &&
      yCenter < rectBottom
    ) {
      setScanningEnabled(false);
      onScanned?.({ type, data });
    }
  };

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
        <Text style={{ textAlign: "center", marginBottom: 12 }}>
          No se pudo acceder a la cámara.
        </Text>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => onScanned?.({ type: "mock", data: "8410076470787" })}
        >
          <Text style={styles.secondaryBtnText}>
            Simular escaneo (EAN demo)
          </Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: "#ef4444" }]}
          onPress={onCancel}
        >
          <Text style={styles.primaryBtnText}>Cerrar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
        }}
        onBarcodeScanned={
          active && scanningEnabled ? handleBarcodeScanned : undefined
        }
      />

      {/* 🔲 Zona de escaneo */}
      {!hideScanArea && (
        <View
          style={{
            position: "absolute",
            top: rectTop,
            alignSelf: "center",
            width: width * 0.8,
            height: rectHeight,
            borderWidth: 3,
            borderColor: "#00FF99",
            borderRadius: 10,
            opacity: 0.7,
          }}
        />
      )}

      {/* 💬 Mensaje de estado */}
      {statusMessage ? (
        <View
          style={{
            position: "absolute",
            top: rectTop - 60,
            alignSelf: "center",
            backgroundColor: statusColor,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            opacity: 0.9,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>
            {statusMessage}
          </Text>
        </View>
      ) : null}

      {/* 🎮 Controles inferiores */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          backgroundColor: "rgba(0,0,0,0.45)",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        {/* 🔦 Linterna */}
        <Pressable
          style={styles.iconButton}
          onPress={() => setTorch((t) => !t)}
        >
          <MaterialCommunityIcons
            name={torch ? "flashlight" : "flashlight-off"}
            size={26}
            color="#fff"
          />
        </Pressable>

        {/* 🔁 Reanudar */}
        <Pressable
          style={styles.iconButton}
          onPress={() => {
            setScanningEnabled(true);
            onReenable?.();
          }}
        >
          <MaterialCommunityIcons name="barcode" size={26} color="#fff" />
        </Pressable>

        {/* ❌ Cerrar */}
        <Pressable style={styles.iconButton} onPress={onCancel}>
          <MaterialCommunityIcons name="close" size={26} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = {
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  iconButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  primaryBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
  },
  primaryBtnText: { color: "#fff", fontWeight: "bold" },
  secondaryBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  secondaryBtnText: { color: "#fff", fontWeight: "bold" },
};
