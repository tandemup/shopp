import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function StoreSelector({ store, onPress, disabled = false }) {
  const content = (
    <>
      <Ionicons
        name="storefront"
        size={20}
        color={disabled ? "#999" : "#007bff"}
      />

      <View style={styles.middleColumn}>
        <Text style={styles.label}>Tienda seleccionada</Text>

        {store ? (
          <>
            <Text style={[styles.name, disabled && styles.disabledText]}>
              {store.name}
            </Text>

            {!!store.address && (
              <Text style={[styles.address, disabled && styles.disabledText]}>
                {store.address}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.placeholder, disabled && styles.disabledText]}>
            Seleccionar tienda
          </Text>
        )}
      </View>

      {!disabled && <Ionicons name="chevron-forward" size={20} color="#777" />}
    </>
  );

  if (disabled) {
    return <View style={[styles.box, styles.disabledBox]}>{content}</View>;
  }

  return (
    <TouchableOpacity style={styles.box} onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginHorizontal: 16,
    marginTop: 12,

    // sombra iOS
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },

    // sombra Android
    elevation: 2,
  },

  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  disabledBox: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },

  middleColumn: {
    marginLeft: 12,
    flex: 1,
  },

  label: {
    fontSize: 12,
    color: "#777",
    marginBottom: 2,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },

  address: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },

  placeholder: {
    fontSize: 16,
    color: "#999",
  },

  disabledText: {
    color: "#9ca3af",
  },
});
