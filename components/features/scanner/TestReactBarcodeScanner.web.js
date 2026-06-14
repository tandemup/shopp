// components/features/scanner/TestReactBarcodeScanner.web.js

import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

import { BarcodeScanner } from "react-barcode-scanner";
import "react-barcode-scanner/polyfill";

export default function TestReactBarcodeScannerWeb({ onDetected, onClose }) {
  const [lastCode, setLastCode] = useState("");
  const [paused, setPaused] = useState(false);

  const handleCapture = useCallback(
    (barcodes) => {
      const first = Array.isArray(barcodes) ? barcodes[0] : null;
      const rawValue =
        first?.rawValue || first?.raw_value || first?.value || "";

      const code = String(rawValue || "").trim();

      console.log("react-barcode-scanner capture:", barcodes);

      if (!code) return;

      setLastCode(code);

      if (/^\d{13}$/.test(code)) {
        setPaused(true);
        onDetected?.(code);
      }
    },
    [onDetected],
  );

  return (
    <View style={styles.root}>
      <View style={styles.cameraBox}>
        <BarcodeScanner
          paused={paused}
          options={{
            formats: ["ean_13"],
            delay: 300,
          }}
          trackConstraints={{
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }}
          onCapture={handleCapture}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Prueba react-barcode-scanner</Text>
        <Text style={styles.text}>
          Último código: {lastCode || "sin lectura"}
        </Text>

        <View style={styles.row}>
          <Pressable
            style={styles.button}
            onPress={() => {
              setLastCode("");
              setPaused(false);
            }}
          >
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>

          <Pressable style={styles.buttonSecondary} onPress={onClose}>
            <Text style={styles.buttonText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraBox: {
    flex: 1,
    width: "100%",
    minHeight: 360,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  panel: {
    padding: 16,
    backgroundColor: "#111827",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  text: {
    color: "#d1d5db",
    fontSize: 15,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#16a34a",
  },
  buttonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#374151",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
