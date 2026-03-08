// components/UnidadSelector.js

import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { UNIT_TYPES } from "../constants/unitTypes";

function UnidadSelector({ unitType, onChange }) {
  const [localUnit, setLocalUnit] = useState(unitType);

  // Mantener sincronizado cuando viene de fuera (por ejemplo al cargar item)
  useEffect(() => {
    setLocalUnit(unitType);
  }, [unitType]);

  const handleSelect = (key) => {
    setLocalUnit(key); // actualiza SOLO este componente
    onChange(key); // envía al padre
  };

  return (
    <View>
      <Text style={styles.label}>Unidad</Text>

      <View style={styles.row}>
        {UNIT_TYPES.map((u) => {
          const active = localUnit === u.key;

          return (
            <Pressable
              key={u.key}
              onPress={() => handleSelect(u.key)}
              style={[styles.btn, active && styles.active]}
            >
              <Text style={[styles.text, active && styles.textActive]}>
                {u.emoji} {u.key}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default React.memo(UnidadSelector);

const styles = StyleSheet.create({
  label: { fontWeight: "600", marginBottom: 4 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    marginRight: 8, // 👈 reemplaza gap
    marginBottom: 8, // 👈 mantiene wrap estable
  },
  active: {
    backgroundColor: "#2563EB",
  },
  text: {
    color: "#475569",
    fontWeight: "600",
  },
  textActive: {
    color: "#fff",
  },
});
