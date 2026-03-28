import UNITS from "@/data/units.json";
import { alert, confirm } from "@/src/components/ui/dialog/dialog";
import { useLists } from "@/src/context/ListsContext";
import type { Promotion } from "@/src/types/Promotion";
import { formatCurrency } from "@/src/utils/currency";
import {
  calculateItemPrice,
  validatePromotion,
} from "@/src/utils/pricing/pricing";

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

//const promotions = rawPromotions as PromotionOption[];
//const UNITS = ["u", "kg", "g", "l"] as const;

const parseNumber = (v: string, fallback = 0) => {
  const n = Number((v || "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

const isSamePromotion = (
  a: Promotion | undefined,
  b: Promotion | undefined,
): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;

  if (a.type !== b.type) return false;

  switch (a.type) {
    case "none":
    case "2x1":
    case "3x2":
      return true;

    case "percent":
    case "discount":
      return a.value === (b as typeof a).value;

    case "multi":
      return a.buy === (b as typeof a).buy && a.pay === (b as typeof a).pay;

    default:
      return false;
  }
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
    return calculateItemPrice({ quantity, unitPrice, promo });
  }, [quantity, unitPrice, promo]);

  if (!item || !list) {
    return (
      <SafeAreaView style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Producto no encontrado</Text>
        <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
          <Text style={styles.notFoundButtonText}>Volver</Text>
        </Pressable>
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

  const promoValidation = validatePromotion(promo, quantity, unitPrice);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable style={styles.headerIcon} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.title}>Editar producto</Text>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nombre del producto"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, styles.sectionGap]}>
              Código de barras
            </Text>

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="EAN-13"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable style={styles.iconButton}>
                <Ionicons name="barcode-outline" size={18} color="#374151" />
              </Pressable>

              <Pressable style={styles.iconButton}>
                <Ionicons name="search-outline" size={18} color="#374151" />
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Unidad</Text>

            <View style={styles.unitRow}>
              {UNITS.map((u) => {
                const selected = unit === u;

                return (
                  <Pressable
                    key={u}
                    style={[styles.pill, selected && styles.pillActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selected && styles.pillTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.rowSpace, styles.sectionGapLarge]}>
              <View style={styles.flex}>
                <Text style={styles.label}>Cantidad ({unit})</Text>
                <TextInput
                  style={styles.input}
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.flex}>
                <Text style={styles.label}>Precio/{unit}</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ofertas</Text>

            <View style={styles.promoWrap}>
              {promotions.map((option) => {
                const validation = validatePromotion(
                  option.promo,
                  quantity,
                  unitPrice,
                );

                const disabled = !validation.valid;
                const selected = isSamePromotion(promo, option.promo);

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      if (!validation.valid) return;
                      setPromo(option.promo);
                    }}
                    disabled={disabled}
                    style={[
                      styles.promoChip,
                      selected && styles.promoChipSelected,
                      !validation.valid && styles.promoChipDisabled,
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

            {!promoValidation.valid && (
              <View style={styles.offerWarningBox}>
                <Text style={styles.offerWarning}>
                  {promoValidation.message ?? "Oferta no válida"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumen</Text>

            <Text style={styles.summaryLine}>
              Base: {formatCurrency(priceResult.baseTotal)}
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

          {!priceResult.valid && (
            <Text style={styles.warning}>
              {priceResult.reason || "Oferta no válida"}
            </Text>
          )}

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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },

  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 28,
  },

  notFound: {
    flex: 1,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },

  notFoundTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  notFoundButton: {
    backgroundColor: "#2f6df6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },

  notFoundButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpacer: {
    width: 28,
    height: 28,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ececec",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },

  sectionGap: {
    marginTop: 12,
  },

  sectionGapLarge: {
    marginTop: 14,
  },

  input: {
    backgroundColor: "#f7f7f8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#eee",
    fontSize: 15,
    color: "#111827",
  },
  promoWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  rowSpace: {
    flexDirection: "row",
    gap: 12,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },

  unitRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  offerWarningBox: {
    marginTop: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  offerWarning: {
    fontSize: 12,
    color: "#ea580c",
    fontWeight: "600",
  },
  pill: {
    minWidth: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },

  pillActive: {
    backgroundColor: "#111",
  },

  pillText: {
    color: "#6b7280",
    fontWeight: "600",
  },

  pillTextActive: {
    color: "#fff",
  },

  promoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  promoChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f1f3",
  },

  promoChipSelected: {
    backgroundColor: "#111",
  },

  promoChipDisabled: {
    backgroundColor: "#f3f4f6",
    opacity: 0.6,
  },

  promoChipText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },

  promoChipTextSelected: {
    color: "#fff",
  },

  promoChipTextDisabled: {
    color: "#9ca3af",
  },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },

  summaryTitle: {
    fontWeight: "700",
    fontSize: 17,
    marginBottom: 10,
    color: "#111827",
  },

  summaryLine: {
    fontSize: 14,
    color: "#6b7280",
  },

  summarySavings: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
    marginTop: 2,
  },

  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },

  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },

  summaryTotalValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  warning: {
    color: "#f59e0b",
    marginTop: -6,
    fontSize: 13,
    fontWeight: "600",
  },

  actions: {
    marginTop: 8,
    gap: 12,
  },

  saveButton: {
    backgroundColor: "#2f6df6",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },

  deleteButton: {
    borderWidth: 1.5,
    borderColor: "#ef4444",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#fff",
  },

  deleteText: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 15,
  },
});
