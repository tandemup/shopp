import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

import promotions from "@/data/promotions.json";
import { alert, confirm } from "@/src/components/ui/dialog/dialog";
import { useLists } from "@/src/context/ListsContext";
import { formatCurrency } from "@/src/utils/pricing/formatCurrency";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const router = useRouter();
  const { findItemById, updateItem, removeItem } = useLists();

  const found = findItemById(id);

  const item = found?.item;
  const list = found?.list;

  const [name, setName] = useState(item?.name ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "u");
  const [qty, setQty] = useState(String(item?.quantity ?? 1));
  const [price, setPrice] = useState(String(item?.unitPrice ?? 0));
  const [promo, setPromo] = useState(item?.promo ?? "none");

  const quantity = Number(qty.replace(",", ".")) || 1;
  const unitPrice = Number(price.replace(",", ".")) || 0;

  const priceResult = useMemo(() => {
    return calculateItemPrice({
      quantity,
      unitPrice,
      offer: promo,
    });
  }, [quantity, unitPrice, promo]);

  if (!found) {
    return (
      <SafeAreaView style={styles.notFound}>
        <Text>Item no encontrado</Text>
      </SafeAreaView>
    );
  }
  const saveItem = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      await alert("Nombre requerido", "Introduce un nombre para el producto.");
      return;
    }

    updateItem(list.id, {
      ...item,
      name: trimmedName,
      barcode: barcode.trim(),
      unit,
      quantity,
      unitPrice,
      promo,
    });

    router.back();
  };

  const deleteItem = async () => {
    const r = await confirm(
      "Eliminar producto",
      "¿Seguro que quieres eliminar este producto?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive" },
      ],
    );

    if (r === 1) {
      removeItem(list.id, item.id);
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} />
            </Pressable>

            <Text style={styles.title}>Editar producto</Text>

            <View style={{ width: 22 }} />
          </View>

          <Text style={styles.label}>Nombre</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />

          <Text style={styles.label}>Código de barras</Text>
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

          <Text style={styles.label}>Unidad</Text>
          <View style={styles.unitRow}>
            {["u", "kg", "g", "l"].map((u) => (
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

          <View style={styles.rowSpace}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Cantidad ({unit})</Text>
              <TextInput
                style={styles.input}
                value={qty}
                onChangeText={setQty}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Precio/{unit}</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.label}>Ofertas</Text>
          <View style={styles.promoRow}>
            {promotions.map((p: { id: string; label: string }) => (
              <Pressable
                key={p.id}
                style={[
                  styles.promoButton,
                  promo === p.id && styles.promoActive,
                ]}
                onPress={() => setPromo(p.id)}
              >
                <Text
                  style={
                    promo === p.id ? styles.promoTextActive : styles.promoText
                  }
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumen</Text>
            <Text style={styles.summaryLine}>
              Base: {formatCurrency(priceResult.base)}
            </Text>
            <Text style={styles.summaryLine}>
              Ahorro: {formatCurrency(priceResult.savings)}
            </Text>
            <Text style={styles.summaryTotal}>
              Total: {formatCurrency(priceResult.total)}
            </Text>
          </View>

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

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  container: {
    flex: 1,
    backgroundColor: "#f7f7f8",
  },

  content: {
    padding: 16,
    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
    marginTop: 8,
  },

  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  rowSpace: {
    flexDirection: "row",
    gap: 12,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
    alignItems: "center",
    justifyContent: "center",
  },

  unitRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  unitButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  unitActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  unitText: {
    color: "#333",
    fontWeight: "500",
  },

  unitTextActive: {
    color: "#fff",
    fontWeight: "700",
  },

  promoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  promoButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  promoActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  promoText: {
    color: "#333",
    fontWeight: "500",
  },

  promoTextActive: {
    color: "#fff",
    fontWeight: "700",
  },

  summaryCard: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  summaryLine: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 4,
  },

  summaryTotal: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
    color: "#16a34a",
  },

  saveButton: {
    marginTop: 18,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  deleteButton: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef4444",
  },

  deleteText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 16,
  },
});
