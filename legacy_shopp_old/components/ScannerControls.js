import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Controles overlay para cámara
 * - Flash
 * - Zoom
 * - Badge EAN
 */
export default function ScannerControls({
  torch,
  onToggleTorch,
  zoomIndex,
  zoomLabels = ["1x", "2x", "3x"],
  onZoomPress,
}) {
  return (
    <View style={styles.controls} pointerEvents="box-none">
      {/* Flash */}
      <Pressable style={styles.controlBtn} onPress={onToggleTorch}>
        <Ionicons name={torch ? "flash" : "flash-off"} size={22} color="#fff" />
      </Pressable>

      {/* Zoom */}
      <Pressable style={styles.controlBtn} onPress={onZoomPress}>
        <Text style={styles.zoomText}>
          {zoomLabels[zoomIndex] ?? zoomLabels[0]}
        </Text>
      </Pressable>

      {/* Badge */}
      <View style={styles.eanBadge}>
        <Ionicons name="barcode" size={18} color="#22c55e" />
        <Text style={styles.eanText}>EAN</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    position: "absolute",
    top: 110,
    right: 16,
    alignItems: "center",
    gap: 16,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomText: {
    color: "#fff",
    fontWeight: "700",
  },
  eanBadge: {
    alignItems: "center",
    marginTop: 4,
  },
  eanText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "600",
  },
});
