import promotions from "@/data/promotions.json";
import { alert, confirm } from "@/src/components/ui/dialog/dialog";
import { useLists } from "@/src/context/ListsContext";
import { formatCurrency } from "@/src/utils/currency";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";
import {
  fromPromotion,
  toPromotion,
} from "@/src/utils/pricing/promotionMapper";

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
  const n = Number(v.replace(",", "."));
  return Number.isNaN(n) ? fallback : n;
};

function isPromotionValid(promoId: string, qty: number): boolean {
  const promo = promotions.find((p) => p.id === promoId);
  if (!promo || promo.type === "none") return true;

  if (promo.type === "multi") {
    return qty >= (promo.buy ?? 0);
  }

  return true;
}

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
  const [promoId, setPromoId] = useState<string>("none");

  useEffect(() => {
    if (!item) return;

    setName(item.name ?? "");
    setBarcode(item.barcode ?? "");
    setUnit(item.unit ?? "u");
    setQty(String(item.quantity ?? 1));
    setPrice(String(item.unitPrice ?? 0));

    setPromoId(fromPromotion(item.promo));
  }, [item]);

  const quantity = parseNumber(qty, 1);
  const unitPrice = parseNumber(price, 0);

  const promo = useMemo(() => toPromotion(promoId), [promoId]);

  useEffect(() => {
    if (!isPromotionValid(promoId, quantity)) {
      setPromoId("none");
    }
  }, [promoId, quantity]);

  const priceResult = useMemo(() => {
    if (!item) {
      return {
        baseTotal: 0,
        finalTotal: 0,
        savings: 0,
      };
    }

    return calculateItemPrice({
      ...item,
      quantity,
      unitPrice,
      promo,
    });
  }, [item, quantity, unitPrice, promo]);

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
      promo: toPromotion(promoId),
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
                  style={[styles.unitButton, unit === u && styles.unitActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text
                    style={unit === u ? styles.unitTextActive : styles.unitText}
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
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Precio/{unit}</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
            </View>
          </View>

          {/* CARD PROMOS */}
          <View style={styles.card}>
            <Text style={styles.label}>Ofertas</Text>

            <View style={styles.promoRow}>
              {promotions.map((p) => {
                const valid = isPromotionValid(p.id, quantity);

                return (
                  <Pressable
                    key={p.id}
                    disabled={!valid}
                    onPress={() => setPromoId(p.id)}
                    style={[
                      styles.chip,
                      promoId === p.id && styles.chipActive,
                      !valid && styles.chipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        promoId === p.id && styles.chipTextActive,
                        !valid && styles.chipTextDisabled,
                      ]}
                    >
                      {p.label}
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
              Base: {formatCurrency(priceResult.baseTotal)}
            </Text>

            <Text style={styles.summarySavings}>
              Ahorro: {formatCurrency(priceResult.savings)}
            </Text>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>
                {formatCurrency(priceResult.finalTotal)}
              </Text>
            </View>
          </View>

          {/* BOTONES */}
          <Pressable style={styles.saveButton} onPress={saveItem}>
            <Text style={styles.saveText}>Guardar cambios</Text>
          </Pressable>

          <Pressable style={styles.deleteButton} onPress={deleteItem}>
            <Text style={styles.deleteText}>Eliminar producto</Text>
          </Pressable>
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
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
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

  unitRow: { flexDirection: "row", gap: 8 },

  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },

  unitActive: { backgroundColor: "#111" },

  unitText: { color: "#333" },
  unitTextActive: { color: "#fff" },

  promoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f1f3",
  },

  chipActive: { backgroundColor: "#111" },
  chipDisabled: { opacity: 0.35 },

  chipText: { color: "#333" },
  chipTextActive: { color: "#fff" },
  chipTextDisabled: { color: "#999" },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  summarySavings: {
    fontSize: 14,
    color: "#2ecc71", // verde éxito
    fontWeight: "600",
  },
  summaryTitle: { fontWeight: "600", marginBottom: 8 },
  summaryLine: { color: "#555" },
  summaryTotal: { fontSize: 20, fontWeight: "800", marginTop: 6 },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },

  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
  },

  summaryTotalValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  saveButton: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  saveText: { color: "#fff", fontWeight: "700" },

  deleteButton: {
    marginTop: 12,
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",

    borderWidth: 1.5,
    borderColor: "#ff3b30", // rojo iOS
  },
  deleteText: {
    color: "#ff3b30",
    fontWeight: "600",
    fontSize: 16,
  },
});
