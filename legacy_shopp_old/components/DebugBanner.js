// components/DebugBanner.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CONFIG } from "../constants/config";

export default function DebugBanner() {
  if (!CONFIG.DEBUG_MODE) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>🪲 DEBUG MODE ACTIVADO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "orange",
    paddingVertical: 4,
    alignItems: "center",
  },
  text: {
    color: "white",
    fontWeight: "bold",
  },
});
