import React, { useLayoutEffect, useMemo, useState } from "react";
import { UNITS } from "../../constants/unitTypes";
import { ROUTES } from "../../navigation/ROUTES";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { getSearchSettings } from "../../src/storage/settingsStorage";
import { DEFAULT_CURRENCY } from "../../constants/currency";
import { SEARCH_ENGINES } from "../../constants/searchEngines";
import { useLists } from "../../context/ListsContext";

import {
  PricingEngine,
  PROMOTIONS,
  normalizePromotion,
  validatePromotion,
} from "../../utils/pricing/PricingEngine";
import { validatePromotionUnit } from "../../utils/pricing";
import { formatCurrency } from "../../utils/store/prices";
import { formatUnit } from "../../utils/pricing/unitFormat";
import { safeAlert } from "../../components/ui/alert/safeAlert";

function CardNombreBarcode({
  nameItem,
  barcodeItem,
  onChangeName,
  onChangeBarcode,
  onScanner,
  onSearch,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Nombre</Text>

      <TextInput
        style={styles.input}
        value={nameItem}
        onChangeText={onChangeName}
        placeholder="Nombre del producto"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={{ height: 12 }} />

      <Text style={styles.label}>Código de barras</Text>

      <View style={styles.barcodeRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={barcodeItem}
          onChangeText={onChangeBarcode}
          placeholder="EAN-13"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable style={styles.scanBtn} onPress={onScanner}>
          <Ionicons name="barcode-outline" size={22} color="#2563eb" />
        </Pressable>

        <Pressable style={styles.scanBtn} onPress={onSearch}>
          <Ionicons name="search-outline" size={22} color="#2563eb" />
        </Pressable>
      </View>
    </View>
  );
}

function Unidades({
  qty,
  price,
  unit,
  currencySymbol,
  onChangeQty,
  onChangePrice,
  onChangeUnit,
  showError,
}) {
  return (
    <View style={styles.card0}>
      <View style={styles.unitHeader}>
        <Text style={styles.label}>Unidad</Text>

        <Text style={styles.unitHint}>
          {
            {
              u: "🧩 Unidad (pieza)",
              kg: "⚖️ Kilogramos",
              g: "⚖️ Gramos",
              l: "🧃 Litros",
            }[unit]
          }
        </Text>
      </View>

      <View style={styles.unitRow}>
        {UNITS.map((u) => (
          <Pressable
            key={u}
            style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
            onPress={() => onChangeUnit(u)}
          >
            <Text
              style={[styles.unitText, unit === u && styles.unitTextActive]}
            >
              {formatUnit(u)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider}>
        <View style={styles.inlineRow}>
          <View style={styles.inlineField}>
            <Text style={styles.label}>Cantidad ({formatUnit(unit)})</Text>

            <TextInput
              keyboardType={unit === "u" ? "number-pad" : "decimal-pad"}
              inputMode={unit === "u" ? "numeric" : "decimal"}
              style={styles.inputNum}
              value={qty}
              onChangeText={onChangeQty}
            />

            {showError && (
              <Text style={styles.inputError}>
                ⚠️ Solo enteros para unidades (u)
              </Text>
            )}
          </View>

          <View style={styles.inlineField}>
            <Text style={styles.label}>
              Precio unitario ({currencySymbol}/{formatUnit(unit)})
            </Text>

            <TextInput
              inputMode="decimal"
              style={styles.inputNum}
              keyboardType="decimal-pad"
              value={price}
              onChangeText={onChangePrice}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function Ofertas({ quantity, unitPrice, selectedPromo, onSelect, unit }) {
  const qty = Number(String(quantity).replace(",", ".")) || 0;
  const price = Number(String(unitPrice).replace(",", ".")) || 0;

  const selectedPromoSafe = selectedPromo ?? "none";
  const selectedPromoNormalized = normalizePromotion(selectedPromoSafe);

  const promoValidation = validatePromotion(
    selectedPromoNormalized,
    qty,
    price,
  );

  const selectedOption = PROMOTIONS[selectedPromoSafe];
  const hint = selectedOption?.hint;

  return (
    <View style={styles.card0}>
      <View style={styles.ofertasHeader}>
        <Text style={styles.label}>Ofertas</Text>

        {selectedPromoSafe !== "none" && hint && (
          <Text style={styles.promoHintInline} numberOfLines={1}>
            💡 {hint}
          </Text>
        )}
      </View>

      <View style={styles.promoWrap}>
        {Object.values(PROMOTIONS)
          .filter((option) => {
            const id = option.id;
            const isMulti = id === "2x1" || id === "3x2";

            return !(isMulti && unit !== "u");
          })
          .map((option) => {
            const promo = normalizePromotion(option.id);
            const validation = validatePromotion(promo, qty, price);
            const disabled = !validation.valid;
            const selected = selectedPromoSafe === option.id;

            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  if (disabled) return;
                  onSelect(option.id);
                }}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.promoChip,
                  selected && styles.promoChipSelected,
                  disabled && styles.promoChipDisabled,
                  pressed && !disabled && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.promoChipText,
                    selected && styles.promoChipTextSelected,
                    disabled && styles.promoChipTextDisabled,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
      </View>

      {!promoValidation.valid && (
        <View style={styles.offerWarningBox}>
          <Text style={styles.offerWarning}>
            ⚠️ {promoValidation.message ?? "Oferta no válida"}
          </Text>
        </View>
      )}
    </View>
  );
}

function Contenedor({ pricing, onChange, currencySymbol, isUnitInvalid }) {
  return (
    <View style={styles.cardContenedor}>
      <Unidades
        qty={pricing.qty}
        price={pricing.unitPrice}
        unit={pricing.unit}
        currencySymbol={currencySymbol}
        onChangeQty={(v) => {
          if (pricing.unit === "u") {
            const cleaned = v.replace(/[^0-9]/g, "");
            onChange({ qty: cleaned });
          } else {
            onChange({ qty: v });
          }
        }}
        onChangePrice={(v) => onChange({ unitPrice: v })}
        onChangeUnit={(v) => {
          if (v !== "u" && pricing.promo !== "none") {
            const promo = normalizePromotion(pricing.promo);

            if (promo.type === "multi") {
              onChange({
                unit: v,
                promo: "none",
              });
              return;
            }
          }

          onChange({ unit: v });
        }}
        showError={isUnitInvalid}
      />

      <Ofertas
        quantity={pricing.qty}
        unitPrice={pricing.unitPrice}
        selectedPromo={pricing.promo}
        onSelect={(v) => onChange({ promo: v })}
        unit={pricing.unit}
      />
    </View>
  );
}

function SummaryRow({ label, value, bold, valueStyle }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>

      <Text
        style={[
          styles.summaryValue,
          bold && styles.summaryValueBold,
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Summary({ base, savings, total }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Resumen</Text>

      <SummaryRow label="Base imponible" value={formatCurrency(base)} />

      {savings > 0 && (
        <SummaryRow
          label="Descuento oferta"
          value={`-${formatCurrency(savings)}`}
          valueStyle={styles.summaryValueDiscount}
        />
      )}

      <SummaryRow label="Total" value={formatCurrency(total)} bold />
    </View>
  );
}

export default function ItemDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const { listId, itemId } = route.params || {};

  const { lists, updateItem, deleteItem } = useLists();
  const list = lists.find((l) => l.id === listId);
  const item = list?.items.find((i) => i.id === itemId);

  const [name, setName] = useState(item?.name ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");

  const [pricing, setPricing] = useState({
    qty: String(item?.priceInfo?.qty ?? "1"),
    unitPrice: String(item?.priceInfo?.unitPrice ?? "0"),
    unit: item?.priceInfo?.unit ?? "u",
    promo: item?.priceInfo?.promo ?? "none",
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Editar producto",
      headerTitleAlign: "center",
      headerTransparent: false,
    });
  }, [navigation]);

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Producto no encontrado</Text>
      </SafeAreaView>
    );
  }

  const updatePricing = (patch) => {
    setPricing((prev) => ({ ...prev, ...patch }));
  };

  const rawListCurrency = list?.currency ?? DEFAULT_CURRENCY;

  const listCurrencyCode =
    typeof rawListCurrency === "string"
      ? rawListCurrency
      : rawListCurrency?.code || DEFAULT_CURRENCY.code;

  const listCurrencySymbol =
    typeof rawListCurrency === "string"
      ? rawListCurrency
      : rawListCurrency?.symbol || DEFAULT_CURRENCY.symbol;

  const priceInfo = useMemo(() => {
    return PricingEngine.calculate({
      qty: Number(pricing.qty.replace(",", ".")) || 0,
      unit: pricing.unit,
      unitPrice: Number(pricing.unitPrice.replace(",", ".")) || 0,
      promo: pricing.promo,
      currency: listCurrencyCode,
    });
  }, [pricing, listCurrencyCode]);

  const isUnitInvalid = pricing.unit === "u" && hasDecimals(pricing.qty);

  const handleSave = () => {
    if (!name.trim()) {
      safeAlert("Nombre vacío", "El producto debe tener un nombre");
      return;
    }

    if (isUnitInvalid) {
      safeAlert(
        "Cantidad inválida",
        "Para unidades (u) la cantidad debe ser un número entero",
      );
      return;
    }

    const promoValidation = validatePromotionUnit(
      normalizePromotion(pricing.promo),
      pricing.unit,
    );

    if (!promoValidation.valid) {
      safeAlert("Oferta inválida", promoValidation.message);
      return;
    }

    updateItem(listId, itemId, {
      name: name.trim(),
      barcode: barcode.trim(),
      unit: pricing.unit,
      priceInfo,
    });

    navigation.goBack();
  };

  const handleDelete = () => {
    safeAlert(
      "Eliminar producto",
      `¿Seguro que quieres eliminar "${item.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            deleteItem(listId, itemId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleSearch = async () => {
    const code = barcode.trim();

    if (!code) {
      safeAlert(
        "Código vacío",
        "Introduce o escanea un código de barras primero",
      );
      return;
    }

    try {
      const settings = await getSearchSettings();
      const engineKey = settings?.generalEngine || "google";
      const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES.google;

      Linking.openURL(engine.buildUrl(code));
    } catch (e) {
      safeAlert("Error", "No se pudo abrir el buscador");
    }
  };

  function handleOpenScanner() {
    navigation.navigate(ROUTES.SCANNER_TAB, {
      screen: ROUTES.SCANNER_SCREEN,
      params: {
        saveToHistory: false,
        closeOnScan: true,
        returnToTab: ROUTES.SHOPPING_TAB,
        onScan: (code) => {
          setBarcode(code);
        },
      },
    });
  }

  function hasDecimals(value) {
    const n = Number(String(value).replace(",", "."));
    if (Number.isNaN(n)) return false;
    return !Number.isInteger(n);
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <SafeAreaView
        style={styles.container}
        edges={["left", "right", "bottom"]}
      >
        <View style={styles.screen}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            showsVerticalScrollIndicator={false}
          >
            <CardNombreBarcode
              nameItem={name}
              barcodeItem={barcode}
              onChangeName={setName}
              onChangeBarcode={setBarcode}
              onScanner={handleOpenScanner}
              onSearch={handleSearch}
            />

            <Contenedor
              pricing={pricing}
              onChange={updatePricing}
              currencySymbol={listCurrencySymbol}
              isUnitInvalid={isUnitInvalid}
            />

            <Summary
              base={priceInfo.subtotal}
              savings={priceInfo.savings}
              total={priceInfo.total}
            />
          </ScrollView>

          <View
            style={[
              styles.actions,
              {
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={styles.saveText}>Guardar</Text>
            </Pressable>

            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.deleteText}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },

  screen: {
    flex: 1,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },

  card0: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderColor: "#e5e7eb",
    gap: 5,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 5,
  },

  cardContenedor: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 16,
  },

  ofertasHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  promoHintInline: {
    fontSize: 13,
    color: "#6b7280",
    flexShrink: 1,
    textAlign: "right",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },

  inputError: {
    marginTop: 6,
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "500",
  },

  inputNum: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    color: "#111827",
  },

  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  unitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  unitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  unitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
  },

  unitBtnActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  unitText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },

  unitTextActive: {
    color: "#fff",
  },

  unitHint: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 0,
  },

  divider: {
    marginTop: 10,
  },

  inlineRow: {
    flexDirection: "row",
    gap: 12,
  },

  inlineField: {
    flex: 1,
  },

  promoWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 0,
  },

  promoChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
  },

  promoChipSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  promoChipDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    opacity: 1,
  },

  promoChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },

  promoChipTextSelected: {
    color: "#fff",
  },

  promoChipTextDisabled: {
    color: "#9ca3af",
  },

  offerWarningBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
  },

  offerWarning: {
    color: "#9a3412",
    fontSize: 13,
    fontWeight: "500",
  },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  summaryLabel: {
    fontSize: 14,
    color: "#374151",
  },

  summaryValue: {
    fontSize: 14,
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },

  summaryValueBold: {
    fontSize: 16,
    fontWeight: "700",
  },

  summaryValueDiscount: {
    color: "#16a34a",
    fontWeight: "600",
  },

  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f2f2f7",
  },

  saveBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#22c55e",
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "700",
  },

  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#ef4444",
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  deleteText: {
    color: "#fff",
    fontWeight: "700",
  },
});
