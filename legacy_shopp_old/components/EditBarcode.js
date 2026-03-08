// components/EditBarcode.js

import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";

export default function EditBarcode({ barcode, setBarcode, style }) {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>Barcode</Text>
      <TextInput
        style={styles.input}
        value={barcode}
        onChangeText={setBarcode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12, // 👈 separación uniforme
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
});
