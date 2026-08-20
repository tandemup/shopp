// screens/scanner/ScannerTabScreen.js

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView
} from "react-native";
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
  const [manualBarcodeError, setManualBarcodeError] = useState("");
  const [productSearchEngineSubtitle, setProductSearchEngineSubtitle] =
    useState("Motor activo: Google");

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
