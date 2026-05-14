// screens/scanner/ScannedHistoryScreen.js

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
} from "react-native";

import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ROUTES } from "../../navigation/ROUTES";
import BarcodeLink from "../../components/controls/BarcodeLink";

import {
  getScannedHistory,
  removeScannedItem,
} from "../../services/scannerHistory";

export default function ScannedHistoryScreen({ navigation, route }) {
  const [scannedItems, setScannedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadScannedHistory();
    }
  }, [isFocused]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();

    if (!q) {
      setFilteredItems(scannedItems);
      return;
    }

    const results = scannedItems.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const barcode = String(item.barcode || "").toLowerCase();
      const brand = String(item.brand || "").toLowerCase();

      return name.includes(q) || barcode.includes(q) || brand.includes(q);
    });

    setFilteredItems(results);
  }, [searchQuery, scannedItems]);

  const loadScannedHistory = async () => {
    try {
      const all = await getScannedHistory();

      const onlyScanned = all.filter((item) => item.source === "scanner");

      onlyScanned.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.scannedAt || 0).valueOf();
        const dateB = new Date(b.updatedAt || b.scannedAt || 0).valueOf();

        return dateB - dateA;
      });

      setScannedItems(onlyScanned);
      setFilteredItems(onlyScanned);
    } catch (error) {
      console.log("Error loading scanned history:", error);
      safeAlert("Error", "No se pudo cargar el historial de escaneos");
    }
  };

  const handleDelete = (item) => {
    safeAlert(
      "Eliminar escaneo",
      `¿Deseas eliminar este escaneo?\n\n${item.name || item.barcode}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await removeScannedItem(item.barcode);
              await loadScannedHistory();
            } catch (error) {
              console.log("Error deleting scanned item:", error);
              safeAlert("Error", "No se pudo eliminar el escaneo");
            }
          },
        },
      ],
    );
  };

  const getItemImage = (item) => {
    return item.thumbnailUri || item.imageUrl || null;
  };

  const openItem = (item) => {
    navigation.navigate(ROUTES.EDIT_SCANNED_ITEM, { item });
  };

  const renderItem = ({ item }) => {
    const imageUri = getItemImage(item);

    return (
      <View style={[styles.card, item.isBook && styles.cardBook]}>
        <Pressable
          style={({ pressed }) => [
            styles.mainPressable,
            pressed && styles.cardPressed,
          ]}
          onPress={() => openItem(item)}
          onLongPress={() => handleDelete(item)}
        >
          <View style={styles.imageWrapper}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="cube-outline" size={26} color="#9CA3AF" />
              </View>
            )}
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.name} numberOfLines={2}>
              {item.isBook ? "📚 " : ""}
              {item.name || "Sin nombre"}
            </Text>

            <Text style={styles.brand} numberOfLines={1}>
              {item.brand || "N/A"}
            </Text>

            <Text style={styles.count}>
              Escaneos: {item.scanCount ?? 1}
              {item.scannedAt
                ? ` · ${new Date(item.scannedAt).toLocaleDateString("es-ES")}`
                : ""}
            </Text>
          </View>

          <View style={styles.actionsCol}>
            <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
          </View>
        </Pressable>
        {/* 
        {item.barcode ? (
          <View style={styles.barcodeRow}>
            <BarcodeLink
              barcode={item.barcode}
              label={item.barcode}
              iconColor="#2563eb"
            />
          </View>
        ) : null}
         */}
      </View>
    );
  };

  const emptyMessage = scannedItems.length
    ? "No se encontraron resultados"
    : "No hay escaneos guardados";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Historial de Escaneos</Text>

        <Text style={styles.subtitle}>
          Consulta productos y códigos de barras escaneados anteriormente.
        </Text>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color="#6B7280"
            style={styles.searchIcon}
          />

          <TextInput
            placeholder="Buscar producto o código..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            item.id?.toString() || item.barcode?.toString() || `scan-${index}`
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Ionicons name="barcode-outline" size={34} color="#9CA3AF" />
              <Text style={styles.empty}>{emptyMessage}</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 18,
  },

  searchContainer: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    marginBottom: 16,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    outlineStyle: "none",
  },

  listContent: {
    paddingBottom: 80,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  cardBook: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },

  mainPressable: {
    flexDirection: "row",
    alignItems: "center",
  },

  imageWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    marginRight: 14,
  },

  imageWrapper2: {
    width: 90,
    height: 90,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    marginRight: 14,
  },

  image: {
    width: "100%",
    height: "100%",
  },

  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    justifyContent: "center",
  },

  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
  },

  brand: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },

  count: {
    fontSize: 13,
    color: "#6B7280",
  },

  actionsCol: {
    justifyContent: "center",
    marginLeft: 8,
  },

  barcodeRow: {
    marginTop: 10,
    marginLeft: 78,
    alignItems: "flex-start",
  },

  emptyBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
  },

  empty: {
    marginTop: 10,
    fontSize: 15,
    textAlign: "center",
    color: "#6B7280",
  },
});
