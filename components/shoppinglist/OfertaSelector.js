// components/OfertaSelector.js — versión estable sin gap

// OfertaSelector.js — estable con estado local + memo

import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { PricingEngine, PROMOTIONS, NO_PROMO } from "../utils/pricing";

function OfertaSelector({ expanded, promo, onToggle, onSelect }) {
  const [localPromo, setLocalPromo] = useState(promo);

  useEffect(() => {
    setLocalPromo(promo);
  }, [promo]);

  const handleSelect = (key) => {
    setLocalPromo(key); // solo re-renderiza este componente
    onSelect(key); // actualiza el padre
  };

  return (
    <>
      <Pressable onPress={onToggle} style={styles.header}>
        <Text style={styles.title}>🎁 Ofertas</Text>
        <Text>{expanded ? "▲" : "▼"}</Text>
      </Pressable>

      {expanded && (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.hint}>Selecciona una promoción:</Text>

          <View style={styles.row}>
            {Object.entries(PROMOTIONS).map(([key, p]) => (
              <Pressable
                key={key}
                onPress={() => handleSelect(key)}
                style={[styles.btn, localPromo === key && styles.active]}
              >
                <Text
                  style={[styles.text, localPromo === key && styles.textActive]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

export default React.memo(OfertaSelector);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  title: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 13, marginBottom: 6 },
  summary: { marginTop: 4, fontSize: 13 },

  row: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  btn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    marginRight: 6, // 👈 reemplaza gap
    marginBottom: 6, // 👈 wrap estable
  },

  active: {
    backgroundColor: "#2563EB",
  },

  text: {
    fontWeight: "600",
    color: "#475569",
  },

  textActive: {
    color: "#fff",
  },
});
