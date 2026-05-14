// screens/scanner/EditScannedItemScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import {
  updateScannedEntry,
  removeScannedItem,
} from "../../services/scannerHistory";
import { SafeAreaView } from "react-native-safe-area-context";
import { safeAlert } from "../../components/ui/alert/safeAlert";
import { createThumbnail } from "../../utils/createThumbnail";
import BarcodeLink from "../../components/controls/BarcodeLink";
import { lookupProductByBarcode } from "../../services/productLookup";

export default function EditScannedItemScreen({ route, navigation }) {
  const { item } = route.params || {};

  const barcode = item?.barcode ?? "";

  const [name, setName] = useState(item?.name ?? "");
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [thumbnailUri, setThumbnailUri] = useState(item?.thumbnailUri ?? null);

  const handleImageUrlBlur = async () => {
    if (!imageUrl || imageUrl === item?.imageUrl) return;

    try {
      const thumb = await createThumbnail(imageUrl, barcode);
      if (thumb) setThumbnailUri(thumb);
    } catch (error) {
      console.log("Error creating thumbnail:", error);
    }
  };
  const handleLookupProduct = async () => {
    if (!barcode) {
      safeAlert("Código vacío", "Este escaneo no tiene código de barras");
      return;
    }

    const result = await lookupProductByBarcode(barcode);

    if (!result.found) {
      safeAlert(
        "Producto no encontrado",
        "No se encontró información para este código de barras",
      );
      return;
    }

    const product = result.product;

    if (product.name) setName(product.name);
    if (product.brand) setBrand(product.brand);
    if (product.imageUrl) setImageUrl(product.imageUrl);
  };

  const handleSave = async () => {
    if (!barcode) {
      safeAlert("Código vacío", "Este escaneo no tiene código de barras");
      return;
    }

    if (!name.trim()) {
      safeAlert("Nombre requerido", "El producto debe tener un nombre");
      return;
    }

    try {
      let finalThumbnail = thumbnailUri;

      if (imageUrl && imageUrl !== item?.imageUrl && !thumbnailUri) {
        finalThumbnail = await createThumbnail(imageUrl, barcode);
      }

      await updateScannedEntry(barcode, {
        name: name.trim(),
        brand: brand.trim(),
        url: url.trim(),
        imageUrl: imageUrl.trim(),
        thumbnailUri: finalThumbnail,
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      });

      navigation.goBack();
    } catch (error) {
      console.log("Error saving scanned item:", error);
      safeAlert("Error", "No se pudo guardar el escaneo");
    }
  };

  const handleDelete = () => {
    if (!barcode) {
      safeAlert("Código vacío", "Este escaneo no tiene código de barras");
      return;
    }

    safeAlert("Eliminar", `¿Deseas eliminar este escaneo?\n\n${name}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await removeScannedItem(barcode);
            navigation.goBack();
          } catch (error) {
            console.log("Error deleting scanned item:", error);
            safeAlert("Error", "No se pudo eliminar el escaneo");
          }
        },
      },
    ]);
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Escaneo no encontrado</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          ...
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },

  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#FAFAFA",
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
    color: "#111827",
  },

  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },

  codeBox: {
    backgroundColor: "#e8f0fe",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#aabbee",
  },

  input: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
    color: "#111827",
  },

  notesInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },

  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#eee",
    marginTop: 6,
    marginBottom: 8,
  },

  noThumb: {
    width: 96,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 8,
  },

  noThumbText: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },

  actions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 30,
    paddingBottom: 8,
  },

  saveBtn: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#22c55e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  deleteBtn: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  actionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
