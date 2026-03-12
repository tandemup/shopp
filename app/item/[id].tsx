import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
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

import { formatCurrency } from "@/src/utils/pricing/formatCurrency";
import { calculatePrice } from "@/src/utils/pricing/priceEngine";

const PROMOTIONS = [
  { id: "none", label: "Sin oferta" },
  { id: "2x1", label: "2x1" },
  { id: "3x2", label: "3x2" },
  { id: "10%", label: "10%" },
  { id: "20%", label: "20%" },
];

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [name, setName] = useState("manzanas");
  const [barcode, setBarcode] = useState("");

  const [unit, setUnit] = useState("kg");

  const [qty, setQty] = useState("2");
  const [price, setPrice] = useState("3.5");

  const [promo, setPromo] = useState("none");

  const quantity = parseFloat(qty) || 0;
  const unitPrice = parseFloat(price) || 0;

  /*
  -----------------------------
  PRICE ENGINE
  -----------------------------
  */

  const priceResult = useMemo(() => {
    return calculatePrice({
      quantity,
      unitPrice,
      promo,
    });
  }, [quantity, unitPrice, promo]);

  /*
  -----------------------------
  EVENTS
  -----------------------------
  */

  const saveItem = () => {
    const item = {
      id,
      name,
      barcode,
      unit,
      quantity,
      unitPrice,
      promo,
    };

    console.log("Saving item:", item);

    /*
    Aquí conectarás con tu store

    updateItem(item)
    */

    router.back();
  };

  const deleteItem = () => {
    Alert.alert(
      "Eliminar producto",
      "¿Seguro que quieres eliminar este producto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            console.log("Deleting item:", id);

            /*
            removeItem(id)
            */

            router.back();
          },
        },
      ],
    );
  };

  /*
  -----------------------------
  UI
  -----------------------------
  */

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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

          {/* NOMBRE */}

          <Text style={styles.label}>Nombre</Text>

          <TextInput style={styles.input} value={name} onChangeText={setName} />

          {/* CODIGO BARRAS */}

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

          {/* UNIDAD */}

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

          {/* CANTIDAD + PRECIO */}

          <View style={styles.rowSpace}>
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

          {/* OFERTAS */}

          <Text style={styles.label}>Ofertas</Text>

          <View style={styles.promoRow}>
            {PROMOTIONS.map((p) => (
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

          {/* TOTAL */}

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total</Text>

            <Text style={styles.totalValue}>
              {formatCurrency(priceResult.total)}
            </Text>

            {priceResult.saving > 0 && (
              <Text style={styles.saving}>
                Ahorro: {formatCurrency(priceResult.saving)}
              </Text>
            )}
          </View>

          {/* BOTONES */}

          <View style={styles.buttons}>
            <Pressable style={styles.saveButton} onPress={saveItem}>
              <Ionicons name="save-outline" size={16} color="#fff" />

              <Text style={styles.saveText}>Guardar</Text>
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={deleteItem}>
              <Ionicons name="trash-outline" size={16} color="#fff" />

              <Text style={styles.deleteText}>Eliminar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },

  content: {
    padding: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
  },

  label: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
    marginTop: 12,
  },

  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
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
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  unitRow: {
    flexDirection: "row",
    gap: 8,
  },

  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },

  unitActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  unitText: {
    color: "#333",
  },

  unitTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  promoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  promoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#e5e5e5",
  },

  promoActive: {
    backgroundColor: "#22c55e",
  },

  promoText: {
    color: "#333",
  },

  promoTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  totalCard: {
    backgroundColor: "#e9e9e9",
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },

  totalLabel: {
    color: "#555",
  },

  totalValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
  },

  saving: {
    color: "#22c55e",
    marginTop: 4,
    fontWeight: "500",
  },

  buttons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  saveButton: {
    flex: 1,
    backgroundColor: "#22c55e",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  deleteButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  saveText: {
    color: "#fff",
    fontWeight: "600",
  },

  deleteText: {
    color: "#fff",
    fontWeight: "600",
  },
});
