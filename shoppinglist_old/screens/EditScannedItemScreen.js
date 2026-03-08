// screens/EditScannedItemScreen.js
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

import {
  updateScannedEntry,
  removeScannedItem,
} from "../services/scannerHistory";

import { safeAlert } from "../utils/core/safeAlert";
import { createThumbnail } from "../utils/createThumbnail";

export default function EditScannedItemScreen({ route, navigation }) {
  const { item } = route.params;

  const barcode = item.barcode;

  // 📌 Estados
  const [name, setName] = useState(item.name ?? "");
  const [brand, setBrand] = useState(item.brand ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [thumbnailUri, setThumbnailUri] = useState(item.thumbnailUri ?? null);

  /* -------------------------------------------------
     Generar thumbnail al perder foco del input
  -------------------------------------------------- */
  const handleImageUrlBlur = async () => {
    if (!imageUrl || imageUrl === item.imageUrl) return;

    const thumb = await createThumbnail(imageUrl, barcode);
    if (thumb) setThumbnailUri(thumb);
  };

  /* -------------------------------------------------
     Guardar cambios
  -------------------------------------------------- */
  const save = async () => {
    if (!name.trim()) {
      safeAlert("Nombre requerido", "El producto debe tener un nombre");
      return;
    }

    let finalThumbnail = thumbnailUri;

    // Si hay URL nueva y aún no hay thumbnail
    if (imageUrl && imageUrl !== item.imageUrl && !thumbnailUri) {
      finalThumbnail = await createThumbnail(imageUrl, barcode);
    }

    await updateScannedEntry(barcode, {
      name: name.trim(),
      brand: brand.trim(),
      url: url.trim(),
      imageUrl: imageUrl.trim(),
      thumbnailUri: finalThumbnail,
      notes: notes.trim(),
    });

    navigation.goBack();
  };

  /* -------------------------------------------------
     Eliminar item
  -------------------------------------------------- */
  const removeItem = () => {
    safeAlert("Eliminar", `¿Deseas eliminar este escaneo?\n\n${name}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await removeScannedItem(barcode);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Editar producto</Text>

        {/* CÓDIGO */}
        <Text style={styles.label}>Código de barras</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{barcode}</Text>
        </View>

        {/* NOMBRE */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nombre del producto"
        />

        {/* MARCA */}
        <Text style={styles.label}>Marca</Text>
        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="Marca"
        />

        {/* URL */}
        <Text style={styles.label}>URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="URL del producto"
          autoCapitalize="none"
        />

        {/* IMAGEN / THUMBNAIL */}
        <Text style={styles.label}>Imagen del producto</Text>

        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumb}
            contentFit="cover"
          />
        ) : (
          <View style={styles.noThumb}>
            <Text style={{ color: "#555" }}>64×64</Text>
          </View>
        )}

        <TextInput
          value={imageUrl}
          onChangeText={setImageUrl}
          onBlur={handleImageUrlBlur}
          placeholder="URL de la imagen"
          style={styles.input}
          autoCapitalize="none"
        />

        {/* NOTAS */}
        <Text style={styles.label}>Notas</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Añade una descripción o notas"
          multiline
          style={[styles.input, { height: 80 }]}
        />

        {/* GUARDAR */}
        <Pressable style={styles.saveButton} onPress={save}>
          <Text style={styles.saveText}>Guardar cambios</Text>
        </Pressable>

        {/* BORRAR */}
        <Pressable style={styles.deleteButton} onPress={removeItem}>
          <Text style={styles.deleteText}>Borrar</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* -------------------------------------------------
   🎨 ESTILOS
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#FAFAFA",
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },

  label: {
    marginTop: 10,
    fontWeight: "600",
  },

  codeBox: {
    backgroundColor: "#e8f0fe",
    padding: 12,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#aabbee",
  },

  codeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a237e",
  },

  input: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 4,
  },

  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eee",
    marginTop: 6,
    marginBottom: 6,
  },

  noThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 6,
  },

  saveButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    marginTop: 30,
    borderRadius: 6,
  },

  saveText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },

  deleteButton: {
    backgroundColor: "#dc2626",
    padding: 12,
    marginTop: 15,
    borderRadius: 6,
  },

  deleteText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
});
