// components/CantidadPrecioInputs.js — optimizado

import React from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";

export default function CantidadPrecioInputs({
  unitType,
  qty,
  unitPrice,
  onQtyChange,
  onUnitPriceChange,
  onQtyBlur,
  onUnitPriceBlur,
}) {
  return (
    <View style={styles.row}>
      <View style={styles.half}>
        <Text style={styles.label}>Cantidad ({unitType})</Text>
        <TextInput
          style={styles.input}
          keyboardType={Platform.OS === "web" ? "default" : "decimal-pad"}
          value={qty}
          onChangeText={onQtyChange}
          onBlur={onQtyBlur}
          placeholder="0"
        />
      </View>

      <View style={styles.half}>
        <Text style={styles.label}>Precio unitario (€/{unitType})</Text>
        <TextInput
          style={styles.input}
          keyboardType={Platform.OS === "web" ? "default" : "decimal-pad"}
          value={unitPrice}
          onChangeText={onUnitPriceChange}
          onBlur={onUnitPriceBlur}
          placeholder="0.00"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  half: { flex: 1 },
  label: { fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
});
