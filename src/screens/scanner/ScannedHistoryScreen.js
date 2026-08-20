// screens/scanner/ScannedHistoryScreen.js

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, FlatList, StyleSheet, Pressable } from "react-native";
import { I18nText as Text } from "@/src/i18n";

import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ROUTES } from "@/src/navigation/ROUTES";
import { buildHeaderConfig } from "@/src/utils/layout/headerStyles";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { safeQuestion } from "@/src/components/ui/alert/safeQuestion";

import { useScannedHistoryStorage } from "@/src/hooks/useScannedHistoryStorage";
import { getProductImages } from "@/src/storage/productImageStorage";
import { restoreTemporaryProductImages } from "@/src/services/temporaryProductImageSync";
import SearchBar from "@/src/components/features/search/SearchBar";

const HISTORY_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "supermarket", label: "Supermercado" },
  { id: "books", label: "Libros" },
  { id: "music", label: "Música" },
];

function getItemGroup(item) {
  if (item?.isBook === true) return "books";

  const value = String(
    item?.productType || item?.category || item?.categoryId || "",
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (value.includes("libro") || value.includes("book")) return "books";
  if (value.includes("music") || value.includes("musica")) return "music";

  return "supermarket";
}

function getItemSecondaryText(item) {
  const group = getItemGroup(item);
  const details = item?.details || {};

  if (group === "books") {
    return details.authors || details.publisher || item.brand || "Libro";
  }

  if (group === "music") {
    return details.artist || details.composer || details.label || "Música";
  }

  return item.brand || details.manufacturer || "Supermercado";
}

function ProductThumbnail({ item, syncEnabled }) {
  const [localUri, setLocalUri] = useState("");
  const [localChecked, setLocalChecked] = useState(false);
  const storedFallbackUri = item?.thumbnailUri || item?.imageUrl || "";
  // Las URL blob solo son válidas mientras vive la pestaña que las creó.
  // Nunca deben reutilizarse desde el historial persistido.
  const fallbackUri = String(storedFallbackUri).startsWith("blob:")
    ? ""
    : storedFallbackUri;
  const remoteImages = useQuery(
    api.temporaryProductImages.getMyProductImages,
    syncEnabled && item?.barcode ? { barcode: item.barcode } : "skip",
  );

  useEffect(() => {
    if (
      !item?.barcode ||
      typeof window === "undefined" ||
      typeof window.URL?.createObjectURL !== "function"
    ) {
      return undefined;
    }

    let active = true;
    let objectUrl = "";

    getProductImages(item.barcode)
      .then(({ thumbnail }) => {
        if (!active || !thumbnail?.blob) return;

        objectUrl = window.URL.createObjectURL(thumbnail.blob);
        setLocalUri(objectUrl);
      })
      .catch((error) => {
        console.warn(
          "ScannedHistoryScreen thumbnail IndexedDB load error:",
          error,
        );
      })
      .finally(() => {
        if (active) setLocalChecked(true);
      });

    return () => {
      active = false;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item?.barcode]);

  useEffect(() => {
    if (
      !localChecked ||
      localUri ||
      !item?.barcode ||
      !remoteImages?.thumbnailUrl ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    let active = true;
    let objectUrl = "";
    restoreTemporaryProductImages(item.barcode, remoteImages)
      .then(({ thumbnailBlob } = {}) => {
        if (!active || !thumbnailBlob) return;
        objectUrl = window.URL.createObjectURL(thumbnailBlob);
        setLocalUri(objectUrl);
      })
      .catch((error) => {
        console.warn("ScannedHistoryScreen thumbnail sync error:", error);
      });

    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [item?.barcode, localChecked, remoteImages]);

  const imageUri = localUri || fallbackUri;

  if (!imageUri) {
    return (
      <View style={styles.imagePlaceholder}>
        <Ionicons name="cube-outline" size={26} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUri }}
      style={styles.image}
      contentFit="cover"
      cachePolicy={localUri ? "memory" : "disk"}
      recyclingKey={`${item?.barcode || "scan"}:${imageUri}`}
    />
  );
}

export default function ScannedHistoryScreen({ navigation, route }) {
  const [scannedItems, setScannedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");

  const isFocused = useIsFocused();
  const scanHistoryStorage = useScannedHistoryStorage();

  const headerConfig = useMemo(
    () =>
      buildHeaderConfig({
        title: "Historial de escaneos",
        preset: "light",
      }),
    [],
  );

  useEffect(() => {
    navigation.setOptions(headerConfig.navigationOptions);
  }, [navigation, headerConfig]);

  const loadScannedHistory = useCallback(async () => {
    try {
      const all = await scanHistoryStorage.getScannedHistory();

      const onlyScanned = all.filter((item) => Boolean(item?.barcode));

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
  }, [scanHistoryStorage]);

  useEffect(() => {
    if (isFocused) {
      loadScannedHistory();
    }
  }, [isFocused, loadScannedHistory]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();

    const results = scannedItems.filter((item) => {
      const matchesGroup =
        activeFilter === "all" || getItemGroup(item) === activeFilter;

      if (!matchesGroup) return false;
      if (!q) return true;

      const name = String(item.name || "").toLowerCase();
      const barcode = String(item.barcode || "").toLowerCase();
      const brand = String(item.brand || "").toLowerCase();
      const details = Object.values(item.details || {})
        .join(" ")
        .toLowerCase();

      return (
        name.includes(q) ||
        barcode.includes(q) ||
        brand.includes(q) ||
        details.includes(q)
      );
    });

    setFilteredItems(results);
  }, [searchQuery, scannedItems, activeFilter]);

  const handleDelete = (item) => {
    safeQuestion(
      "Eliminar escaneo",
      `¿Deseas eliminar este escaneo?\n\n${item.name || item.barcode}`,
      {
        yesStyle: "destructive",
        onYes: async () => {
          try {
            await scanHistoryStorage.removeScannedItem(item.barcode);
            await loadScannedHistory();
          } catch (error) {
            console.log("Error deleting scanned item:", error);
            safeAlert("Error", "No se pudo eliminar el escaneo");
          }
        },
      },
    );
  };

  const openItem = (item) => {
    navigation.navigate(ROUTES.EDIT_SCANNED_ITEM, {
      item,
      product: item,
      barcode: item.barcode,
    });
  };

  const renderItem = ({ item }) => {
    const itemGroup = getItemGroup(item);
    const typeIcon =
      itemGroup === "books" ? "📚 " : itemGroup === "music" ? "💿 " : "";

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
            <ProductThumbnail
              item={item}
              syncEnabled={scanHistoryStorage.syncEnabled}
            />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.name} numberOfLines={2}>
              {typeIcon}
              {item.name || "Sin nombre"}
            </Text>

            <Text style={styles.brand} numberOfLines={1}>
              {getItemSecondaryText(item)}
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
      </View>
    );
  };

  const emptyMessage = scannedItems.length
    ? "No se encontraron resultados"
    : "No hay escaneos guardados";

  return (
    <View style={styles.screen}>
      <StatusBar {...headerConfig.statusBar} />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={styles.content}>
          <Text style={styles.title}>Historial de Escaneos</Text>

          <Text style={styles.subtitle}>
            Consulta productos y códigos de barras escaneados anteriormente.
          </Text>

          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar producto, marca o código..."
            style={styles.searchBar}
          />

          <View style={styles.filterRow}>
            {HISTORY_FILTERS.map((filter) => {
              const selected = activeFilter === filter.id;

              return (
                <Pressable
                  key={filter.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveFilter(filter.id)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selected && styles.filterChipSelected,
                    pressed && styles.filterChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  safeArea: {
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

  searchBar: {
    marginBottom: 16,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  filterChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  filterChipSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  filterChipPressed: {
    opacity: 0.75,
  },

  filterChipText: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "700",
  },

  filterChipTextSelected: {
    color: "#FFFFFF",
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
