import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { UNITS } from "../../constants/unitTypes";
import { ROUTES } from "../../navigation/ROUTES";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { buildHeaderConfig } from "../../utils/layout/headerStyles";

import { getSearchSettings } from "../../src/storage/settingsStorage";
import { DEFAULT_CURRENCY } from "../../constants/currency";
import { SEARCH_ENGINES } from "../../constants/searchEngines";
import { PRODUCT_CATEGORIES } from "../../constants/categories";
import { useLists } from "../../context/ListsContext";
import BarcodeInput from "../../components/ui/BarcodeInput";

import CategoryImageSelector from "../../components/features/search/CategoryImageSelector";

import {
  PricingEngine,
  PROMOTIONS,
  normalizePromotion,
  validatePromotion,
} from "../../utils/pricing/PricingEngine";
import { validatePromotionUnit } from "../../utils/pricing";
import { formatCurrency } from "../../utils/store/prices";
import { formatUnit } from "../../utils/pricing/unitFormat";
import { safeAlert, safeMenu } from "../../components/ui/alert/safeAlert";

const normalizeCategoryToken = (value = "") => {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const makeCategoryTokenId = (value = "") => {
  return normalizeCategoryToken(value).replace(/\s+/g, "_");
};

const getSubcategoryName = (subcategory) => {
  if (!subcategory) return null;

  return typeof subcategory === "string"
    ? subcategory
    : (subcategory.name ?? subcategory.label ?? subcategory.title ?? null);
};

const getSubcategoryId = (subcategory) => {
  const name = getSubcategoryName(subcategory);

  if (!subcategory) return null;

  return typeof subcategory === "string"
    ? makeCategoryTokenId(subcategory)
    : (subcategory.id ?? subcategory.key ?? makeCategoryTokenId(name));
};

function ProductHero({ name, barcode }) {
  const title = name?.trim() || "Producto sin nombre";
  const subtitle = barcode?.trim()
    ? `EAN: ${barcode.trim()}`
    : "Edita cantidad, precio, unidad y ofertas";

  return (
    <View style={styles.productHero}>
      <View style={styles.productIconCircle}>
        <Ionicons name="cube-outline" size={24} color="#2563eb" />
      </View>

      <View style={styles.productHeroText}>
        <Text style={styles.productHeroTitle} numberOfLines={1}>
          {title}
        </Text>

        <Text style={styles.productHeroSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon ? <Ionicons name={icon} size={18} color="#2563eb" /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

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
      <SectionTitle
        icon="pricetag-outline"
        title="Producto"
        subtitle="Nombre visible en la lista y código EAN-13"
      />

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

      <View style={styles.fieldGap} />

      <Text style={styles.label}>Código de barras</Text>

      <BarcodeInput
        value={barcodeItem}
        onChangeText={onChangeBarcode}
        onPressScanner={onScanner}
        onPressSearch={onSearch}
      />
    </View>
  );
}

function Categorias({
  selectedCategoryId,
  selectedSubcategoryId,
  onChangeCategory,
  onChangeSubcategory,
  expanded,
  onExpandedChange,
}) {
  const selectedCategory = PRODUCT_CATEGORIES.find(
    (category) => category.id === selectedCategoryId,
  );

  const selectedSubcategory = selectedCategory?.subcategories?.find(
    (subcategory) => {
      return getSubcategoryId(subcategory) === selectedSubcategoryId;
    },
  );

  const selectedSubcategoryName = getSubcategoryName(selectedSubcategory);
  const hasCategory = Boolean(selectedCategory);
  const hasSubcategory = Boolean(selectedSubcategoryName);

  return (
    <View
      style={[
        styles.categoryCompactCard,
        expanded && styles.categoryCompactCardExpanded,
      ]}
    >
      <Pressable
        style={[
          styles.categoryCompactHeader,
          expanded && styles.categoryCompactHeaderExpanded,
        ]}
        onPress={() => onExpandedChange?.(!expanded)}
      >
        <View style={styles.categoryCompactLeft}>
          <View style={styles.categoryIconBox}>
            <Ionicons name="albums-outline" size={18} color="#2563EB" />
          </View>

          <View style={styles.categoryTextBlock}>
            <Text style={styles.categoryCompactTitle}>Categoría</Text>

            <View style={styles.categoryChipsRow}>
              <View
                style={[
                  styles.categoryChip,
                  hasCategory && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    hasCategory && styles.categoryChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {selectedCategory?.name ?? "Sin categoría"}
                </Text>
              </View>

              {hasSubcategory ? (
                <View style={styles.subcategoryChip}>
                  <Text style={styles.subcategoryChipText} numberOfLines={1}>
                    {selectedSubcategoryName}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#64748B"
        />
      </Pressable>

      {expanded ? (
        <View style={styles.categoryCompactBody}>
          <CategoryImageSelector
            categories={PRODUCT_CATEGORIES}
            selectedCategoryId={selectedCategoryId}
            selectedSubcategoryId={selectedSubcategoryId}
            showTitle={false}
            subcategoryTitle="Subcategoría"
            onChange={(category) => {
              onChangeCategory(category);
            }}
            onSubcategoryChange={(subcategory) => {
              onChangeSubcategory(subcategory);
            }}
          />
        </View>
      ) : null}
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
  const [showUnits, setShowUnits] = useState(false);

  const unitLabel =
    {
      u: "Unidad",
      kg: "Kilogramos",
      g: "Gramos",
      l: "Litros",
    }[unit] ?? "Unidad";

  const handleToggleUnits = () => {
    setShowUnits((prev) => !prev);
  };

  const handleSelectUnit = (nextUnit) => {
    onChangeUnit(nextUnit);
    setShowUnits(false);
  };

  return (
    <View style={styles.card}>
      <SectionTitle
        icon="calculator-outline"
        title="Precio y cantidad"
        subtitle="Define cómo se calcula el importe del producto"
      />

      <Pressable style={styles.dropdownHeader} onPress={handleToggleUnits}>
        <View style={styles.dropdownHeaderLeft}>
          <Text style={styles.dropdownLabel}>Unidad</Text>
        </View>

        <View style={styles.dropdownHeaderRight}>
          <Text style={styles.dropdownValue} numberOfLines={1}>
            {unitLabel}
          </Text>

          <Ionicons
            name={showUnits ? "chevron-up" : "chevron-down"}
            size={20}
            color="#64748b"
          />
        </View>
      </Pressable>

      {showUnits ? (
        <View style={styles.dropdownBody}>
          <View style={styles.chipRow}>
            {UNITS.map((u) => (
              <Pressable
                key={u}
                style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                onPress={() => handleSelectUnit(u)}
              >
                <Text
                  style={[styles.unitText, unit === u && styles.unitTextActive]}
                >
                  {formatUnit(u)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.priceGrid}>
        <View style={styles.inlineField}>
          <Text style={styles.label}>Cantidad ({formatUnit(unit)})</Text>

          <TextInput
            keyboardType={unit === "u" ? "number-pad" : "decimal-pad"}
            inputMode={unit === "u" ? "numeric" : "decimal"}
            style={[styles.inputNum, showError && styles.inputDanger]}
            value={qty}
            onChangeText={onChangeQty}
          />

          {showError ? (
            <Text style={styles.inputError}>
              Solo enteros para unidades (u)
            </Text>
          ) : null}
        </View>

        <View style={styles.inlineField}>
          <Text style={styles.label}>
            Precio ({currencySymbol}/{formatUnit(unit)})
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
  );
}

function Ofertas({ quantity, unitPrice, selectedPromo, onSelect, unit }) {
  const [showPromos, setShowPromos] = useState(false);

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

  const promoLabel =
    selectedOption?.label ??
    (selectedPromoSafe === "none" ? "Sin oferta" : String(selectedPromoSafe));

  const hint = selectedOption?.hint;

  const handleTogglePromos = () => {
    setShowPromos((prev) => !prev);
  };

  const handleSelectPromo = (promoId) => {
    onSelect(promoId);
    setShowPromos(false);
  };

  return (
    <View style={styles.card}>
      <SectionTitle
        icon="sparkles-outline"
        title="Oferta"
        subtitle="Aplica promociones compatibles con la unidad elegida"
      />

      <Pressable style={styles.dropdownHeader} onPress={handleTogglePromos}>
        <View style={styles.dropdownHeaderLeft}>
          <Text style={styles.dropdownLabel}>Promoción</Text>
        </View>

        <View style={styles.dropdownHeaderRight}>
          <Text
            style={[
              styles.dropdownValue,
              selectedPromoSafe !== "none" && styles.dropdownValueActive,
            ]}
            numberOfLines={1}
          >
            {promoLabel}
          </Text>

          <Ionicons
            name={showPromos ? "chevron-up" : "chevron-down"}
            size={20}
            color="#64748b"
          />
        </View>
      </Pressable>

      {showPromos ? (
        <View style={styles.dropdownBody}>
          {selectedPromoSafe !== "none" && hint ? (
            <View style={styles.promoHintBox}>
              <Ionicons name="bulb-outline" size={16} color="#92400e" />
              <Text style={styles.promoHintText}>{hint}</Text>
            </View>
          ) : null}

          <View style={styles.chipRow}>
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
                      handleSelectPromo(option.id);
                    }}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.promoChip,
                      selected && styles.promoChipSelected,
                      disabled && styles.promoChipDisabled,
                      pressed && !disabled && styles.pressed,
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
        </View>
      ) : null}

      {!promoValidation.valid ? (
        <View style={styles.offerWarningBox}>
          <Ionicons name="warning-outline" size={16} color="#9a3412" />
          <Text style={styles.offerWarning}>
            {promoValidation.message ?? "Oferta no válida"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Contenedor({ pricing, onChange, currencySymbol, isUnitInvalid }) {
  return (
    <>
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
    </>
  );
}

function SummaryRow({ label, value, bold, valueStyle }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>
        {label}
      </Text>

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
      <View style={styles.summaryHeader}>
        <View>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <Text style={styles.summarySubtitle}>Importe calculado</Text>
        </View>

        <View style={styles.summaryIconCircle}>
          <Ionicons name="receipt-outline" size={20} color="#16a34a" />
        </View>
      </View>

      <View style={styles.summaryRows}>
        <SummaryRow label="Base" value={formatCurrency(base)} />

        {savings > 0 ? (
          <SummaryRow
            label="Descuento oferta"
            value={`-${formatCurrency(savings)}`}
            valueStyle={styles.summaryValueDiscount}
          />
        ) : null}

        <View style={styles.summaryDivider} />

        <SummaryRow label="Total" value={formatCurrency(total)} bold />
      </View>
    </View>
  );
}

export default function ItemDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const headerConfig = useMemo(
    () =>
      buildHeaderConfig({
        title: "Editar producto",
        preset: "light",
      }),
    [],
  );

  const { listId, itemId } = route.params || {};

  const { lists, updateItem, deleteItem } = useLists();
  const list = lists.find((l) => l.id === listId);
  const item = list?.items.find((i) => i.id === itemId);

  const [name, setName] = useState(item?.name ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    item?.categoryId ?? null,
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(
    item?.subcategoryId ?? null,
  );

  const [categoryExpanded, setCategoryExpanded] = useState(false);

  const [pricing, setPricing] = useState({
    qty: String(item?.priceInfo?.qty ?? "1"),
    unitPrice: String(item?.priceInfo?.unitPrice ?? "0"),
    unit: item?.priceInfo?.unit ?? "u",
    promo: item?.priceInfo?.promo ?? "none",
  });

  useLayoutEffect(() => {
    navigation.setOptions(headerConfig.navigationOptions);
  }, [navigation, headerConfig]);

  useFocusEffect(
    useCallback(() => {
      const scannedBarcode = route.params?.scannedBarcode;

      if (!scannedBarcode) return;

      setBarcode(String(scannedBarcode));

      navigation.setParams({
        scannedBarcode: undefined,
      });
    }, [navigation, route.params?.scannedBarcode]),
  );

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

  const selectedCategory = useMemo(() => {
    return (
      PRODUCT_CATEGORIES.find(
        (category) => category.id === selectedCategoryId,
      ) ?? null
    );
  }, [selectedCategoryId]);

  const selectedSubcategory = useMemo(() => {
    if (!selectedCategory || !Array.isArray(selectedCategory.subcategories)) {
      return null;
    }

    return (
      selectedCategory.subcategories.find((subcategory) => {
        return getSubcategoryId(subcategory) === selectedSubcategoryId;
      }) ?? null
    );
  }, [selectedCategory, selectedSubcategoryId]);

  const selectedSubcategoryName = getSubcategoryName(selectedSubcategory);
  const handleChangeCategory = (category) => {
    if (!category) return;

    setSelectedCategoryId(category.id);
    setSelectedSubcategoryId(null);

    updateItem(listId, itemId, {
      categoryId: category.id,
      categoryName: category.name,
      subcategoryId: null,
      subcategoryName: null,
    });
  };

  const handleChangeSubcategory = (subcategory) => {
    if (!selectedCategory || !subcategory) return;

    const subcategoryId = getSubcategoryId(subcategory);
    const subcategoryName = getSubcategoryName(subcategory);

    setSelectedSubcategoryId(subcategoryId);

    updateItem(listId, itemId, {
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      subcategoryId,
      subcategoryName,
    });

    // Cierra automáticamente el selector después de elegir subcategoría.
    setCategoryExpanded(false);
  };
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
      categoryId: selectedCategory?.id ?? null,
      categoryName: selectedCategory?.name ?? null,
      subcategoryId: selectedSubcategoryId ?? null,
      subcategoryName: selectedSubcategoryName ?? null,
    });

    navigation.goBack();
  };

  const handleDelete = () => {
    safeAlert(
      "Eliminar producto",
      `¿Seguro que quieres eliminar "${item?.name}"?`,
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

  const handleOpenActions = () => {
    safeMenu(
      "Opciones del producto",
      `Selecciona qué quieres hacer con "${item?.name ?? "este producto"}".`,
      [
        {
          text: "Guardar",
          onPress: handleSave,
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: handleDelete,
        },
        {
          text: "Salir",
          onPress: () => navigation.goBack(),
        },
        {
          text: "Cancelar",
          style: "cancel",
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
      screen: ROUTES.PRODUCT_BARCODE_SCANNER,

      params: {
        listId,
        itemId,

        returnToTab: ROUTES.SHOPPING_TAB,

        /*
         * Escáner ultraligero:
         * solo devuelve el número EAN-13.
         */
        captureMode: "ean13-input",

        barcodeTypes: ["ean13"],

        showControls: false,
      },
    });
  }

  function hasDecimals(value) {
    const n = Number(String(value).replace(",", "."));
    if (Number.isNaN(n)) return false;
    return !Number.isInteger(n);
  }

  if (!item) {
    return (
      <View style={styles.keyboardView}>
        <StatusBar {...headerConfig.statusBar} />

        <SafeAreaView style={styles.container} edges={["left", "right"]}>
          <View style={styles.center}>
            <Text style={styles.notFoundText}>Producto no encontrado</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar {...headerConfig.statusBar} />

      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              categoryExpanded && styles.contentCategoryExpanded,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            showsVerticalScrollIndicator={false}
          >
            {!categoryExpanded ? (
              <>
                <ProductHero name={name} barcode={barcode} />

                <CardNombreBarcode
                  nameItem={name}
                  barcodeItem={barcode}
                  onChangeName={setName}
                  onChangeBarcode={setBarcode}
                  onScanner={handleOpenScanner}
                  onSearch={handleSearch}
                />
              </>
            ) : null}
            <Categorias
              selectedCategoryId={selectedCategoryId}
              selectedSubcategoryId={selectedSubcategoryId}
              expanded={categoryExpanded}
              onExpandedChange={setCategoryExpanded}
              onChangeCategory={handleChangeCategory}
              onChangeSubcategory={handleChangeSubcategory}
            />
            {!categoryExpanded ? (
              <>
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
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
        {!categoryExpanded ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.optionsButton}
              onPress={handleOpenActions}
              activeOpacity={0.75}
            >
              <Ionicons
                name="ellipsis-horizontal-circle-outline"
                size={23}
                color="#2563EB"
              />

              <Text style={styles.optionsButtonText}>Opciones</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },

  screen: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  notFoundText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 16,
  },

  productHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },

  productIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },

  productHeroText: {
    flex: 1,
    minWidth: 0,
  },

  productHeroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  productHeroSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },

  categoryCard: {
    paddingBottom: 10,
  },

  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },

  fieldGap: {
    height: 12,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },

  inputDanger: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff7f7",
  },

  inputError: {
    marginTop: 6,
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "600",
  },

  inputNum: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    color: "#111827",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  optionsButton: {
    flex: 1,
    height: 50,
    borderRadius: 10,

    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#CBD5E1",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,

    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 1,
  },

  optionsButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
  },

  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },

  barcodeInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 18,
    fontSize: 16,
    color: "#111827",
  },

  input1: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  squareButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },

  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  dropdownHeaderLeft: {
    flexShrink: 0,
  },

  dropdownHeaderRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginLeft: 12,
  },

  dropdownLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },

  dropdownValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    flexShrink: 1,
    textAlign: "right",
  },

  dropdownValueActive: {
    color: "#111827",
    fontWeight: "800",
  },

  dropdownBody: {
    marginTop: 12,
  },

  categoryDropdownBody: {
    marginTop: 12,
    marginHorizontal: 0,
    marginBottom: -4,
    overflow: "hidden",
  },

  categorySelectorInner: {
    marginHorizontal: -4,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  unitBtn: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },

  unitBtnActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  unitText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },

  unitTextActive: {
    color: "#fff",
  },

  priceGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },

  inlineField: {
    flex: 1,
  },

  promoHintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },

  promoHintText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
    lineHeight: 18,
    fontWeight: "500",
  },

  promoChip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },

  promoChipSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  promoChipDisabled: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
  },

  promoChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },

  promoChipTextSelected: {
    color: "#fff",
  },

  promoChipTextDisabled: {
    color: "#9ca3af",
  },

  pressed: {
    opacity: 0.8,
  },

  offerWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
  },

  offerWarning: {
    flex: 1,
    color: "#9a3412",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dcfce7",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },

  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  summarySubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },

  summaryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryRows: {
    gap: 8,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  summaryLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },

  summaryLabelBold: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  summaryValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  summaryValueBold: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },

  summaryValueDiscount: {
    color: "#16a34a",
    fontWeight: "800",
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 4,
  },

  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
  },

  actionsButton: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  actionsButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  saveBtn: {
    flex: 1.4,
    flexDirection: "row",
    gap: 7,
    backgroundColor: "#16a34a",
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },

  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  deleteText: {
    color: "#dc2626",
    fontWeight: "800",
    fontSize: 15,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 74,
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 20,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  deleteButton: {
    flex: 0.85,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  deleteButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#DC2626",
  },

  saveButton: {
    flex: 1.15,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  saveButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  categoryCompactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },

  categoryCompactHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },

  categoryCompactLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  categoryIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  categoryTextBlock: {
    flex: 1,
    minWidth: 0,
  },

  categoryCompactTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 6,
  },

  categoryChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },

  categoryChip: {
    maxWidth: "58%",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  categoryChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },

  categoryChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },

  categoryChipTextActive: {
    color: "#1D4ED8",
  },

  subcategoryChip: {
    flexShrink: 1,
    maxWidth: "42%",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  subcategoryChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#15803D",
  },

  categoryCompactBody: {
    flex: 1,
    minHeight: 0,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },

  contentCategoryExpanded: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 24,
  },

  categoryCompactCardExpanded: {
    flex: 1,
    minHeight: 0,
  },
});
