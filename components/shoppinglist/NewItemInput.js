import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";

export default function NewItemInput({ onAdd }) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const name = value.trim();
    if (!name) return;

    onAdd(name); // ✅ nombre correcto
    setValue(""); // limpiar input
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Añadir producto..."
        placeholderTextColor="#999"
        value={value}
        onChangeText={setValue}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />

      <TouchableOpacity style={styles.addBtn} onPress={handleSubmit}>
        <Text style={styles.addBtnText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ----- Estilos -----
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "white",
  },
  addBtn: {
    marginLeft: 8,
    backgroundColor: "#4CAF50",
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
    marginTop: -2,
  },
});
