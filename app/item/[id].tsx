import promotions from "@/data/promotions.json";
import { alert, confirm } from "@/src/components/ui/dialog/dialog";
import { useLists } from "@/src/context/ListsContext";
import { Promotion } from "@/src/types/Promotion";
import { formatCurrency } from "@/src/utils/currency";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";
import { toPromotion } from "@/src/utils/pricing/PromotionMapper";

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const UNITS = ["u", "kg", "g", "l"];

const parseNumber = (v: string, fallback = 0) => {
  const n = Number((v || "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { findItemById, updateItem, removeItem } = useLists();

  const found = findItemById(id);
  const item = found?.item;
  const list = found?.list;

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unit, setUnit] = useState("u");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("0");
  const [promo, setPromo] = useState<Promotion>({ type: "none" });

  useEffect(() => {
    if (!item) return;

    setName(item.name ?? "");
    setBarcode(item.barcode ?? "");
    setUnit(item.unit ?? "u");
    setQty(String(item.quantity ?? 1));
    setPrice(String(item.unitPrice ?? 0));
    setPromo(item.promo ?? { type: "none" });
  }, [item]);

  const quantity = parseNumber(qty, 1);
  const unitPrice = parseNumber(price, 0);

  const priceResult = useMemo(() => {
    return calculateItemPrice({
      quantity,
      unitPrice,
      promo,
    });
  }, [quantity, unitPrice, promo]);

  if (!item || !list) {
    return (
      <SafeAreaView style={styles.notFound}>
        <Text>Item no encontrado</Text>
      </SafeAreaView>
    );
  }

  const saveItem = async () => {
    if (!name.trim()) {
      await alert("Nombre requerido", "Introduce un nombre.");
      return;
    }

    updateItem(list.id, item.id, {
      name: name.trim(),
      barcode: barcode.trim(),
      unit,
      quantity,
      unitPrice,
      promo,
    });

    router.back();
  };

  const deleteItem = async () => {
    const r = await confirm("Eliminar", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive" },
    ]);

    if (r === 1) {
      removeItem(list.id, item.id);
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* HEADER */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} />
            </Pressable>
            <Text style={styles.title}>Editar producto</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* CARD 1 */}
          <View style={styles.card}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>
              Código de barras
            </Text>

            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="EAN-13"
              />

              <Pressable style={styles.iconButton}>
                <Ionicons name="barcode-outline" size={18} />
              </Pressable>

              <Pressable style={styles.iconButton}>
                <Ionicons name="search-outline" size={18} />
              </Pressable>
            </View>
          </View>

          {/* CARD 2 */}
          <View style={styles.card}>
            <Text style={styles.label}>Unidad</Text>

            <View style={styles.unitRow}>
              {UNITS.map((u) => (
                <Pressable
                  key={u}
                  style={[styles.pill, unit === u && styles.pillActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      unit === u && styles.pillTextActive,
                    ]}
                  >
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={[styles.rowSpace, { marginTop: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cantidad ({unit})</Text>
                <TextInput
                  style={styles.input}
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Precio/{unit}</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* PROMOS */}
          <View style={styles.card}>
            <Text style={styles.label}>Ofertas</Text>

            <View style={styles.promoRow}>
              {promotions.map((option) => {
                const optionPromo = toPromotion(option.id);

                const test = calculateItemPrice({
                  quantity,
                  unitPrice,
                  promo: optionPromo,
                });

                const disabled = !!test.warning;
                const selected = promo.type === optionPromo.type;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setPromo(optionPromo)}
                    style={[
                      styles.promoChip,
                      selected && styles.promoChipSelected,
                      disabled && styles.promoChipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.promoChipText,
                        selected && styles.promoChipTextSelected,
                        disabled && styles.promoChipTextDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* RESUMEN */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumen</Text>

            <Text style={styles.summaryLine}>
              Base: {formatCurrency(priceResult.subtotal)}
            </Text>

            <Text style={styles.summarySavings}>
              Ahorro: {formatCurrency(priceResult.savings)}
            </Text>

            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>
                {formatCurrency(priceResult.total)}
              </Text>
            </View>
          </View>

          {priceResult.warning && (
            <Text style={styles.warning}>{priceResult.warning}</Text>
          )}

          {/* BOTONES */}
          <View style={styles.actions}>
            <Pressable style={styles.saveButton} onPress={saveItem}>
              <Text style={styles.saveText}>Guardar cambios</Text>
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={deleteItem}>
              <Text style={styles.deleteText}>Eliminar producto</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f7" },
  content: { padding: 16, gap: 16 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: { fontSize: 20, fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 2,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },

  input: {
    backgroundColor: "#f7f7f8",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },

  row: { flexDirection: "row", gap: 10 },
  rowSpace: { flexDirection: "row", gap: 12 },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },

  unitRow: { flexDirection: "row", gap: 10 },

  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
  },

  pillActive: { backgroundColor: "#111" },

  pillText: { color: "#6b7280" },
  pillTextActive: { color: "#fff" },

  promoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  promoChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f1f3",
  },

  promoChipSelected: { backgroundColor: "#111" },
  promoChipDisabled: { opacity: 0.35 },

  promoChipText: { color: "#374151" },
  promoChipTextSelected: { color: "#fff" },
  promoChipTextDisabled: { color: "#9ca3af" },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },

  summaryTitle: { fontWeight: "700", fontSize: 17, marginBottom: 8 },
  summaryLine: { color: "#555" },

  summarySavings: {
    color: "#2ecc71",
    fontWeight: "600",
  },

  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  summaryTotalValue: {
    fontSize: 22,
    fontWeight: "800",
  },

  warning: {
    color: "#f59e0b",
    marginTop: 6,
  },

  actions: { marginTop: 16, gap: 12 },

  saveButton: {
    backgroundColor: "#2f6df6",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  saveText: { color: "#fff", fontWeight: "600" },

  deleteButton: {
    borderWidth: 1.5,
    borderColor: "#ef4444",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  deleteText: { color: "#ef4444", fontWeight: "600" },
});
