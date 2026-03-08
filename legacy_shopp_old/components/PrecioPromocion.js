import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";

import { parseReal, normalizeReal } from "../utils/number";
import { PricingEngine, PROMOTIONS, NO_PROMO } from "../utils/pricing";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const UNIT_TYPES = ["u", "kg", "l"];

export default function PrecioPromocion({ value, onChange }) {
  const [expanded, setExpanded] = useState(false);

  // ────────────────────────────────────────────────
  // 🔒 UPDATE INMUTABLE (CLAVE)
  // ────────────────────────────────────────────────
  const update = (patch) => {
    const base = {
      ...value,
      ...patch,
    };

    const p = parseReal(base.unitPrice);
    const q = parseReal(base.qty);

    const { total, warning, label } = calcularPromoTotal(
      base.promo ?? "none",
      p,
      q
    );

    const promoLabel = base.promo !== "none" ? ` (${label})` : "";

    const next = {
      ...base,
      total,
      warning,
      summary: `${q} × ${p.toFixed(2)} €${promoLabel} = ${total.toFixed(2)} €`,
    };

    onChange(next);
  };

  // ────────────────────────────────────────────────
  // VARIABLES DERIVADAS (SIN ESTADO LOCAL)
  // ────────────────────────────────────────────────
  const unitType = value?.unitType ?? "u";
  const qty = String(value?.qty ?? "1");
  const unitPrice = String(value?.unitPrice ?? "");
  const promo = value?.promo ?? "none";

  const total = value?.total ?? 0;
  const summary = value?.summary ?? "";
  const warning = value?.warning ?? null;

  // ────────────────────────────────────────────────
  // UI
  // ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Unidad */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.label}>Unidad</Text>

        <View style={styles.selectorRow}>
          {UNIT_TYPES.map((u) => {
            const emoji = u === "kg" ? "⚖️" : u === "l" ? "🧃" : "🧩";
            const active = unitType === u;

            return (
              <Pressable
                key={u}
                style={[styles.selectorBtn, active && styles.selectorBtnActive]}
                onPress={() => update({ unitType: u })}
              >
                <Text
                  style={[
                    styles.selectorText,
                    active && styles.selectorTextActive,
                  ]}
                >
                  {emoji} {u}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.unitHint}>🧩 unidad ⚖️ kilo 🧃 litro</Text>
      </View>

      {/* Cantidad + Precio */}
      <View style={styles.row}>
        <View style={styles.halfBox}>
          <Text style={styles.label}>Cantidad ({unitType})</Text>
          <TextInput
            style={[styles.input, styles.bigInput]}
            keyboardType="decimal-pad"
            value={qty}
            onChangeText={(t) => update({ qty: normalizeReal(t) })}
            onBlur={() => {
              const v = parseReal(qty);
              if (!isNaN(v)) update({ qty: v.toString() });
            }}
            placeholder="0"
          />
        </View>

        <View style={[styles.halfBox, { marginLeft: 10 }]}>
          <Text style={styles.label}>Precio unitario (€/{unitType})</Text>
          <TextInput
            style={[styles.input, styles.bigInput]}
            keyboardType="decimal-pad"
            value={unitPrice}
            onChangeText={(t) => update({ unitPrice: normalizeReal(t) })}
            onBlur={() => {
              const v = parseReal(unitPrice);
              if (!isNaN(v)) update({ unitPrice: v.toFixed(2) });
            }}
            placeholder="0.00"
          />
        </View>
      </View>

      {/* Ofertas */}
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded((prev) => !prev);
        }}
        style={styles.offerHeader}
      >
        <Text style={styles.sectionTitle}>🎁 Ofertas</Text>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>

      {!expanded && promo !== "none" && (
        <Text style={styles.activePromoText}>
          Oferta seleccionada: {PROMOTIONS[promo]?.label}
        </Text>
      )}

      {expanded && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionHint}>Selecciona una promoción:</Text>

          <View style={styles.selectorRow}>
            {Object.entries(PROMOTIONS).map(([key, p]) => {
              const active = promo === key;

              return (
                <Pressable
                  key={key}
                  style={[
                    styles.selectorBtn,
                    active && styles.selectorBtnActive,
                  ]}
                  onPress={() => update({ promo: key })}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      active && styles.selectorTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Total */}
      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Total: {total.toFixed(2)} €</Text>
        {summary ? <Text style={styles.totalDetail}>{summary}</Text> : null}
        {warning && <Text style={styles.totalWarning}>⚠️ {warning}</Text>}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────
// 🎨 ESTILOS
// ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { paddingVertical: 4 },

  row: { flexDirection: "row", justifyContent: "space-between" },
  halfBox: { flex: 1 },

  label: { fontSize: 14, fontWeight: "600", marginBottom: 4, color: "#333" },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    backgroundColor: "white",
  },
  bigInput: { fontSize: 18 },

  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  selectorBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  selectorBtnActive: { backgroundColor: "#2563EB" },
  selectorText: { color: "#475569", fontWeight: "600" },
  selectorTextActive: { color: "#ffffff" },

  unitHint: { fontSize: 12, textAlign: "center", marginTop: 4 },

  offerHeader: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  chevron: { fontSize: 14 },

  activePromoText: { fontSize: 13, marginTop: 2, marginBottom: 6 },

  sectionHint: { fontSize: 13, marginBottom: 8 },

  totalBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#E3F2FD",
    borderColor: "#BBDEFB",
  },

  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalDetail: { marginTop: 4, fontSize: 13 },
  totalWarning: { marginTop: 6, color: "#b91c1c", fontSize: 13 },
});
