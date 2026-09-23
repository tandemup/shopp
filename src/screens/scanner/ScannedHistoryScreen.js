// screens/scanner/ScannedHistoryScreen.js

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  Share,
} from "react-native";
import { I18nText as Text } from "@/src/i18n";

import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
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
import {
  DEFAULT_PRODUCT_SEARCH_TYPE,
  PRODUCT_SEARCH_TYPE,
  PRODUCT_SEARCH_TYPES,
  normalizeProductSearchType,
} from "@/src/constants/productSearchTypes";
import { normalizeScannedProduct } from "@/src/utils/scannedProductModel";

const SCANNER_PRODUCTS_FORMAT = "shopp-scanner-products";
const SCANNER_PRODUCTS_VERSION = 1;

const HISTORY_FILTERS = [
  ...PRODUCT_SEARCH_TYPES.map(({ value, label }) => ({ id: value, label })),
  { id: PRODUCT_SEARCH_TYPE.ALL, label: PRODUCT_SEARCH_TYPE.ALL },
];

function normalizeExportProduct(product) {
  const normalized = normalizeScannedProduct(product, product?.barcode);
  const scanCount = Number(normalized.scanCount || 1);

  return {
    id: normalized.id,
    barcode: normalized.barcode,
    name: normalized.name,
    brand: normalized.brand,
    productType: normalized.productType,
    category: normalized.category,
    subcategory: normalized.subcategory,
    imageUrl: normalized.imageUrl,
    url: normalized.url,
    productUrl: normalized.productUrl,
    thumbnailUri: normalized.thumbnailUri || null,
    details:
      normalized.details && typeof normalized.details === "object"
        ? normalized.details
        : {},
    notes: String(normalized.notes || "").trim(),
    source: String(normalized.source || "scanner").trim() || "scanner",
    lookupSource: normalized.lookupSource || null,
    dataSource: String(normalized.dataSource || "").trim(),
    scannedAt: String(normalized.scannedAt || "").trim(),
    updatedAt: String(normalized.updatedAt || "").trim(),
    scanCount: Number.isFinite(scanCount) ? Math.max(1, scanCount) : 1,
  };
}

function getImportedProducts(payload) {
  if (
    !payload ||
    payload.format !== SCANNER_PRODUCTS_FORMAT ||
    payload.version !== SCANNER_PRODUCTS_VERSION ||
    !Array.isArray(payload.data?.products)
  ) {
    throw new Error(
      "El fichero no es una exportación compatible del historial de escaneos.",
    );
  }

  return Array.from(
    payload.data.products
      .reduce((byBarcode, item) => {
        const product = normalizeExportProduct(item);
        if (product.barcode) byBarcode.set(product.barcode, product);
        return byBarcode;
      }, new Map())
      .values(),
  );
}

function buildJsonFilename() {
  return `shopp-historial-escaneos-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
}

function downloadJsonOnWeb(filename, json) {
  const objectUrl = URL.createObjectURL(
    new Blob([json], { type: "application/json;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function getItemGroup(item) {
  if (item?.isBook === true) return PRODUCT_SEARCH_TYPE.BOOKS;

  return normalizeProductSearchType(
    item?.productType || item?.category || item?.categoryId,
    PRODUCT_SEARCH_TYPE.SUPERMARKET,
  );
}

function getItemSecondaryText(item) {
  const group = getItemGroup(item);
  const details = item?.details || {};

  if (group === PRODUCT_SEARCH_TYPE.BOOKS) {
    return details.authors || details.publisher || item.brand || "Libro";
  }

  if (group === PRODUCT_SEARCH_TYPE.MUSIC) {
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
  const [activeFilter, setActiveFilter] = useState(DEFAULT_PRODUCT_SEARCH_TYPE);
  const [transferBusy, setTransferBusy] = useState(null);

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
        activeFilter === PRODUCT_SEARCH_TYPE.ALL ||
        getItemGroup(item) === activeFilter;

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

  const handleExportHistory = async () => {
    try {
      setTransferBusy("export");
      const history = await scanHistoryStorage.getScannedHistory();
      const products = history
        .map(normalizeExportProduct)
        .filter((product) => Boolean(product.barcode));

      if (!products.length) {
        safeAlert("Exportar historial", "No hay escaneos para exportar.");
        return;
      }

      const filename = buildJsonFilename();
      const json = JSON.stringify(
        {
          app: "Shopp",
          format: SCANNER_PRODUCTS_FORMAT,
          version: SCANNER_PRODUCTS_VERSION,
          exportedAt: new Date().toISOString(),
          data: { products },
        },
        null,
        2,
      );

      if (Platform.OS === "web" && typeof document !== "undefined") {
        downloadJsonOnWeb(filename, json);
      } else {
        const uri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Share.share({ title: filename, url: uri });
      }
    } catch (error) {
      safeAlert(
        "No se pudo exportar",
        error?.message || "No se pudo exportar el historial.",
      );
    } finally {
      setTransferBusy(null);
    }
  };

  const handleImportHistory = async () => {
    try {
      // Algunos JSON recién guardados en macOS Chrome no se asocian a un MIME
      // compatible y el selector los muestra desactivados. Se valida el
      // contenido después de seleccionarlo.
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error("No se pudo leer el fichero seleccionado.");
      }

      const jsonText =
        Platform.OS === "web" && asset.file
          ? await asset.file.text()
          : await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
      const importedProducts = getImportedProducts(JSON.parse(jsonText));

      if (!importedProducts.length) {
        throw new Error(
          "El fichero no contiene productos con código de barras.",
        );
      }

      safeAlert(
        "Importar historial",
        `Se incorporarán ${importedProducts.length} elementos. Los códigos repetidos se actualizarán sin borrar el resto del historial.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Importar",
            onPress: async () => {
              try {
                setTransferBusy("import");
                const currentHistory =
                  await scanHistoryStorage.getScannedHistory();
                const productsByBarcode = new Map(
                  currentHistory
                    .map(normalizeExportProduct)
                    .filter((product) => Boolean(product.barcode))
                    .map((product) => [product.barcode, product]),
                );

                importedProducts.forEach((imported) => {
                  const previous = productsByBarcode.get(imported.barcode);
                  productsByBarcode.set(
                    imported.barcode,
                    normalizeExportProduct({
                      ...previous,
                      ...imported,
                      details: {
                        ...(previous?.details || {}),
                        ...(imported.details || {}),
                      },
                      scanCount: Math.max(
                        Number(previous?.scanCount || 1),
                        Number(imported.scanCount || 1),
                      ),
                    }),
                  );
                });

                await scanHistoryStorage.replaceScannedHistory(
                  Array.from(productsByBarcode.values()),
                );
                await loadScannedHistory();

                safeAlert(
                  "Importación completada",
                  `Se han incorporado ${importedProducts.length} elementos al historial.`,
                );
              } catch (error) {
                safeAlert(
                  "No se pudo importar",
                  error?.message || "No se pudo actualizar el historial.",
                );
              } finally {
                setTransferBusy(null);
              }
            },
          },
        ],
      );
    } catch (error) {
      safeAlert(
        "Fichero no válido",
        error?.name === "SyntaxError"
          ? "El fichero seleccionado no contiene JSON válido."
          : error?.message ||
              "Selecciona una exportación válida del historial.",
      );
    }
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
      itemGroup === PRODUCT_SEARCH_TYPE.BOOKS
        ? "📚 "
        : itemGroup === PRODUCT_SEARCH_TYPE.MUSIC
          ? "💿 "
          : "";

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

          <View style={styles.transferRow}>
            <Pressable
              disabled={transferBusy !== null}
              onPress={handleImportHistory}
              style={({ pressed }) => [
                styles.transferButton,
                transferBusy !== null && styles.transferButtonDisabled,
                pressed && transferBusy === null && styles.filterChipPressed,
              ]}
            >
              <Ionicons name="download-outline" size={18} color="#2563EB" />
              <Text style={styles.transferText}>
                {transferBusy === "import" ? "Importando..." : "Importar JSON"}
              </Text>
            </Pressable>

            <Pressable
              disabled={transferBusy !== null}
              onPress={handleExportHistory}
              style={({ pressed }) => [
                styles.transferButton,
                transferBusy !== null && styles.transferButtonDisabled,
                pressed && transferBusy === null && styles.filterChipPressed,
              ]}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#2563EB" />
              <Text style={styles.transferText}>
                {transferBusy === "export" ? "Exportando..." : "Exportar JSON"}
              </Text>
            </Pressable>
          </View>

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

  transferRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  transferButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  transferButtonDisabled: {
    opacity: 0.55,
  },

  transferText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "800",
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
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    minHeight: 92,
  },

  imageWrapper: {
    alignSelf: "stretch",
    width: 92,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
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
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    paddingRight: 14,
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
