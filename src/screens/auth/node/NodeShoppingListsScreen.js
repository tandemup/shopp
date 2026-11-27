import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NodeScannerUtility, NodeStoresUtility } from "./NodeUtilityScreens";
import { parseYouTubeUrl } from "@/src/services/urlSafety";
import { API_BASE_URL } from "@/src/api/config";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { getEnabledBarcodeFormats } from "@/src/storage/barcodeSettingsStorage";
import { nodeShoppingListsApi } from "@/src/api/providers/node/shoppingLists";
import { nodeProductsApi } from "@/src/api/providers/node/products";
import { nodeProductReviewsApi } from "@/src/api/providers/node/productReviews";
import { nodeScanHistoryApi } from "@/src/api/providers/node/scanHistory";
import { nodeStoresApi } from "@/src/api/providers/node/stores";
import { nodeStoreOffersApi } from "@/src/api/providers/node/storeOffers";
import { DEFAULT_CURRENCY } from "@/src/constants/currency";
import { PRODUCT_CATEGORIES } from "@/src/constants/categories";
import { buildPurchaseHistoryFromArchivedLists } from "@/src/utils/buildPurchaseHistoryFromArchivedLists";
import { findBestCategoryMatch } from "@/src/utils/categoryMatcher";
import { normalizeBarcode, isSupportedRetailBarcode } from "@/src/utils/barcodeNormalization";

function explain(error) {
  return error?.message || "No se pudo completar la operación con el servidor.";
}

function parseAmount(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value, currency = "EUR") {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

function confirmAction(title, message, onConfirm) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: "Continuar", style: "destructive", onPress: onConfirm },
  ]);
}

function ActionButton({ icon, label, onPress, danger = false }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, danger && styles.actionDanger, pressed && styles.pressed]}>
      <Ionicons name={icon} size={17} color={danger ? "#dc2626" : "#2563eb"} />
      <Text style={[styles.actionText, danger && styles.actionDangerText]}>{label}</Text>
    </Pressable>
  );
}

export const openNodeDashboard = async (user) => {
    if (user?.role !== "admin") return;

    try {
      const url = new URL("/dashboard/", API_BASE_URL);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Protocolo no válido");
      }
      await Linking.openURL(url.origin + url.pathname);
    } catch {
      safeAlert("Panel del servidor", "No se pudo abrir el panel. Revisa la URL del servidor Node.");
    }
  };

export default function NodeShoppingListsScreen({ section = "shopping", storePage, onBackFromStores, user, accessToken, onSignOut, onOpenProfile, onOpenMusic, onOpenClassical, onOpenChat }) {
  const isDashboardAdmin = user?.role === "admin";
  const openDashboard = () => openNodeDashboard(user);
  const canUseScanner = user?.role === "admin" || user?.permissions?.scanner === true;
  const canUseStores = user?.role === "admin" || user?.permissions?.stores === true;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannerLockedRef = useRef(false);
  const [barcodeTypes, setBarcodeTypes] = useState([]);
  const [searchCode, setSearchCode] = useState("");
  const [scannerMode, setScannerMode] = useState("barcode");
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [itemEditorVisible, setItemEditorVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState({ name: "", quantity: "1", unit: "u", unitPrice: "0", barcode: "", categoryName: "" });
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanHint, setScanHint] = useState("");
  const [scannerTabHint, setScannerTabHint] = useState("");
  const [stores, setStores] = useState([]);
  const [storePickerVisible, setStorePickerVisible] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState("");
  const [offers, setOffers] = useState([]);
  const [offersVisible, setOffersVisible] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState("");
  const [offerTab, setOfferTab] = useState("store");
  const [myOffers, setMyOffers] = useState([]);
  const [myOffersLoading, setMyOffersLoading] = useState(false);
  const [offerFormVisible, setOfferFormVisible] = useState(false);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerDraft, setOfferDraft] = useState({ productName: "", barcode: "", offerText: "" });
  const [offerSubmitted, setOfferSubmitted] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [editingListId, setEditingListId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadLists = useCallback(async (showSpinner = true) => {
    if (!accessToken) return;
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const result = await nodeShoppingListsApi.list(accessToken);
      setLists(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(explain(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const loadStores = useCallback(async () => {
    if (!accessToken || !canUseStores) { setStores([]); setStoreLoading(false); return; }
    setStoreLoading(true);
    setStoreError("");
    try {
      const result = await nodeStoresApi.list(accessToken);
      setStores(Array.isArray(result) ? result : []);
    } catch (err) {
      setStoreError(explain(err));
    } finally {
      setStoreLoading(false);
    }
  }, [accessToken, canUseStores]);

  useEffect(() => { loadStores(); }, [loadStores]);

  useEffect(() => {
    const query = itemDraft.name.trim();
    if (!itemEditorVisible || query.length < 2) {
      setProductSearchResults([]);
      setProductSearchError("");
      setProductSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setProductSearchLoading(true);
      setProductSearchError("");
      try {
        const results = await nodeProductsApi.search(accessToken, query, 8);
        if (!cancelled) setProductSearchResults(results);
      } catch (err) {
        if (!cancelled) {
          setProductSearchResults([]);
          setProductSearchError(explain(err));
        }
      } finally {
        if (!cancelled) setProductSearchLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [accessToken, itemDraft.name, itemEditorVisible]);

  const activeLists = useMemo(() => lists.filter((list) => list.archived !== true), [lists]);
  const archivedLists = useMemo(() => lists.filter((list) => list.archived === true), [lists]);
  const visibleLists = showArchived ? archivedLists : activeLists;
  const selectedList = lists.find((list) => list.id === selectedId) || null;
  const storeOffers = selectedList?.storeId ? offers.filter((offer) => {
    if (offer.storeId !== selectedList.storeId) return false;
    const now = Date.now();
    return (!offer.startsAt || offer.startsAt <= now) && (!offer.endsAt || offer.endsAt >= now);
  }) : [];
  const purchaseHistory = useMemo(() => buildPurchaseHistoryFromArchivedLists(
    archivedLists.map((list) => ({
      ...list,
      items: (list.items || []).filter((item) => item?.checked === true),
    })),
  ), [archivedLists]);

  const run = async (operation) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await loadLists(false);
      return true;
    } catch (err) {
      setError(explain(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createList = () => {
    const name = newListName.trim();
    if (!name) return;
    Keyboard.dismiss();
    run(async () => {
      if (editingListId) {
        await nodeShoppingListsApi.update(accessToken, editingListId, { name });
      } else {
        const created = await nodeShoppingListsApi.create(accessToken, { name, currency: DEFAULT_CURRENCY.code, archived: false });
        setSelectedId(created.id);
        setShowArchived(false);
      }
      setNewListName("");
      setEditingListId(null);
      setCreateVisible(false);
    });
  };

  const openRename = (list) => {
    setEditingListId(list.id);
    setNewListName(list.name || "");
    setCreateVisible(true);
  };

  const openItemEditor = (item = null) => {
    setEditingItemId(item?.id || null);
    setItemDraft({
      name: item?.name || "",
      quantity: String(item?.quantity ?? item?.priceInfo?.qty ?? 1),
      unit: item?.unit || item?.priceInfo?.unit || "u",
      unitPrice: String(item?.unitPrice ?? item?.priceInfo?.unitPrice ?? 0),
      barcode: item?.barcode || "",
      categoryName: item?.categoryName || "",
    });
    setProductSearchResults([]);
    setProductSearchError("");
    setItemEditorVisible(true);
  };

  const chooseCatalogProduct = (product) => {
    setItemDraft((draft) => ({
      ...draft,
      name: product.name || draft.name,
      barcode: product.barcode || draft.barcode,
      categoryName: product.category || product.subcategory || draft.categoryName,
    }));
    Keyboard.dismiss();
    setProductSearchResults([]);
  };

  const showScanHint = section === "scanner" ? setScannerTabHint : setScanHint;

  const openScanner = async (mode = "barcode") => {
    if (!canUseScanner) { showScanHint("El administrador aún no ha activado el permiso de escáner para esta cuenta."); return; }
    Keyboard.dismiss();
    showScanHint("");
    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (!permission?.granted) {
          showScanHint("Hace falta conceder permiso de cámara para escanear.");
          return;
        }
      }
    } catch {
      showScanHint("No se pudo solicitar el permiso de cámara.");
      return;
    }
    scannerLockedRef.current = false;
    setScannerLocked(false);
    setTorchEnabled(false);
    if (mode !== "music") {
      const formats = (await getEnabledBarcodeFormats()).filter((format) => format !== "qr");
      if (!formats.length) {
        showScanHint("Activa un formato de código de barras en Ajustes para escanear productos.");
        return;
      }
      setBarcodeTypes(formats);
      setSearchCode("");
    }
    setScannerMode(mode === "music" ? "music" : "barcode");
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data, productType, notes }) => {
    if (scannerLockedRef.current) return;
    const barcode = normalizeBarcode(data);
    if (!isSupportedRetailBarcode(barcode)) return;
    scannerLockedRef.current = true;
    setSearchCode(barcode);
    setScannerLocked(true);
    setScannerVisible(false);
    setTorchEnabled(false);
    setProductSearchResults([]);
    setProductSearchError("");
    if (section !== "scanner") setItemDraft((draft) => ({ ...draft, name: "", barcode }));
    showScanHint(`Código ${barcode} leído. Consultando catálogo…`);

    try {
      let product = null;
      let catalogAvailable = false;
      try {
        const accessed = await nodeProductsApi.registerAccess(accessToken, barcode);
        product = accessed?.product || null;
        catalogAvailable = true;
      } catch {
        try {
          product = await nodeProductsApi.getByBarcode(accessToken, barcode);
          catalogAvailable = true;
        } catch { product = null; }
      }
      if (product && section !== "scanner") {
        setItemDraft((draft) => ({
          ...draft,
          name: product.name || "",
          barcode,
          categoryName: product.category || product.subcategory || draft.categoryName,
        }));
      }
      let historyError = false;
      await nodeScanHistoryApi.save(accessToken, {
        barcode,
        name: product?.name || null,
        brand: product?.brand || null,
        category: product?.category || null,
        subcategory: product?.subcategory || null,
        productType: productType || product?.productType || null,
        ...(notes ? { notes } : {}),
        source: productType ? "manual" : "scanner",
        scannedAt: new Date().toISOString(),
      }).catch(() => { historyError = true; });
      if (section === "scanner" && historyError) {
        showScanHint(`Código ${barcode} leído. No se pudo guardar en el historial.`);
        return;
      }
      showScanHint(section === "scanner"
        ? product?.name ? `${product.name} · ${barcode}` : (catalogAvailable ? `Código ${barcode} sin ficha en el catálogo.` : `Código ${barcode} leído. No se pudo consultar el catálogo.`)
        : product?.name
        ? `Producto encontrado: ${product.name}. Revisa sus datos.`
        : catalogAvailable
          ? `Código ${barcode} registrado. Añade el nombre y los datos del producto.`
          : `Código ${barcode} leído. No se pudo consultar el catálogo; puedes completar el producto manualmente.`);
    } finally {
      setScannerLocked(false);
      scannerLockedRef.current = false;
    }
  };

  const handleMusicQr = async ({ data }) => {
    if (scannerLockedRef.current) return;
    scannerLockedRef.current = true;
    setScannerVisible(false);
    setTorchEnabled(false);
    const link = parseYouTubeUrl(String(data || "").trim());
    if (!link.isValid) {
      showScanHint("El QR no contiene un enlace musical de YouTube compatible.");
      return;
    }
    try {
      await Linking.openURL(link.playableUrl);
    } catch {
      showScanHint("No se pudo abrir el enlace de la tarjeta musical.");
    }
  };

  const saveItem = () => {
    const name = itemDraft.name.trim();
    const quantity = parseAmount(itemDraft.quantity, 1);
    const unitPrice = parseAmount(itemDraft.unitPrice, 0);
    if (!name || quantity <= 0 || unitPrice < 0 || !selectedList) return;
    Keyboard.dismiss();
    const currency = typeof selectedList.currency === "string" ? selectedList.currency : selectedList.currency?.code || DEFAULT_CURRENCY.code;
    const categoryMatch = itemDraft.categoryName.trim()
      ? findBestCategoryMatch(itemDraft.categoryName.trim(), PRODUCT_CATEGORIES)
      : null;
    const patch = {
      name,
      quantity,
      unit: itemDraft.unit.trim() || "u",
      unitPrice,
      barcode: itemDraft.barcode.trim(),
      categoryName: itemDraft.categoryName.trim() || null,
      categoryId: categoryMatch?.categoryId ?? null,
      priceInfo: {
        ...(selectedList.items?.find((item) => item.id === editingItemId)?.priceInfo || {}),
        currency,
        qty: quantity,
        unit: itemDraft.unit.trim() || "u",
        unitPrice,
        subtotal: quantity * unitPrice,
        total: quantity * unitPrice,
        valid: true,
      },
    };
    run(async () => {
      if (editingItemId) {
        await nodeShoppingListsApi.updateItem(accessToken, selectedList.id, editingItemId, patch);
      } else {
        await nodeShoppingListsApi.addItem(accessToken, selectedList.id, { ...patch, checked: false });
      }
      if (/^\d{8,14}$/.test(patch.barcode)) {
        await nodeProductReviewsApi.submit(accessToken, {
          barcode: patch.barcode,
          name: patch.name,
          category: patch.categoryName,
          source: "user_review",
        }).catch(() => {});
      }
      setItemEditorVisible(false);
      setEditingItemId(null);
    });
  };

  const toggleItem = (item) => run(() => nodeShoppingListsApi.updateItem(accessToken, selectedList.id, item.id, { checked: !item.checked }));
  const deleteItem = (item) => confirmAction("Eliminar producto", `¿Quieres quitar «${item.name}» de la lista?`, () => run(() => nodeShoppingListsApi.removeItem(accessToken, selectedList.id, item.id)));
  const archiveList = (list) => run(() => nodeShoppingListsApi.update(accessToken, list.id, { archived: true, archivedAt: Date.now() }));
  const restoreList = (list) => run(() => nodeShoppingListsApi.update(accessToken, list.id, { archived: false, archivedAt: null }));
  const chooseStore = async (store) => {
    if (!selectedList) return;
    const saved = await run(() => nodeShoppingListsApi.update(accessToken, selectedList.id, { storeId: store?.id || null }));
    if (saved) setStorePickerVisible(false);
  };
  const toggleStoreFavorite = async (store) => {
    const favorite = !store.favorite;
    try {
      await nodeStoresApi.setFavorite(accessToken, store.id, favorite);
      setStores((current) => current.map((item) => item.id === store.id ? { ...item, favorite } : item));
    } catch (err) {
      setStoreError(explain(err));
    }
  };
  const openStoreOffers = async () => {
    if (!selectedList?.storeId) return;
    setOfferTab("store");
    setOffersVisible(true);
    setOffersLoading(true);
    setOffersError("");
    try {
      const result = await nodeStoreOffersApi.listApproved(200);
      setOffers(Array.isArray(result) ? result : []);
    } catch (err) {
      setOffersError(explain(err));
    } finally {
      setOffersLoading(false);
    }
  };
  const loadMyOffers = async () => {
    setOfferTab("mine");
    setOffersVisible(true);
    setMyOffersLoading(true);
    setOffersError("");
    try {
      const result = await nodeStoreOffersApi.listMine(accessToken);
      setMyOffers(Array.isArray(result) ? result : []);
    } catch (err) {
      setOffersError(explain(err));
    } finally {
      setMyOffersLoading(false);
    }
  };
  const addOfferToList = async (offer) => {
    if (!selectedList || selectedList.archived) return;
    const currency = typeof selectedList.currency === "string" ? selectedList.currency : selectedList.currency?.code || DEFAULT_CURRENCY.code;
    const name = String(offer.productName || "").trim();
    if (!name) return;
    const saved = await run(() => nodeShoppingListsApi.addItem(accessToken, selectedList.id, {
      name,
      barcode: offer.barcode || "",
      quantity: 1,
      unit: "u",
      unitPrice: 0,
      checked: false,
      priceInfo: { currency, qty: 1, unit: "u", unitPrice: 0, subtotal: 0, total: 0, promo: "offer", promoLabel: offer.offerText, summary: offer.offerText, valid: true },
    }));
    if (saved) setOffersVisible(false);
  };
  const submitStoreOffer = async () => {
    if (!selectedList?.storeId || !offerDraft.productName.trim() || !offerDraft.offerText.trim()) return;
    setOfferSubmitting(true);
    setOffersError("");
    try {
      await nodeStoreOffersApi.create(accessToken, {
        submissionType: "shopper",
        storeId: selectedList.storeId,
        productName: offerDraft.productName.trim(),
        offerText: offerDraft.offerText.trim(),
        ...(offerDraft.barcode.trim() ? { barcode: offerDraft.barcode.trim() } : {}),
      });
      setOfferDraft({ productName: "", barcode: "", offerText: "" });
      setOfferFormVisible(false);
      setOfferSubmitted(true);
      setOffersVisible(true);
      await loadMyOffers();
    } catch (err) {
      setOffersError(explain(err));
    } finally {
      setOfferSubmitting(false);
    }
  };
  const deleteList = (list) => confirmAction("Eliminar lista", `Se eliminará «${list.name}» y sus productos.`, () => run(async () => {
    await nodeShoppingListsApi.remove(accessToken, list.id);
    if (selectedId === list.id) setSelectedId(null);
  }));

  const renderList = ({ item }) => (
    <Pressable accessibilityRole="button" onPress={() => setSelectedId(item.id)} style={({ pressed }) => [styles.listCard, selectedId === item.id && styles.listCardSelected, pressed && styles.pressed]}>
      <View style={styles.listIcon}><Ionicons name={item.archived ? "archive-outline" : "basket-outline"} size={22} color="#2563eb" /></View>
      <View style={styles.listCopy}>
        <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.listMeta}>{item.items?.length || 0} productos · {typeof item.currency === "string" ? item.currency : item.currency?.code || DEFAULT_CURRENCY.code}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.brandRow}><View style={styles.logo}><Text style={styles.logoText}>S</Text></View><Text style={styles.brand}>Shopp</Text><View style={styles.mode}><Text style={styles.modeText}>NODE.JS</Text></View></View>
        <View style={styles.headerActions}>
          {isDashboardAdmin && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir panel del servidor"
              onPress={openDashboard}
              style={styles.chatButton}
            >
              <Ionicons name="speedometer-outline" size={20} color="#2563eb" />
            </Pressable>
          )}
          {onOpenChat ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir chat" onPress={onOpenChat} style={styles.chatButton}><Ionicons name="chatbubbles-outline" size={20} color="#2563eb" /></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Abrir mi perfil" onPress={onOpenProfile} style={styles.accountButton}>
          <Ionicons name="person-circle-outline" size={19} color="#475569" /><Text style={styles.accountText} numberOfLines={1}>{user?.name || user?.email || "Cuenta"}</Text><Ionicons name="chevron-forward" size={16} color="#64748b" />
        </Pressable><Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={onSignOut} style={styles.chatButton}><Ionicons name="log-out-outline" size={19} color="#64748b" /></Pressable></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {section === "stores" ? (
          <NodeStoresUtility key={storePage || "home"} initialPage={storePage} onBackFromEntry={onBackFromStores} accessToken={accessToken} stores={stores}
            storeLoading={storeLoading} storeError={storeError} loadStores={loadStores}
            toggleFavorite={toggleStoreFavorite} isAdmin={isDashboardAdmin} />
        ) : section === "scanner" ? (
          <NodeScannerUtility accessToken={accessToken} onCamera={openScanner} hint={scannerTabHint} searchCode={searchCode}
            isAdmin={isDashboardAdmin && __DEV__}
            onLookup={input => {
              if (!isSupportedRetailBarcode(normalizeBarcode(input.data))) throw new Error("Introduce un código de barras válido.");
              return handleBarcodeScanned(input);
            }} />
        ) : (
          <>
        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroDecorativeCircleOne} />
          <View pointerEvents="none" style={styles.heroDecorativeCircleTwo} />
          <View style={styles.heroContent}>
            <View style={styles.heroLabelRow}>
              <View style={styles.heroIcon}><Ionicons name="basket" size={22} color="#fff" /></View>
              <Text style={styles.eyebrow}>Tu asistente de compras</Text>
            </View>
            <Text style={styles.heroTitle}>Organiza mejor tus compras</Text>
            <Text style={styles.heroSubtitle}>Crea listas, consulta productos y accede rápidamente a las principales herramientas.</Text>
            <Pressable accessibilityRole="button" onPress={() => { setEditingListId(null); setNewListName(""); setCreateVisible(true); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <View style={styles.primaryButtonIcon}><Ionicons name="add" size={22} color="#2563eb" /></View>
              <Text style={styles.primaryButtonText}>Nueva lista</Text>
              <Ionicons name="arrow-forward" size={19} color="#fff" />
            </Pressable>
          </View>
        </View>

        {onOpenMusic || onOpenClassical ? (
          <View style={styles.utilityLinks}>
            {onOpenMusic ? (
              <Pressable accessibilityRole="button" onPress={onOpenMusic} style={styles.utilityLink}>
                <Ionicons name="musical-notes-outline" size={20} color="#2563eb" />
                <View style={styles.utilityCopy}>
                  <Text style={styles.utilityName}>Música</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#64748b" />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !onOpenClassical }}
              disabled={!onOpenClassical}
              onPress={onOpenClassical}
              style={styles.utilityLink}
            >
              <Ionicons name="library-outline" size={20} color={onOpenClassical ? "#2563eb" : "#64748b"} />
              <View style={styles.utilityCopy}>
                <Text style={styles.utilityName}>Música clásica</Text>
                {!onOpenClassical ? <Text style={styles.utilityStatus}>Acceso desactivado</Text> : null}
              </View>
              <Ionicons name={onOpenClassical ? "chevron-forward" : "lock-closed-outline"} size={16} color="#64748b" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}><View style={[styles.statIcon, styles.statIconBlue]}><Ionicons name="list-outline" size={20} color="#2563eb" /></View><View style={styles.statCopy}><Text style={styles.statNumber}>{activeLists.length}</Text><Text style={styles.statLabel}>Listas activas</Text></View></View>
          <View style={styles.statCard}><View style={[styles.statIcon, styles.statIconGreen]}><Ionicons name="archive-outline" size={20} color="#15803d" /></View><View style={styles.statCopy}><Text style={styles.statNumber}>{archivedLists.length}</Text><Text style={styles.statLabel}>Archivadas</Text></View></View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>{showHistory ? "Historial de compras" : "Mis listas"}</Text><Text style={styles.sectionSubtitle}>{showHistory ? `${purchaseHistory.length} productos comprados` : showArchived ? "Listas archivadas" : `${activeLists.length} listas activas`}</Text></View>
          <View style={styles.sectionActions}>
            <Pressable accessibilityRole="button" onPress={() => { setShowHistory((value) => !value); setSelectedId(null); }} style={styles.switchButton}><Ionicons name={showHistory ? "basket-outline" : "receipt-outline"} size={18} color="#2563eb" /><Text style={styles.switchText}>{showHistory ? "Listas" : "Compras"}</Text></Pressable>
            {!showHistory ? <Pressable accessibilityRole="button" onPress={() => { setShowArchived((current) => !current); setSelectedId(null); }} style={styles.switchButton}><Ionicons name={showArchived ? "list-outline" : "archive-outline"} size={18} color="#2563eb" /><Text style={styles.switchText}>{showArchived ? "Activas" : "Archivo"}</Text></Pressable> : null}
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={19} color="#b91c1c" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => loadLists()}><Text style={styles.retry}>Reintentar</Text></Pressable></View> : null}
        {loading ? <ActivityIndicator style={styles.loader} size="large" color="#2563eb" /> : showHistory ? purchaseHistory.length ? purchaseHistory.map((product) => (
          <View key={product.id} style={styles.historyCard}>
            <View style={styles.historyIcon}><Ionicons name="pricetag-outline" size={20} color="#7c3aed" /></View>
            <View style={styles.historyCopy}><Text style={styles.listName} numberOfLines={1}>{product.name}</Text><Text style={styles.listMeta}>{product.frequency} compras · {product.totalUnits} {product.unit || "u"} · última: {new Date(product.lastPurchasedAt).toLocaleDateString("es-ES")}</Text></View>
          </View>
        )) : <View style={styles.empty}><Ionicons name="receipt-outline" size={30} color="#94a3b8" /><Text style={styles.emptyTitle}>Aún no hay compras registradas</Text><Text style={styles.emptyText}>Al archivar una lista, sus productos marcados aparecerán aquí.</Text></View> : visibleLists.length ? <FlatList data={visibleLists} keyExtractor={(item) => item.id} renderItem={renderList} scrollEnabled={false} /> : <View style={styles.empty}><Ionicons name={showArchived ? "archive-outline" : "basket-outline"} size={30} color="#94a3b8" /><Text style={styles.emptyTitle}>{showArchived ? "No hay listas archivadas" : "Aún no tienes listas"}</Text><Text style={styles.emptyText}>{showArchived ? "Las listas que archives aparecerán aquí." : "Crea una lista para empezar a organizar tus compras."}</Text></View>}

        {selectedList ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}><Text style={styles.detailTitle}>{selectedList.name}</Text><Text style={styles.detailMeta}>{selectedList.items?.filter((item) => item.checked).length || 0} de {selectedList.items?.length || 0} productos marcados</Text></View>
              <Pressable accessibilityRole="button" onPress={() => setSelectedId(null)} style={styles.closeButton}><Ionicons name="close" size={20} color="#64748b" /></Pressable>
            </View>
            {canUseStores ? <View style={styles.storeSection}>
              <View style={styles.storeInfo}><Ionicons name="storefront-outline" size={19} color="#2563eb" /><View style={styles.storeTextBlock}><Text style={styles.storeLabel}>Tienda</Text><Text style={styles.storeName}>{stores.find((store) => store.id === selectedList.storeId)?.name || (selectedList.storeId ? `Tienda ${selectedList.storeId}` : "Sin tienda asignada")}</Text></View></View>
              {!selectedList.archived ? <View style={styles.storeActions}><Pressable accessibilityRole="button" onPress={() => { setStoreError(""); setStorePickerVisible(true); if (!stores.length) loadStores(); }} style={styles.storeChoose}><Text style={styles.storeChooseText}>{selectedList.storeId ? "Cambiar" : "Asignar"}</Text></Pressable>{selectedList.storeId ? <Pressable accessibilityRole="button" onPress={openStoreOffers} style={styles.storeChoose}><Ionicons name="pricetag-outline" size={15} color="#2563eb" /><Text style={styles.storeChooseText}>Ofertas</Text></Pressable> : null}</View> : null}
            </View> : null}
            {offerSubmitted ? <View style={styles.offerSubmitted}><Ionicons name="checkmark-circle-outline" size={19} color="#15803d" /><Text style={styles.offerSubmittedText}>Solicitud de oferta enviada; queda pendiente de revisión.</Text><Pressable onPress={() => setOfferSubmitted(false)}><Ionicons name="close" size={18} color="#64748b" /></Pressable></View> : null}
            {!selectedList.archived ? <Pressable accessibilityRole="button" onPress={() => openItemEditor()} style={styles.addProductButton}><Ionicons name="add-circle-outline" size={20} color="#2563eb" /><Text style={styles.addProductText}>Añadir producto</Text></Pressable> : null}
            {(() => {
              const selectedTotal = (selectedList.items || []).filter((item) => item.checked).reduce((sum, item) => {
                const total = Number(item.priceInfo?.total ?? item.total ?? (Number(item.unitPrice ?? item.priceInfo?.unitPrice ?? 0) * Number(item.quantity ?? item.priceInfo?.qty ?? 1)));
                return sum + (Number.isFinite(total) ? total : 0);
              }, 0);
              const currency = typeof selectedList.currency === "string" ? selectedList.currency : selectedList.currency?.code || DEFAULT_CURRENCY.code;
              return <View style={styles.subtotalRow}><Text style={styles.subtotalLabel}>Subtotal marcado</Text><Text style={styles.subtotalValue}>{formatMoney(selectedTotal, currency)}</Text></View>;
            })()}
            {selectedList.items?.length ? selectedList.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                {!selectedList.archived ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!item.checked }} onPress={() => toggleItem(item)} style={[styles.checkbox, item.checked && styles.checkboxChecked]}>{item.checked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</Pressable> : null}
                <Pressable disabled={!!selectedList.archived} onPress={() => openItemEditor(item)} style={styles.itemCopy}><Text style={[styles.itemName, item.checked && styles.itemChecked]}>{item.name}</Text><Text style={styles.itemMeta}>{Number(item.quantity ?? item.priceInfo?.qty ?? 1)} {item.unit || item.priceInfo?.unit || "u"} · {formatMoney(Number(item.unitPrice ?? item.priceInfo?.unitPrice ?? 0), typeof selectedList.currency === "string" ? selectedList.currency : selectedList.currency?.code || DEFAULT_CURRENCY.code)}{item.categoryName ? ` · ${item.categoryName}` : ""}</Text></Pressable>
                {!selectedList.archived ? <Pressable accessibilityRole="button" onPress={() => openItemEditor(item)} style={styles.deleteItem}><Ionicons name="create-outline" size={18} color="#64748b" /></Pressable> : null}
                {!selectedList.archived ? <Pressable accessibilityRole="button" onPress={() => deleteItem(item)} style={styles.deleteItem}><Ionicons name="trash-outline" size={18} color="#94a3b8" /></Pressable> : null}
              </View>
            )) : <Text style={styles.noItems}>Esta lista todavía no tiene productos.</Text>}
            <View style={styles.detailActions}>
              <ActionButton icon="create-outline" label="Renombrar" onPress={() => openRename(selectedList)} />
              {selectedList.archived ? <ActionButton icon="refresh-outline" label="Restaurar" onPress={() => restoreList(selectedList)} /> : <ActionButton icon="archive-outline" label="Archivar" onPress={() => archiveList(selectedList)} />}
              <ActionButton icon="trash-outline" label="Eliminar" danger onPress={() => deleteList(selectedList)} />
            </View>
          </View>
        ) : null}
        {busy ? <View style={styles.busy}><ActivityIndicator size="small" color="#2563eb" /><Text style={styles.busyText}>Guardando cambios…</Text></View> : null}
        <Text style={styles.footer}>Listas Node · sesión protegida con JWT</Text>
          </>
        )}
      </ScrollView>

      <Modal visible={createVisible} transparent animationType="fade" onRequestClose={() => { setCreateVisible(false); setNewListName(""); setEditingListId(null); }}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>{editingListId ? "Cambiar nombre" : "Crear lista"}</Text><Text style={styles.modalSubtitle}>{editingListId ? "Actualiza el nombre de la lista." : "Elige un nombre para tu lista de compra."}</Text><TextInput autoFocus value={newListName} onChangeText={setNewListName} placeholder="Por ejemplo, Compra semanal" placeholderTextColor="#94a3b8" style={styles.modalInput} returnKeyType="done" onSubmitEditing={createList} /><View style={styles.modalActions}><Pressable onPress={() => { setCreateVisible(false); setNewListName(""); setEditingListId(null); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable disabled={!newListName.trim() || busy} onPress={createList} style={[styles.createButton, (!newListName.trim() || busy) && styles.disabled]}><Text style={styles.createText}>{editingListId ? "Guardar" : "Crear"}</Text></Pressable></View></View></View>
      </Modal>
      <Modal visible={itemEditorVisible} transparent animationType="fade" onRequestClose={() => setItemEditorVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>{editingItemId ? "Editar producto" : "Añadir producto"}</Text><Text style={styles.modalSubtitle}>Guarda cantidades, precios y código de barras en la lista.</Text>
          <TextInput autoFocus value={itemDraft.name} onChangeText={(value) => setItemDraft((draft) => ({ ...draft, name: value }))} placeholder="Busca o escribe el producto" placeholderTextColor="#94a3b8" style={styles.modalInput} />
          {productSearchLoading ? <ActivityIndicator style={styles.searchSpinner} size="small" color="#2563eb" /> : null}
          {productSearchError ? <Text style={styles.searchError}>No se pudo consultar el catálogo; puedes escribir el producto manualmente.</Text> : null}
          {productSearchResults.length ? <View style={styles.suggestions}><Text style={styles.suggestionsTitle}>Coincidencias del catálogo</Text>{productSearchResults.map((product) => <Pressable key={product.barcode} onPress={() => chooseCatalogProduct(product)} style={styles.suggestionRow}><Ionicons name="pricetag-outline" size={17} color="#2563eb" /><View style={styles.suggestionCopy}><Text style={styles.suggestionName} numberOfLines={1}>{product.name}</Text><Text style={styles.suggestionMeta}>{product.brand ? `${product.brand} · ` : ""}{product.category || "Producto"}{product.barcode ? ` · ${product.barcode}` : ""}</Text></View></Pressable>)}</View> : null}
          <View style={styles.formRow}><View style={styles.formField}><Text style={styles.fieldLabel}>Cantidad</Text><TextInput value={itemDraft.quantity} onChangeText={(value) => setItemDraft((draft) => ({ ...draft, quantity: value }))} keyboardType="decimal-pad" style={styles.modalInput} /></View><View style={styles.formField}><Text style={styles.fieldLabel}>Unidad</Text><TextInput value={itemDraft.unit} onChangeText={(value) => setItemDraft((draft) => ({ ...draft, unit: value }))} placeholder="u, kg, l…" style={styles.modalInput} /></View></View>
          <Text style={styles.fieldLabel}>Precio por unidad (€)</Text><TextInput value={itemDraft.unitPrice} onChangeText={(value) => setItemDraft((draft) => ({ ...draft, unitPrice: value }))} keyboardType="decimal-pad" style={styles.modalInput} />
          <Text style={styles.fieldLabel}>Código de barras (opcional)</Text><View style={styles.barcodeRow}><TextInput value={itemDraft.barcode} onChangeText={(value) => setItemDraft((draft) => ({ ...draft, barcode: value }))} keyboardType="numeric" style={[styles.modalInput, styles.barcodeInput]} />{canUseScanner ? <Pressable accessibilityRole="button" accessibilityLabel="Escanear código de barras" onPress={openScanner} style={styles.scanButton}><Ionicons name="scan-outline" size={21} color="#fff" /></Pressable> : null}</View>
          {scanHint ? <Text style={styles.scanHint}>{scanHint}</Text> : null}
          <Text style={styles.fieldLabel}>Categoría (opcional)</Text><TextInput value={itemDraft.categoryName} onChangeText={(value) => setItemDraft((draft) => ({ ...draft, categoryName: value }))} style={styles.modalInput} />
          <Text style={styles.formTotal}>Total estimado: {formatMoney(parseAmount(itemDraft.quantity, 1) * parseAmount(itemDraft.unitPrice, 0), typeof selectedList?.currency === "string" ? selectedList.currency : selectedList?.currency?.code || DEFAULT_CURRENCY.code)}</Text>
          <View style={styles.modalActions}><Pressable onPress={() => { setItemEditorVisible(false); setEditingItemId(null); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable disabled={!itemDraft.name.trim() || parseAmount(itemDraft.quantity, 0) <= 0 || parseAmount(itemDraft.unitPrice, -1) < 0 || busy} onPress={saveItem} style={[styles.createButton, (!itemDraft.name.trim() || parseAmount(itemDraft.quantity, 0) <= 0 || parseAmount(itemDraft.unitPrice, -1) < 0 || busy) && styles.disabled]}><Text style={styles.createText}>Guardar</Text></Pressable></View>
        </View></View>
      </Modal>
      <Modal visible={canUseStores && storePickerVisible} transparent animationType="fade" onRequestClose={() => setStorePickerVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.storeModalCard}>
          <View style={styles.storeModalHeader}><View><Text style={styles.modalTitle}>Elegir tienda</Text><Text style={styles.modalSubtitle}>Asocia esta lista a una tienda del catálogo.</Text></View><Pressable onPress={() => setStorePickerVisible(false)} style={styles.closeButton}><Ionicons name="close" size={20} color="#64748b" /></Pressable></View>
          {storeError ? <View style={styles.storeError}><Text style={styles.storeErrorText}>{storeError}</Text><Pressable onPress={loadStores}><Text style={styles.retry}>Reintentar</Text></Pressable></View> : null}
          <Pressable accessibilityRole="button" onPress={() => chooseStore(null)} style={styles.storeOption}><Ionicons name="remove-circle-outline" size={19} color="#64748b" /><Text style={styles.storeOptionName}>Sin tienda asignada</Text></Pressable>
          {storeLoading ? <ActivityIndicator style={styles.loader} size="large" color="#2563eb" /> : stores.length ? [...stores].sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(a.name).localeCompare(String(b.name), "es")).map((store) => (
            <View key={store.id} style={styles.storeOptionRow}>
              <Pressable accessibilityRole="button" onPress={() => chooseStore(store)} style={styles.storeOptionSelect}><Ionicons name={store.id === selectedList?.storeId ? "radio-button-on" : "radio-button-off"} size={19} color="#2563eb" /><View style={styles.storeOptionCopy}><Text style={styles.storeOptionName} numberOfLines={1}>{store.name}</Text><Text style={styles.storeOptionMeta}>{[store.city, store.address].filter(Boolean).join(" · ")}</Text></View></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={store.favorite ? "Quitar de favoritos" : "Añadir a favoritos"} onPress={() => toggleStoreFavorite(store)} style={styles.favoriteButton}><Ionicons name={store.favorite ? "star" : "star-outline"} size={20} color={store.favorite ? "#f59e0b" : "#94a3b8"} /></Pressable>
            </View>
          )) : !storeLoading ? <Text style={styles.noStores}>El catálogo Node aún no contiene tiendas.</Text> : null}
        </View></View>
      </Modal>
      <Modal visible={offersVisible} transparent animationType="fade" onRequestClose={() => setOffersVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.storeModalCard}>
          <View style={styles.storeModalHeader}><View><Text style={styles.modalTitle}>{offerTab === "mine" ? "Mis solicitudes" : `Ofertas de ${stores.find((store) => store.id === selectedList?.storeId)?.name || "la tienda"}`}</Text><Text style={styles.modalSubtitle}>{offerTab === "mine" ? "Estado de las ofertas que has comunicado." : "Ofertas aprobadas vigentes para esta tienda."}</Text></View><Pressable onPress={() => setOffersVisible(false)} style={styles.closeButton}><Ionicons name="close" size={20} color="#64748b" /></Pressable></View>
          <View style={styles.offerTabs}><Pressable accessibilityRole="button" onPress={openStoreOffers} style={[styles.offerTab, offerTab === "store" && styles.offerTabSelected]}><Text style={[styles.offerTabText, offerTab === "store" && styles.offerTabTextSelected]}>De la tienda</Text></Pressable><Pressable accessibilityRole="button" onPress={loadMyOffers} style={[styles.offerTab, offerTab === "mine" && styles.offerTabSelected]}><Text style={[styles.offerTabText, offerTab === "mine" && styles.offerTabTextSelected]}>Mis solicitudes</Text></Pressable></View>
          {offersError ? <View style={styles.storeError}><Text style={styles.storeErrorText}>{offersError}</Text><Pressable onPress={offerTab === "mine" ? loadMyOffers : openStoreOffers}><Text style={styles.retry}>Reintentar</Text></Pressable></View> : null}
          {offerTab === "store" && !selectedList?.archived && selectedList?.storeId ? <Pressable accessibilityRole="button" onPress={() => { setOfferDraft({ productName: "", barcode: "", offerText: "" }); setOffersVisible(false); setOfferFormVisible(true); }} style={styles.submitOfferButton}><Ionicons name="megaphone-outline" size={17} color="#2563eb" /><Text style={styles.storeChooseText}>Comunicar una oferta</Text></Pressable> : null}
          {offerTab === "store" && offersLoading ? <ActivityIndicator style={styles.loader} size="large" color="#2563eb" /> : offerTab === "store" && storeOffers.length ? storeOffers.map((offer) => (
            <View key={offer.id} style={styles.offerCard}>
              <View style={styles.offerBadge}><Ionicons name="pricetag" size={17} color="#7c3aed" /></View>
              <View style={styles.offerCopy}><Text style={styles.storeOptionName}>{offer.productName}</Text><Text style={styles.offerDescription}>{offer.offerText}</Text>{offer.endsAt ? <Text style={styles.storeOptionMeta}>Válida hasta {new Date(offer.endsAt).toLocaleDateString("es-ES")}</Text> : null}</View>
              {!selectedList?.archived ? <Pressable accessibilityRole="button" onPress={() => addOfferToList(offer)} style={styles.offerAdd}><Ionicons name="add" size={20} color="#fff" /></Pressable> : null}
            </View>
          )) : offerTab === "mine" && myOffersLoading ? <ActivityIndicator style={styles.loader} size="large" color="#2563eb" /> : offerTab === "mine" && myOffers.length ? myOffers.map((offer) => (
            <View key={offer.id} style={styles.offerCard}>
              <View style={[styles.offerBadge, offer.status === "approved" && styles.statusApproved, offer.status === "rejected" && styles.statusRejected]}><Ionicons name={offer.status === "approved" ? "checkmark" : offer.status === "rejected" ? "close" : "time-outline"} size={17} color={offer.status === "approved" ? "#15803d" : offer.status === "rejected" ? "#b91c1c" : "#b45309"} /></View>
              <View style={styles.offerCopy}><Text style={styles.storeOptionName}>{offer.productName}</Text><Text style={styles.offerDescription}>{offer.offerText}</Text><Text style={styles.storeOptionMeta}>{stores.find((store) => store.id === offer.storeId)?.name || "Tienda"} · {offer.status === "approved" ? "Aprobada" : offer.status === "rejected" ? "Rechazada" : "Pendiente de revisión"}</Text></View>
            </View>
          )) : !offersLoading && !myOffersLoading ? <View style={styles.empty}><Ionicons name={offerTab === "mine" ? "document-text-outline" : "pricetags-outline"} size={28} color="#94a3b8" /><Text style={styles.emptyTitle}>{offerTab === "mine" ? "Aún no has enviado ofertas" : "No hay ofertas vigentes"}</Text><Text style={styles.emptyText}>{offerTab === "mine" ? "Las solicitudes que envíes aparecerán aquí." : "Todavía no hay ofertas aprobadas para esta tienda."}</Text></View> : null}
        </View></View>
      </Modal>
      <Modal visible={offerFormVisible} transparent animationType="fade" onRequestClose={() => setOfferFormVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.offerFormCard}>
          <View style={styles.storeModalHeader}><View><Text style={styles.modalTitle}>Comunicar una oferta</Text><Text style={styles.modalSubtitle}>La oferta se publicará después de revisarla.</Text></View><Pressable onPress={() => setOfferFormVisible(false)} style={styles.closeButton}><Ionicons name="close" size={20} color="#64748b" /></Pressable></View>
          <Text style={styles.fieldLabel}>Producto *</Text><TextInput value={offerDraft.productName} onChangeText={(value) => setOfferDraft((form) => ({ ...form, productName: value }))} placeholder="Nombre del producto" placeholderTextColor="#94a3b8" style={styles.modalInput} />
          <Text style={styles.fieldLabel}>Código de barras (opcional)</Text><TextInput value={offerDraft.barcode} onChangeText={(value) => setOfferDraft((form) => ({ ...form, barcode: value }))} keyboardType="numeric" placeholder="Código EAN/UPC" placeholderTextColor="#94a3b8" style={styles.modalInput} />
          <Text style={styles.fieldLabel}>Descripción de la oferta *</Text><TextInput value={offerDraft.offerText} onChangeText={(value) => setOfferDraft((form) => ({ ...form, offerText: value }))} placeholder="Por ejemplo: 2 por 3 € hasta el viernes" placeholderTextColor="#94a3b8" multiline style={[styles.modalInput, styles.offerTextInput]} />
          {offersError ? <Text style={styles.searchError}>{offersError}</Text> : null}
          <View style={styles.modalActions}><Pressable onPress={() => setOfferFormVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable disabled={!offerDraft.productName.trim() || !offerDraft.offerText.trim() || offerSubmitting} onPress={submitStoreOffer} style={[styles.createButton, (!offerDraft.productName.trim() || !offerDraft.offerText.trim() || offerSubmitting) && styles.disabled]}>{offerSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.createText}>Enviar</Text>}</Pressable></View>
        </View></View>
      </Modal>
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => { setScannerVisible(false); setTorchEnabled(false); scannerLockedRef.current = false; }}>
        <SafeAreaView style={styles.scannerSafe}>
          <CameraView style={styles.scannerCamera} facing="back" enableTorch={torchEnabled} barcodeScannerSettings={{ barcodeTypes: scannerMode === "music" ? ["qr"] : barcodeTypes }} onBarcodeScanned={scannerLocked ? undefined : scannerMode === "music" ? handleMusicQr : handleBarcodeScanned} />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerTop}><Text style={styles.scannerTitle}>{scannerMode === "music" ? "Escanear QR de música" : "Escanear producto"}</Text><Pressable accessibilityRole="button" onPress={() => { setScannerVisible(false); setTorchEnabled(false); scannerLockedRef.current = false; }} style={styles.scannerClose}><Ionicons name="close" size={23} color="#fff" /></Pressable></View>
            <View style={styles.scannerMiddle}><View style={styles.scanFrame} /><Text style={styles.scannerInstruction}>{scannerLocked ? "Leyendo código…" : scannerMode === "music" ? "Centra el QR musical en el marco" : "Centra el código de barras en el marco"}</Text></View>
            <View style={styles.scannerBottom}><Pressable accessibilityRole="button" onPress={() => setTorchEnabled((value) => !value)} style={styles.torchButton}><Ionicons name={torchEnabled ? "flashlight" : "flashlight-outline"} size={19} color="#fff" /><Text style={styles.torchText}>{torchEnabled ? "Apagar luz" : "Linterna"}</Text></Pressable></View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  utilityLinks: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  utilityLink: { flexGrow: 1, flexBasis: 140, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff" },
  utilityCopy: { flex: 1, minWidth: 0 },
  utilityName: { color: "#1d4ed8", fontSize: 14, fontWeight: "700" },
  utilityStatus: { color: "#64748b", fontSize: 12 },
  safe: { flex: 1, backgroundColor: "#f4f7fc" },
  header: { minHeight: 66, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", flexWrap: "wrap", rowGap: 6, alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  brandRow: { flexDirection: "row", alignItems: "center" }, logo: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" }, logoText: { color: "#fff", fontSize: 21, fontWeight: "900" }, brand: { marginLeft: 10, color: "#0f172a", fontSize: 22, fontWeight: "800" }, mode: { marginLeft: 11, borderRadius: 999, backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6 }, modeText: { color: "#1d4ed8", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 }, chatButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#eff6ff" }, accountButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8, paddingLeft: 8 }, accountText: { maxWidth: 100, color: "#475569", fontSize: 12, fontWeight: "600" },
  content: { width: "100%", maxWidth: 920, alignSelf: "center", padding: 22, paddingBottom: 40 },
  hero: { minHeight: 260, overflow: "hidden", borderRadius: 24, backgroundColor: "#2563eb" }, heroContent: { zIndex: 2, padding: 22 }, heroDecorativeCircleOne: { position: "absolute", top: -80, right: -55, width: 210, height: 210, borderRadius: 105, backgroundColor: "rgba(255,255,255,0.10)" }, heroDecorativeCircleTwo: { position: "absolute", right: 35, bottom: -105, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.08)" }, heroLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 }, heroIcon: { width: 40, height: 40, marginRight: 11, borderRadius: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }, eyebrow: { color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: "700" }, heroTitle: { maxWidth: 400, color: "#fff", fontSize: 28, fontWeight: "800", lineHeight: 34, letterSpacing: -0.5 }, heroSubtitle: { marginTop: 10, maxWidth: 500, color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 22 }, primaryButton: { minHeight: 50, marginTop: 22, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", paddingHorizontal: 14, backgroundColor: "#1d4ed8" }, primaryButtonIcon: { width: 30, height: 30, marginRight: 10, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, primaryButtonText: { marginRight: 18, color: "#fff", fontSize: 15, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 12 }, statCard: { flex: 1, minWidth: 0, minHeight: 80, paddingHorizontal: 13, paddingVertical: 13, flexDirection: "row", alignItems: "center", borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e7ec" }, statIcon: { width: 42, height: 42, marginRight: 11, borderRadius: 13, alignItems: "center", justifyContent: "center" }, statIconBlue: { backgroundColor: "#eaf2ff" }, statIconGreen: { backgroundColor: "#ecfdf3" }, statCopy: { flex: 1 }, statNumber: { color: "#172033", fontSize: 25, fontWeight: "800" }, statLabel: { marginTop: 3, color: "#667085", fontSize: 13, fontWeight: "600" },
  sectionHeader: { marginTop: 30, marginBottom: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionActions: { flexDirection: "row", gap: 7 }, sectionTitle: { color: "#172033", fontSize: 23, fontWeight: "800" }, sectionSubtitle: { color: "#64748b", fontSize: 13, marginTop: 3 }, switchButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: "#eaf1ff" }, switchText: { color: "#2563eb", fontSize: 13, fontWeight: "700" },
  listCard: { flexDirection: "row", alignItems: "center", borderRadius: 17, padding: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 10 }, listCardSelected: { borderColor: "#93b4ff", backgroundColor: "#f8fbff" }, listIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#eaf1ff", alignItems: "center", justifyContent: "center" }, listCopy: { flex: 1, marginLeft: 13 }, listName: { color: "#172033", fontSize: 17, fontWeight: "700" }, listMeta: { color: "#64748b", fontSize: 13, marginTop: 4 },
  historyCard: { flexDirection: "row", alignItems: "center", borderRadius: 15, padding: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 9 }, historyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#f3e8ff", alignItems: "center", justifyContent: "center" }, historyCopy: { flex: 1, marginLeft: 12 },
  empty: { alignItems: "center", padding: 30, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" }, emptyTitle: { marginTop: 12, color: "#334155", fontSize: 16, fontWeight: "700" }, emptyText: { marginTop: 5, color: "#64748b", textAlign: "center", fontSize: 13 }, loader: { marginVertical: 30 },
  detailCard: { marginTop: 14, padding: 18, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe5f3" }, detailHeader: { flexDirection: "row", alignItems: "flex-start" }, detailTitle: { color: "#172033", fontSize: 20, fontWeight: "800" }, detailMeta: { marginTop: 4, color: "#64748b", fontSize: 13 }, closeButton: { padding: 6 }, addProductButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 43, marginTop: 14, borderRadius: 11, backgroundColor: "#eff6ff" }, addProductText: { color: "#2563eb", fontSize: 14, fontWeight: "700" }, subtotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, subtotalLabel: { color: "#64748b", fontSize: 14 }, subtotalValue: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  itemRow: { minHeight: 58, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 8 }, checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: "#94a3b8", alignItems: "center", justifyContent: "center" }, checkboxChecked: { backgroundColor: "#2563eb", borderColor: "#2563eb" }, itemCopy: { flex: 1, paddingVertical: 8 }, itemName: { color: "#334155", fontSize: 15, fontWeight: "600" }, itemMeta: { color: "#64748b", fontSize: 11, marginTop: 3 }, itemChecked: { color: "#94a3b8", textDecorationLine: "line-through" }, deleteItem: { padding: 7 }, noItems: { paddingVertical: 18, color: "#64748b", fontSize: 14 }, detailActions: { flexDirection: "row", gap: 9, marginTop: 15 }, actionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 11, backgroundColor: "#eff6ff" }, actionDanger: { backgroundColor: "#fef2f2" }, actionText: { color: "#2563eb", fontSize: 13, fontWeight: "700" }, actionDangerText: { color: "#dc2626" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: "#fef2f2" }, errorText: { flex: 1, color: "#991b1b", fontSize: 13 }, retry: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" }, busy: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }, busyText: { color: "#64748b", fontSize: 13 }, footer: { marginTop: 27, color: "#94a3b8", textAlign: "center", fontSize: 12 },
  modalBackdrop: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a88" }, modalCard: { width: "100%", maxWidth: 430, maxHeight: "90%", padding: 22, borderRadius: 20, backgroundColor: "#fff" }, modalTitle: { color: "#0f172a", fontSize: 21, fontWeight: "800" }, modalSubtitle: { marginTop: 6, color: "#64748b", fontSize: 14 }, modalInput: { marginTop: 10, minHeight: 46, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", color: "#0f172a", fontSize: 15 }, searchSpinner: { marginTop: 8 }, searchError: { marginTop: 7, color: "#b45309", fontSize: 12, lineHeight: 17 }, suggestions: { marginTop: 9, borderWidth: 1, borderColor: "#dbe5f3", borderRadius: 12, overflow: "hidden" }, suggestionsTitle: { paddingHorizontal: 11, paddingTop: 9, color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }, suggestionRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#f1f5f9" }, suggestionCopy: { flex: 1 }, suggestionName: { color: "#334155", fontSize: 13, fontWeight: "700" }, suggestionMeta: { marginTop: 2, color: "#64748b", fontSize: 11 }, fieldLabel: { marginTop: 9, color: "#475569", fontSize: 12, fontWeight: "700" }, formRow: { flexDirection: "row", gap: 10 }, formField: { flex: 1 }, formTotal: { marginTop: 14, color: "#0f172a", fontSize: 15, fontWeight: "800" }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 }, cancelButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14 }, cancelText: { color: "#475569", fontWeight: "700" }, createButton: { minHeight: 44, minWidth: 90, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: 11, backgroundColor: "#2563eb" }, createText: { color: "#fff", fontWeight: "800" }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.78 },
  barcodeRow: { flexDirection: "row", alignItems: "center", gap: 8 }, barcodeInput: { flex: 1 }, scanButton: { width: 46, height: 46, marginTop: 10, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb" }, scanHint: { marginTop: 6, color: "#2563eb", fontSize: 12, lineHeight: 17 },
  storeSection: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 13, padding: 12, borderRadius: 13, backgroundColor: "#f8fafc" }, storeInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 }, storeTextBlock: { flex: 1 }, storeLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" }, storeName: { color: "#334155", fontSize: 13, fontWeight: "700", marginTop: 2 }, storeActions: { flexDirection: "row", alignItems: "center", gap: 7 }, storeChoose: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, borderRadius: 9, backgroundColor: "#eaf1ff" }, storeChooseText: { color: "#2563eb", fontSize: 12, fontWeight: "700" }, storeModalCard: { width: "100%", maxWidth: 480, maxHeight: "85%", padding: 18, borderRadius: 20, backgroundColor: "#fff" }, storeModalHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 11 }, storeOption: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }, storeOptionRow: { minHeight: 54, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }, storeOptionSelect: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 9, minHeight: 52 }, storeOptionCopy: { flex: 1 }, storeOptionName: { color: "#334155", fontSize: 14, fontWeight: "700" }, storeOptionMeta: { marginTop: 3, color: "#64748b", fontSize: 11 }, favoriteButton: { padding: 11 }, storeError: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 10, marginBottom: 8, borderRadius: 10, backgroundColor: "#fef2f2" }, storeErrorText: { flex: 1, color: "#991b1b", fontSize: 12 }, noStores: { padding: 16, color: "#64748b", textAlign: "center", fontSize: 13 }, offerCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }, offerBadge: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#f3e8ff" }, offerCopy: { flex: 1 }, offerDescription: { marginTop: 3, color: "#475569", fontSize: 12, lineHeight: 17 }, offerAdd: { width: 37, height: 37, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb" },
  offerTabs: { flexDirection: "row", gap: 8, marginBottom: 11, padding: 4, borderRadius: 12, backgroundColor: "#f1f5f9" }, offerTab: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 9 }, offerTabSelected: { backgroundColor: "#fff", shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }, offerTabText: { color: "#64748b", fontSize: 12, fontWeight: "700" }, offerTabTextSelected: { color: "#1d4ed8" }, statusApproved: { backgroundColor: "#dcfce7" }, statusRejected: { backgroundColor: "#fee2e2" },
  submitOfferButton: { minHeight: 41, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 8, borderRadius: 10, backgroundColor: "#eff6ff" }, offerFormCard: { width: "100%", maxWidth: 460, maxHeight: "90%", padding: 20, borderRadius: 20, backgroundColor: "#fff" }, offerTextInput: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 }, offerSubmitted: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 11, padding: 11, borderRadius: 11, backgroundColor: "#f0fdf4" }, offerSubmittedText: { flex: 1, color: "#166534", fontSize: 12, lineHeight: 17 },
  scannerSafe: { flex: 1, backgroundColor: "#000" }, scannerCamera: { flex: 1 }, scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", paddingHorizontal: 22, paddingVertical: 18, backgroundColor: "#00000022" }, scannerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, scannerTitle: { color: "#fff", fontSize: 19, fontWeight: "800" }, scannerClose: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#00000066" }, scannerMiddle: { alignItems: "center", justifyContent: "center" }, scanFrame: { width: "84%", height: 180, borderColor: "#fff", borderWidth: 2, borderRadius: 17, backgroundColor: "#ffffff0a" }, scannerInstruction: { marginTop: 17, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, overflow: "hidden", color: "#fff", backgroundColor: "#00000080", textAlign: "center", fontSize: 14 }, scannerBottom: { alignItems: "center", paddingBottom: 20 }, torchButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderRadius: 22, backgroundColor: "#00000080" }, torchText: { color: "#fff", fontWeight: "700" },
});
