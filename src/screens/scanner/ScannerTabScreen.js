// screens/scanner/ScannerTabScreen.js

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Share,
  Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";

import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "convex/react";

import { ROUTES } from "@/src/navigation/ROUTES";
import { api } from "@/convex/_generated/api";
import { DEFAULT_BARCODE_SETTINGS } from "@/src/constants/barcodeFormats";
import { getBarcodeSettings } from "@/src/storage/barcodeSettingsStorage";
import {
  DEFAULT_SEARCH_SETTINGS,
  getSearchSettings,
} from "@/src/storage/settingsStorage";
import { SEARCH_ENGINES } from "@/src/constants/searchEngines";
import { buildHeaderConfig } from "@/src/utils/layout/headerStyles";
import {
  DEFAULT_PRODUCT_SEARCH_TYPE,
  PRODUCT_SEARCH_TYPES,
} from "@/src/constants/productSearchTypes";
import {
  getScannedHistory,
  saveScannedHistory,
} from "@/src/services/scannerHistory";
import { normalizeScannedProduct } from "@/src/utils/scannedProductModel";

const SCANNER_JSON_FORMAT = "shopp-scanner-products";

function normalizedProducts(items) {
  const byBarcode = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const product = normalizeScannedProduct(item, item?.barcode);
    if (product.barcode) byBarcode.set(product.barcode, product);
  });
  return Array.from(byBarcode.values());
}

function buildProductSearchEngineSubtitle(settings) {
  const engineId =
    settings?.selectedProductEngine ||
    settings?.generalEngine ||
    DEFAULT_SEARCH_SETTINGS?.selectedProductEngine ||
    DEFAULT_SEARCH_SETTINGS?.generalEngine ||
    "google";
  const engine = SEARCH_ENGINES?.[engineId];
  const engineLabel = engine?.label || engine?.name || engineId;

  return `Motor activo: ${engineLabel}`;
}

function getEnabledBarcodeTypes(settings) {
  const formats = settings?.formats ?? DEFAULT_BARCODE_SETTINGS.formats;

  const enabled = Object.entries(formats)
    .filter(([, value]) => Boolean(value))
    .map(([formatId]) => formatId);

  if (enabled.length > 0) {
    return enabled;
  }

  return Object.entries(DEFAULT_BARCODE_SETTINGS.formats)
    .filter(([, value]) => Boolean(value))
    .map(([formatId]) => formatId);
}

export default function ScannerTabScreen({ navigation }) {
  const currentUser = useQuery(api.users.current);
  const isAdmin =
    currentUser?.isAdmin === true || currentUser?.role === "admin";

  const [barcodeSettings, setBarcodeSettings] = useState(
    DEFAULT_BARCODE_SETTINGS,
  );
  const [manualBarcode, setManualBarcode] = useState("");
  const [manualUserHint, setManualUserHint] = useState("");
  const [manualProductType, setManualProductType] = useState(
    DEFAULT_PRODUCT_SEARCH_TYPE,
  );
  const [manualBarcodeError, setManualBarcodeError] = useState("");
  const [productSearchEngineSubtitle, setProductSearchEngineSubtitle] =
    useState("Motor activo: Google");
  const [transferModal, setTransferModal] = useState(null);

  const exportProductsNow = async () => {
    const products = normalizedProducts(await getScannedHistory());
    if (!products.length) return;
    const json = JSON.stringify({
      app: "Shopp",
      format: SCANNER_JSON_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { products },
    }, null, 2);
    const filename = `shopp-scanner-products-${Date.now()}.json`;
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
      return;
    }
    const uri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
    await Share.share({ title: filename, url: uri, message: Platform.OS === "android" ? json : undefined });
  };

  const importProductsNow = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/json", "text/plain"], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    const text = Platform.OS === "web" && asset?.file
      ? await asset.file.text()
      : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    const parsed = JSON.parse(text);
    if (parsed?.format !== SCANNER_JSON_FORMAT || parsed?.version !== 1 || !Array.isArray(parsed?.data?.products)) {
      throw new Error("El fichero no es compatible con el scanner.");
    }
    const current = normalizedProducts(await getScannedHistory());
    await saveScannedHistory(normalizedProducts([...current, ...parsed.data.products]));
  };

  const exportProducts = () => setTransferModal("export");
  const importProducts = () => setTransferModal("import");

  const headerConfig = useMemo(
    () =>
      buildHeaderConfig({
        title: "Scanner",
        preset: "light",
      }),
    [],
  );

  useEffect(() => {
    navigation.setOptions(headerConfig.navigationOptions);
  }, [navigation, headerConfig]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadBarcodeSettings = async () => {
        try {
          const data = await getBarcodeSettings();

          if (!mounted) return;

          setBarcodeSettings(data || DEFAULT_BARCODE_SETTINGS);
        } catch (error) {
          console.log(
            "❌ Error al cargar la configuración de códigos de barras:",
            error,
          );

          if (!mounted) return;

          setBarcodeSettings(DEFAULT_BARCODE_SETTINGS);
        }
      };

      loadBarcodeSettings();

      getSearchSettings()
        .then((settings) => {
          if (mounted) {
            setProductSearchEngineSubtitle(
              buildProductSearchEngineSubtitle(settings),
            );
          }
        })
        .catch((error) => {
          console.warn("[ScannerTabScreen] search settings error", error);

          if (mounted) {
            setProductSearchEngineSubtitle(
              buildProductSearchEngineSubtitle(DEFAULT_SEARCH_SETTINGS),
            );
          }
        });

      return () => {
        mounted = false;
      };
    }, []),
  );

  const enabledBarcodeTypes = getEnabledBarcodeTypes(barcodeSettings);
  const enabledFormatsLabel = enabledBarcodeTypes.join(", ");

  const goToScanner2 = () => {
    navigation.navigate(ROUTES.NEW_PRODUCT_SCANNER2, {
      saveToHistory: true,
      barcodeTypes: enabledBarcodeTypes,
    });
  };

  const goToScannedHistory = () => {
    navigation.navigate(ROUTES.SCANNED_HISTORY);
  };

  const goToBarcodeSettings = () => {
    navigation.navigate(ROUTES.BARCODE_SETTINGS);
  };

  const goToProductSearchEngines = () => {
    navigation.navigate(ROUTES.SEARCH_ENGINES, { type: "product" });
  };

  const handleManualBarcodeChange = (value) => {
    setManualBarcode(
      String(value || "")
        .replace(/\D/g, "")
        .slice(0, 14),
    );
    setManualBarcodeError("");
  };

  const processManualBarcode = () => {
    const barcode = manualBarcode.replace(/\D/g, "");

    if (barcode.length < 8 || barcode.length > 14) {
      setManualBarcodeError("Introduce un código de entre 8 y 14 dígitos.");
      return;
    }

    navigation.navigate(ROUTES.NEW_PRODUCT_SCANNER2, {
      captureMode: "manual-barcode",
      manualBarcode: barcode,
      productType: manualProductType,
      userHint: manualUserHint.trim(),
      saveToHistory: true,
      barcodeTypes: enabledBarcodeTypes,
    });
  };

  const goToAdminProductReviews = () => {
    navigation.navigate("AdminProductReviews");
  };

  return (
    <View style={styles.screen}>
      <StatusBar {...headerConfig.statusBar} />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Scanner</Text>
          <Text style={styles.description}>
            Escanea nuevos productos o consulta el historial de códigos
            escaneados.
          </Text>

          <View style={styles.transferRow}>
            <Pressable style={styles.transferButton} onPress={importProducts}>
              <Ionicons name="download-outline" size={18} color="#2563EB" />
              <Text style={styles.transferText}>Importar JSON</Text>
            </Pressable>
            <Pressable style={styles.transferButton} onPress={exportProducts}>
              <Ionicons name="cloud-upload-outline" size={18} color="#2563EB" />
              <Text style={styles.transferText}>Exportar JSON</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={goToScanner2}
            >
              <View style={styles.iconBox}>
                <Ionicons name="barcode-outline" size={26} color="#111827" />
              </View>

              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Escanear nuevo producto</Text>

                <Text style={styles.cardSubtitle}>
                  Abrir la cámara para leer un código de barras.
                </Text>

                <Text style={styles.cardMeta} numberOfLines={1}>
                  Formatos activos: {enabledFormatsLabel}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={goToBarcodeSettings}
            >
              <View style={styles.iconBox}>
                <Ionicons name="options-outline" size={26} color="#111827" />
              </View>

              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>
                  Configuración del código de barras
                </Text>

                <Text style={styles.cardSubtitle}>
                  Elige los formatos que puede detectar el scanner.
                </Text>

                <Text style={styles.cardMeta} numberOfLines={1}>
                  Formatos activos: {enabledFormatsLabel}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
            </Pressable>

            {__DEV__ ? (
              <View style={[styles.card, styles.developmentCard]}>
                <View style={[styles.iconBox, styles.developmentIconBox]}>
                  <Ionicons name="keypad-outline" size={26} color="#7C3AED" />
                </View>

                <View style={styles.cardText}>
                  <View style={styles.developmentTitleRow}>
                    <Text style={styles.cardTitle}>
                      Introducir código manualmente
                    </Text>
                    <Text style={styles.developmentBadge}>DESARROLLO</Text>
                  </View>
                  <Text style={styles.manualProductTypeLabel}>
                    Tipo de producto
                  </Text>
                  <View style={styles.manualProductTypeOptions}>
                    {PRODUCT_SEARCH_TYPES.map((option) => {
                      const selected = manualProductType === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Tipo de producto: ${option.label}`}
                          onPress={() => setManualProductType(option.value)}
                          style={({ pressed }) => [
                            styles.manualProductTypeOption,
                            selected && styles.manualProductTypeOptionSelected,
                            pressed && styles.manualProductTypeOptionPressed,
                          ]}
                        >
                          <Ionicons
                            name={option.icon}
                            size={15}
                            color={selected ? "#FFFFFF" : "#6D28D9"}
                          />
                          <Text
                            style={[
                              styles.manualProductTypeText,
                              selected && styles.manualProductTypeTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    value={manualUserHint}
                    onChangeText={setManualUserHint}
                    placeholder="Información adicional opcional: marca, autor, intérprete…"
                    placeholderTextColor={TEXT_MUTED}
                    multiline
                    style={styles.manualHintInput}
                    accessibilityLabel="Información adicional del producto"
                  />
                  <Text style={styles.cardSubtitle}>
                    Prueba el alta de un producto sin utilizar la cámara.
                  </Text>
                  <View style={styles.manualBarcodeRow}>
                    <TextInput
                      value={manualBarcode}
                      onChangeText={handleManualBarcodeChange}
                      onSubmitEditing={processManualBarcode}
                      placeholder="Código de barras"
                      placeholderTextColor={TEXT_MUTED}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      returnKeyType="go"
                      maxLength={14}
                      style={styles.manualBarcodeInput}
                      accessibilityLabel="Código de barras manual"
                    />
                    <Pressable
                      onPress={processManualBarcode}
                      disabled={manualBarcode.length < 8}
                      style={({ pressed }) => [
                        styles.manualBarcodeButton,
                        pressed && styles.manualBarcodeButtonPressed,
                        manualBarcode.length < 8 &&
                          styles.manualBarcodeButtonDisabled,
                      ]}
                    >
                      <Text style={styles.manualBarcodeButtonText}>
                        Continuar
                      </Text>
                    </Pressable>
                  </View>
                  {manualBarcodeError ? (
                    <Text style={styles.manualBarcodeError}>
                      {manualBarcodeError}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Búsqueda</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={goToProductSearchEngines}
            >
              <View style={styles.iconBox}>
                <Ionicons name="search-outline" size={26} color="#111827" />
              </View>

              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Buscador de productos</Text>
                <Text style={styles.cardSubtitle}>
                  {productSearchEngineSubtitle}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={goToScannedHistory}
            >
              <View style={styles.iconBox}>
                <Ionicons name="time-outline" size={26} color="#111827" />
              </View>

              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Historial de escaneos</Text>

                <Text style={styles.cardSubtitle}>
                  Ver productos y códigos escaneados anteriormente
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
            </Pressable>

            {isAdmin ? (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  styles.adminCard,
                  pressed && styles.cardPressed,
                ]}
                onPress={goToAdminProductReviews}
              >
                <View style={[styles.iconBox, styles.adminIconBox]}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={26}
                    color="#2563EB"
                  />
                </View>

                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>
                    Productos pendientes de revisión
                  </Text>

                  <Text style={styles.cardSubtitle}>
                    Corregir y aprobar productos enviados por usuarios
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={22} color="#2563EB" />
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal transparent visible={Boolean(transferModal)} animationType="fade" onRequestClose={() => setTransferModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {transferModal === "import" ? "Importar productos" : "Exportar productos"}
            </Text>
            <Text style={styles.modalDescription}>
              {transferModal === "import"
                ? "Selecciona un fichero JSON de productos escaneados. Se normalizará y se combinará sin duplicar códigos de barras."
                : "Se exportarán los productos escaneados con sus datos normalizados en formato JSON."}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setTransferModal(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmButton}
                onPress={async () => {
                  const action = transferModal === "import" ? importProductsNow : exportProductsNow;
                  setTransferModal(null);
                  try { await action(); } catch (error) { console.warn("Scanner JSON transfer error", error); }
                }}
              >
                <Text style={styles.modalConfirmText}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const SCREEN_BACKGROUND = "#F9FAFB";
const CARD_BACKGROUND = "#FFFFFF";
const BORDER_COLOR = "#E5E7EB";
const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#6B7280";
const TEXT_MUTED = "#9CA3AF";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BACKGROUND,
  },

  safeArea: {
    flex: 1,
    backgroundColor: SCREEN_BACKGROUND,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  description: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    marginBottom: 16,
  },

  transferRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  transferButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },

  transferText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "800",
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 430, borderRadius: 18, padding: 22, backgroundColor: "#FFFFFF" },
  modalTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  modalDescription: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalCancelButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: "#F3F4F6" },
  modalCancelText: { color: TEXT_PRIMARY, fontWeight: "700" },
  modalConfirmButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: "#2563EB" },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "700" },

  actions: {
    gap: 12,
  },

  sectionHeader: {
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  card: {
    minHeight: 84,
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  adminCard: {
    borderColor: "#BFDBFE",
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  adminIconBox: {
    backgroundColor: "#EFF6FF",
  },

  developmentCard: {
    alignItems: "flex-start",
    borderColor: "#DDD6FE",
  },

  developmentIconBox: {
    backgroundColor: "#F5F3FF",
  },

  developmentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  developmentBadge: {
    color: "#6D28D9",
    backgroundColor: "#EDE9FE",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "900",
  },

  manualProductTypeLabel: {
    marginTop: 10,
    marginBottom: 6,
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },

  manualProductTypeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  manualProductTypeOption: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#C4B5FD",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  manualProductTypeOptionSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#7C3AED",
  },

  manualProductTypeOptionPressed: {
    opacity: 0.78,
  },

  manualProductTypeText: {
    color: "#6D28D9",
    fontSize: 12,
    fontWeight: "800",
  },

  manualProductTypeTextSelected: {
    color: "#FFFFFF",
  },

  manualBarcodeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  manualBarcodeInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#C4B5FD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: TEXT_PRIMARY,
    fontSize: 15,
  },

  manualHintInput: {
    minHeight: 42,
    marginTop: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: TEXT_PRIMARY,
    fontSize: 14,
  },

  manualBarcodeButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
  },

  manualBarcodeButtonPressed: {
    backgroundColor: "#6D28D9",
  },

  manualBarcodeButtonDisabled: {
    opacity: 0.45,
  },

  manualBarcodeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  manualBarcodeError: {
    marginTop: 7,
    color: "#B42318",
    fontSize: 12,
  },

  cardText: {
    flex: 1,
    paddingRight: 10,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: TEXT_SECONDARY,
  },

  cardMeta: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 5,
  },
});
