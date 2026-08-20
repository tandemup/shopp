import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";

import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useProductLookupWithCache } from "@/src/hooks/useProductLookupWithCache";
import {
  DEFAULT_ENGINE,
  SEARCH_ENGINES,
  openGoogleAIMode,
  openSearchEngine,
} from "@/src/constants/searchEngines";
import { getSearchSettings } from "@/src/storage/settingsStorage";
import {
  getProductImages,
  saveProductImageBlobs,
} from "@/src/storage/productImageStorage";

import {
  getProductBrand,
  getProductCategory,
  getProductDisplayName,
  getProductUrl,
} from "@/src/services/productLookup";

import { useScannedHistoryStorage } from "@/src/hooks/useScannedHistoryStorage";
import {
  restoreTemporaryProductImages,
  uploadTemporaryProductImages,
} from "@/src/services/temporaryProductImageSync";
import { normalizeBarcode } from "@/src/utils/barcodeNormalization";
import BarcodeLink from "@/src/components/controls/BarcodeLink";
import { ROUTES } from "@/src/navigation/ROUTES";
import { safeConfirm } from "@/src/components/ui/alert/safeAlert";
import {
  buildBookLookupPrompt,
  buildMusicCdLookupPrompt,
  buildSupermarketLookupPrompt,
} from "@/src/constants/productLookupPrompts";

const PRODUCT_DETAIL_MAX_SIZE = 256;
const PRODUCT_THUMBNAIL_MAX_SIZE = 64;

function normalizeString(value) {
  return String(value || "").trim();
}

function isMusicProductType(value) {
  const normalizedValue = normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalizedValue === "musica" || normalizedValue === "music";
}

function isBookProductType(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  return normalizedValue === "libros" || normalizedValue === "book";
}

function isSupermarketProductType(value) {
  const normalizedValue = normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    normalizedValue === "supermercado" ||
    normalizedValue === "food" ||
    normalizedValue === "alimentos"
  );
}

function normalizeProductUrlForType(value, productType) {
  const url = normalizeExternalUrl(value);

  if (!url) return "";

  const isOpenFoodFactsProductUrl =
    /^https?:\/\/(?:world\.)?openfoodfacts\.org\/product\//i.test(url);

  if (isOpenFoodFactsProductUrl && !isSupermarketProductType(productType)) {
    return "";
  }

  return url;
}

function parseMusicJson(value) {
  const normalizedValue = normalizeString(value);
  const fencedMatch = normalizedValue.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : normalizedValue;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  const cleanedValue =
    firstBrace >= 0 && lastBrace > firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate;

  if (!cleanedValue) {
    throw new Error("Pega primero el JSON obtenido en la búsqueda.");
  }

  const parsed = JSON.parse(cleanedValue);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("La respuesta debe contener un objeto JSON.");
  }

  return parsed;
}

function normalizeExternalUrl(value) {
  const normalizedValue = normalizeString(value);
  const markdownMatch = normalizedValue.match(
    /^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i,
  );
  const plainValue = normalizeString(markdownMatch?.[1] || normalizedValue);
  return /^https?:\/\/\S+$/i.test(plainValue) ? plainValue : "";
}

function joinJsonValues(...values) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map(normalizeString)
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index)
    .join(", ");
}

function formatTrackList(trackList) {
  if (!Array.isArray(trackList)) return normalizeString(trackList);

  return trackList
    .map((track, index) => {
      if (typeof track === "string") return normalizeString(track);
      if (!track || typeof track !== "object") return "";

      const position = normalizeString(
        track.position || track.number || track.trackNumber || index + 1,
      );
      const title = normalizeString(track.title || track.name);
      return title ? `${position}. ${title}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatKilobytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  return `${(bytes / 1024).toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kB`;
}

function convertImageBlobToJpeg(blob, maxSize = null) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(
        new Error("El redimensionado de imágenes solo está disponible en Web."),
      );
      return;
    }

    const objectUrl = window.URL.createObjectURL(blob);
    const image = new window.Image();

    const cleanup = () => {
      window.URL.revokeObjectURL(objectUrl);
    };

    image.onload = () => {
      const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const shouldResize = Number.isFinite(maxSize) && maxSize > 0;
      const scale = shouldResize ? Math.min(1, maxSize / largestSide) : 1;
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        cleanup();
        reject(
          new Error("No se pudo preparar el redimensionado de la imagen."),
        );
        return;
      }

      // JPEG no admite transparencia. El fondo blanco evita áreas negras al
      // convertir imágenes PNG transparentes.
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (jpegBlob) => {
          cleanup();

          if (!jpegBlob) {
            reject(new Error("No se pudo convertir la imagen a JPEG."));
            return;
          }

          resolve(jpegBlob);
        },
        "image/jpeg",
        0.86,
      );
    };

    image.onerror = () => {
      cleanup();
      reject(new Error("No se pudo cargar la imagen copiada."));
    };

    image.src = objectUrl;
  });
}

function hasUsefulProductData(product) {
  if (!product) {
    return false;
  }

  return Boolean(
    normalizeString(product.name) ||
    normalizeString(product.product_name) ||
    normalizeString(product.brand) ||
    normalizeString(product.brands) ||
    normalizeString(product.productType) ||
    normalizeString(product.category) ||
    normalizeString(product.productUrl),
  );
}

function getSourceLabel(source, created) {
  if (created) {
    return "Registro nuevo";
  }

  switch (source) {
    case "convex":
      return "Convex";

    case "internet":
      return "Internet";

    case "manual":
      return "Edición manual";

    case "scanner":
      return "Escáner";

    default:
      return "Convex";
  }
}

function ProductImage({ uri, productName }) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [uri]);

  if (!uri || imageError) {
    return (
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imagePlaceholderIcon}>🛒</Text>

        <Text style={styles.imagePlaceholderTitle}>
          {imageError ? "No se pudo cargar la imagen" : "Producto sin imagen"}
        </Text>

        <Text style={styles.imagePlaceholderDescription}>
          Importa una imagen para guardarla localmente en este dispositivo.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.imageContainer}>
      <Image
        source={{ uri }}
        style={styles.productImage}
        contentFit="contain"
        transition={180}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        accessibilityLabel={
          productName
            ? `Imagen de ${productName}`
            : "Imagen del producto escaneado"
        }
        onError={() => setImageError(true)}
      />

      <View style={styles.cacheBadge}>
        <Text style={styles.cacheBadgeText}>Caché de imagen activa</Text>
      </View>
    </View>
  );
}

function CerrarSinGuardar({ navigation, busy = false }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.cancelButton,
        pressed && styles.cancelButtonPressed,
      ]}
      onPress={() => navigation.goBack()}
      disabled={busy}
    >
      <Ionicons name="close-outline" size={18} color="#475467" />
      <Text style={styles.cancelButtonText}>Cerrar sin guardar</Text>
    </Pressable>
  );
}
function StatusCard({
  source,
  created,
  accessCount,
  status,
  loading,
  consultingInternet,
}) {
  let title = "Producto cargado";
  let description = "Los datos se han recuperado correctamente.";

  if (consultingInternet) {
    title = "Buscando información";
    description =
      "El registro existe, pero estamos completando sus datos desde internet.";
  } else if (loading) {
    title = "Consultando Convex";
    description = "Buscando el código de barras en la base de datos.";
  } else if (created) {
    title = "Nuevo código registrado";
    description =
      "No existía información. Se ha creado un registro mí­nimo en Convex.";
  } else if (status === "not_found") {
    title = "Información no encontrada";
    description =
      "El código está registrado, pero todavía no contiene datos del producto.";
  }

  const visibleAccessCount = accessCount || 1;

  return (
    <View style={styles.statusCard}>
      <View style={styles.statusIcon}>
        {loading || consultingInternet ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : (
          <Text style={styles.statusIconText}>
            {created ? "＋" : status === "not_found" ? "?" : "✓"}
          </Text>
        )}
      </View>

      <View style={styles.statusContent}>
        <Text style={styles.statusTitle}>{title}</Text>

        <Text style={styles.statusDescription}>{description}</Text>

        <View style={styles.statusMetaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>
              {getSourceLabel(source, created)}
            </Text>
          </View>

          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>
              {visibleAccessCount}{" "}
              {visibleAccessCount === 1 ? "consulta" : "consultas"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "sentences",
  autoCorrect = true,
  keyboardType = "default",
  multiline = false,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, multiline && styles.multilineInput]}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const PRODUCT_TYPES = ["Supermercado", "Libros", "Música"];

const DETAIL_FIELDS = {
  Supermercado: [
    ["category", "Categoría", "Categoría del producto"],
    ["subcategory", "Subcategoría", "Subcategoría del producto"],
    ["manufacturer", "Fabricante", "Empresa fabricante"],
    ["countryOfOrigin", "País de origen", "País de origen"],
    ["ingredients", "Ingredientes", "Lista de ingredientes", true],
    ["allergens", "Alérgenos", "Alérgenos declarados", true],
  ],
  Libros: [
    ["authors", "Autor o autores", "Separados por comas"],
    ["isbn13", "ISBN-13", "ISBN de 13 dígitos"],
    ["publisher", "Editorial", "Nombre de la editorial"],
    ["publicationYear", "Año de publicación", "Ej. 2024"],
    ["language", "Idioma", "Idioma del libro"],
    ["pageCount", "Número de páginas", "Ej. 320"],
    ["category", "Categoría", "Novela, arquitectura, historia…"],
    ["format", "Formato", "Tapa dura, bolsillo…"],
    ["synopsis", "Sinopsis breve", "Resumen breve del libro", true],
  ],
  Música: [
    ["artist", "Artista principal", "Artista o grupo"],
    ["composer", "Compositor", "Compositor o compositores"],
    ["format", "Soporte", "CD, vinilo, casete…"],
    ["discCount", "Número de discos", "Ej. 17"],
    ["subcategory", "Subcategoría", "Ej. Órgano"],
    ["label", "Discográfica", "Sello discográfico"],
    ["releaseYear", "Año", "Ej. 1995"],
  ],
};

function ProductDetailsFields({
  productType,
  details,
  onChange,
  category,
  onCategoryChange,
}) {
  const fields = DETAIL_FIELDS[productType] || [];
  if (!fields.length) return null;

  return (
    <View style={styles.detailsSection}>
      <Text style={styles.cardEyebrow}>
        DATOS DE {productType.toUpperCase()}
      </Text>
      <Text style={styles.cardTitle}>Detalles específicos</Text>
      <Text style={styles.cardDescription}>
        Estos campos cambian según el tipo de producto seleccionado.
      </Text>
      <View style={styles.detailsGrid}>
        {fields.map(([key, label, placeholder, multiline]) => (
          <View key={key} style={styles.detailsGridItem}>
            <FormField
              label={label}
              value={String(
                key === "category" ? category || "" : details?.[key] || "",
              )}
              onChangeText={(value) =>
                key === "category"
                  ? onCategoryChange(value)
                  : onChange(key, value)
              }
              placeholder={placeholder}
              multiline={Boolean(multiline)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function ProductTypeSelector({ value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Tipo de producto</Text>
      <View style={styles.productTypeOptions}>
        {PRODUCT_TYPES.map((type) => {
          const selected = value === type;

          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Tipo de producto: ${type}`}
              onPress={() => onChange(type)}
              style={({ pressed }) => [
                styles.productTypeOption,
                selected && styles.productTypeOptionSelected,
                pressed && styles.productTypeOptionPressed,
              ]}
            >
              <Text
                style={[
                  styles.productTypeOptionText,
                  selected && styles.productTypeOptionTextSelected,
                ]}
              >
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
function GoogleModeIA({
  busy: _busy,
  barcode,
  musicJsonSearch = false,
  bookJsonSearch = false,
  supermarketJsonSearch = false,
  onPress,
}) {
  const jsonSearchTitle = musicJsonSearch
    ? "Buscar ficha de CD (JSON)"
    : bookJsonSearch
      ? "Buscar ficha de libro (JSON)"
      : supermarketJsonSearch
        ? "Buscar ficha de supermercado (JSON)"
        : "Google Modo IA";
  const jsonSearchDescription = musicJsonSearch
    ? "Identifica la edición y devuelve sus datos"
    : bookJsonSearch
      ? "Identifica la edición y devuelve los datos bibliográficos"
      : supermarketJsonSearch
        ? "Identifica el producto y devuelve sus datos"
        : "Respuesta generada a partir del código";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={jsonSearchTitle}
      accessibilityState={{ disabled: !barcode }}
      style={({ pressed }) => [
        styles.externalAction,
        pressed && styles.externalActionPressed,
        !barcode && styles.disabledButton,
      ]}
      disabled={!barcode}
      onPress={onPress}
    >
      <View style={styles.googleIcon}>
        <Text style={styles.googleIconText}>G</Text>
      </View>

      <View style={styles.externalActionContent}>
        <Text style={styles.externalActionTitle}>{jsonSearchTitle}</Text>
        <Text style={styles.externalActionDescription}>
          {jsonSearchDescription}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#667085" />
    </Pressable>
  );
}

function ExternalSearchButton({ busy, barcode, engineLabel, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buscar producto en ${engineLabel}`}
      style={({ pressed }) => [
        styles.externalAction,
        styles.externalActionPrimary,
        pressed && styles.externalActionPrimaryPressed,
        (busy || !barcode) && styles.disabledButton,
      ]}
      disabled={busy || !barcode}
      onPress={onPress}
    >
      <View style={styles.shoppingIcon}>
        <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
      </View>

      <View style={styles.externalActionContent}>
        <Text
          style={[styles.externalActionTitle, styles.externalActionTitleLight]}
        >
          {engineLabel}
        </Text>

        <Text
          style={[
            styles.externalActionDescription,
            styles.externalActionDescriptionLight,
          ]}
        >
          Buscar el código de barras en el motor seleccionado
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
    </Pressable>
  );
}

function ActualizarDesdeInternet({
  busy,
  consultingInternet,
  internetLookupLoading,
  onPress,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.secondaryButtonPressed,
        busy && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={busy}
    >
      {consultingInternet || internetLookupLoading ? (
        <ActivityIndicator color="#2563EB" />
      ) : (
        <>
          <Ionicons name="refresh-outline" size={20} color="#2563EB" />
          <View style={styles.buttonTextBlock}>
            <Text style={styles.secondaryButtonText}>
              Actualizar desde internet
            </Text>
            <Text style={styles.secondaryButtonHint}>
              Sustituye los campos con datos externos
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

function ProductInfo({ busy, barcode, dataSource, navigation, product }) {
  const handleShowProductInfo = useCallback(() => {
    navigation.navigate(ROUTES.PRODUCT_INFO, {
      barcode,
      product: product || null,
      fromCache: dataSource === "convex",
    });
  }, [barcode, dataSource, navigation, product]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.secondaryButtonPressed,
        busy && styles.disabledButton,
      ]}
      onPress={handleShowProductInfo}
      disabled={busy || !barcode}
    >
      <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
      <View style={styles.buttonTextBlock}>
        <Text style={styles.secondaryButtonText}>
          Ver información del producto
        </Text>
        <Text style={styles.secondaryButtonHint}>
          Consulta la ficha completa del producto
        </Text>
      </View>
    </Pressable>
  );
}

function EliminarDelHistorial({ busy, deleting, onDelete }) {
  const handlePress = useCallback(() => {
    safeConfirm(
      "Eliminar del historial",
      "¿Quieres eliminar este producto del historial local? Esta acción no eliminará el registro global de Convex.",
      onDelete,
      {
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        destructive: true,
      },
    );
  }, [onDelete]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.deleteButton,
        pressed && styles.deleteButtonPressed,
        busy && styles.disabledButton,
      ]}
      onPress={handlePress}
      disabled={busy}
    >
      <Ionicons name="trash-outline" size={18} color="#B42318" />
      <Text style={styles.deleteButtonText}>
        {deleting ? "Eliminando..." : "Eliminar del historial local"}
      </Text>
    </Pressable>
  );
}

function EliminarDeBaseDeDatos({ busy, deleting, onDelete }) {
  const handlePress = useCallback(() => {
    safeConfirm(
      "Eliminar también de la base de datos",
      "¿Quieres eliminar definitivamente la ficha global de Convex y este elemento del historial local? Esta acción afectará a todos los dispositivos y no se puede deshacer.",
      onDelete,
      {
        confirmText: "Eliminar definitivamente",
        cancelText: "Cancelar",
        destructive: true,
      },
    );
  }, [onDelete]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.deleteDatabaseButton,
        pressed && styles.deleteDatabaseButtonPressed,
        busy && styles.disabledButton,
      ]}
      onPress={handlePress}
      disabled={busy}
    >
      <Ionicons name="server-outline" size={18} color="#FFFFFF" />
      <Text style={styles.deleteDatabaseButtonText}>
        {deleting
          ? "Eliminando de la base de datos..."
          : "Eliminar también de la base de datos"}
      </Text>
    </Pressable>
  );
}

function EliminarDelHistorial1({ busy, deleting, onDelete }) {
  return (
    <View style={styles.dangerZone}>
      <View style={styles.dangerZoneHeader}>
        <Ionicons name="warning-outline" size={18} color="#B42318" />
        <View style={styles.dangerZoneText}>
          <Text style={styles.dangerZoneTitle}>Historial local</Text>
          <Text style={styles.dangerZoneDescription}>
            El registro global de Convex no se eliminará.
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && styles.deleteButtonPressed,
          busy && styles.disabledButton,
        ]}
        onPress={onDelete}
        disabled={busy}
      >
        <Ionicons name="trash-outline" size={18} color="#B42318" />
        <Text style={styles.deleteButtonText}>
          {deleting ? "Eliminando..." : "Eliminar del historial local"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function EditScannedItemScreen({ route, navigation }) {
  const params = route?.params || {};
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 920;

  const historyItem = params.item ?? null;
  const initialProduct = params.product ?? historyItem ?? null;

  const barcode = normalizeBarcode(
    params.barcode ||
      historyItem?.barcode ||
      params.scannedBarcode ||
      params.code ||
      params.data,
  );

  const registerAccess = useMutation(api.productCache.registerAccess);
  const saveProductData = useMutation(api.productCache.saveProductData);
  const submitProductReview = useMutation(api.productCache.submitProductReview);
  const deleteProductByBarcode = useMutation(
    api.productCache.deleteProductByBarcode,
  );
  const generateProductImageUploadUrl = useMutation(
    api.temporaryProductImages.generateUploadUrl,
  );
  const saveRemoteProductImages = useMutation(
    api.temporaryProductImages.saveMyProductImages,
  );
  const removeRemoteProductImages = useMutation(
    api.temporaryProductImages.removeMyProductImages,
  );
  const currentUser = useQuery(api.users.current);
  const scanHistoryStorage = useScannedHistoryStorage();
  const userIsLoading = currentUser === undefined;
  const isAdmin = currentUser?.isAdmin === true;
  const remoteProductImages = useQuery(
    api.temporaryProductImages.getMyProductImages,
    currentUser && scanHistoryStorage.syncEnabled && barcode
      ? { barcode }
      : "skip",
  );

  const {
    loading: internetLookupLoading,
    error: lookupError,
    lookupWithCache,
  } = useProductLookupWithCache();

  const initializedBarcodeRef = useRef(null);

  const [product, setProduct] = useState(initialProduct);

  const [initializing, setInitializing] = useState(true);
  const [consultingInternet, setConsultingInternet] = useState(false);

  const [recordCreated, setRecordCreated] = useState(false);
  const [accessCount, setAccessCount] = useState(0);
  const [productStatus, setProductStatus] = useState("pending");
  const [dataSource, setDataSource] = useState("scanner");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingFromDatabase, setDeletingFromDatabase] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [selectedSearchEngine, setSelectedSearchEngine] =
    useState(DEFAULT_ENGINE);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [details, setDetails] = useState({});
  const [notes, setNotes] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [musicJson, setMusicJson] = useState("");
  const [bookJson, setBookJson] = useState("");
  const [supermarketJson, setSupermarketJson] = useState("");
  const [selectingImage, setSelectingImage] = useState(false);
  const [localImageUri, setLocalImageUri] = useState("");
  const [imageSizeBytes, setImageSizeBytes] = useState(null);
  const [thumbnailSizeBytes, setThumbnailSizeBytes] = useState(null);

  const busy =
    userIsLoading ||
    initializing ||
    consultingInternet ||
    internetLookupLoading ||
    saving ||
    selectingImage ||
    deleting ||
    deletingFromDatabase;

  const visibleError = localError || lookupError;
  const displayedImageUri = localImageUri;

  useEffect(() => {
    if (Platform.OS !== "web" || !barcode || typeof window === "undefined") {
      return undefined;
    }

    let active = true;
    let objectUrl = "";

    getProductImages(barcode)
      .then(({ detail, thumbnail }) => {
        if (!active || !detail?.blob) return;
        objectUrl = window.URL.createObjectURL(detail.blob);
        setLocalImageUri(objectUrl);
        setImageSizeBytes(detail.blob.size || detail.metadata?.size || null);
        setThumbnailSizeBytes(
          thumbnail?.blob?.size || thumbnail?.metadata?.size || null,
        );
      })
      .catch((error) => {
        console.warn("EditScannedItemScreen local image load error:", error);
      });

    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [barcode]);

  useEffect(() => {
    return () => {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        localImageUri?.startsWith("blob:")
      ) {
        window.URL.revokeObjectURL(localImageUri);
      }
    };
  }, [localImageUri]);

  const showLocalDetailBlob = useCallback((blob) => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !blob) return;

    setLocalImageUri((currentUrl) => {
      if (currentUrl?.startsWith("blob:")) {
        window.URL.revokeObjectURL(currentUrl);
      }
      return window.URL.createObjectURL(blob);
    });
  }, []);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      !barcode ||
      !remoteProductImages?.detailUrl ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    let active = true;
    restoreTemporaryProductImages(barcode, remoteProductImages)
      .then(({ detailBlob, thumbnailBlob } = {}) => {
        if (!active || !detailBlob) return;
        showLocalDetailBlob(detailBlob);
        setImageSizeBytes(detailBlob.size);
        setThumbnailSizeBytes(thumbnailBlob?.size || null);
      })
      .catch((error) => {
        console.warn("Temporary product image restore failed:", error);
      });

    return () => {
      active = false;
    };
  }, [barcode, remoteProductImages, showLocalDetailBlob]);

  const persistLocalProductImage = useCallback(
    async (sourceBlob, source = "gallery") => {
      if (!barcode) {
        throw new Error("No hay código de barras para asociar la imagen.");
      }

      const [thumbnailBlob, detailBlob] = await Promise.all([
        convertImageBlobToJpeg(sourceBlob, PRODUCT_THUMBNAIL_MAX_SIZE),
        convertImageBlobToJpeg(sourceBlob, PRODUCT_DETAIL_MAX_SIZE),
      ]);

      await saveProductImageBlobs(barcode, {
        detailBlob,
        thumbnailBlob,
        source,
      });

      showLocalDetailBlob(detailBlob);
      setImageSizeBytes(detailBlob.size);
      setThumbnailSizeBytes(thumbnailBlob.size);

      return { detailBlob, thumbnailBlob };
    },
    [barcode, showLocalDetailBlob],
  );

  const handleSelectProductImage = useCallback(async () => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      setLocalError(
        "La selección de imagen desde archivo está habilitada en la PWA web.",
      );
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = false;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setSelectingImage(true);
      setLocalError(null);
      try {
        await persistLocalProductImage(file, "gallery");
      } catch (error) {
        console.error("EditScannedItemScreen select image error:", error);
        setLocalError(
          error?.message || "No se pudo importar y guardar la imagen.",
        );
      } finally {
        setSelectingImage(false);
        input.remove();
      }
    };

    input.click();
  }, [persistLocalProductImage]);

  useEffect(() => {
    let active = true;

    getSearchSettings()
      .then((settings) => {
        if (!active) return;
        setSelectedSearchEngine(
          settings?.selectedProductEngine ||
            settings?.generalEngine ||
            DEFAULT_ENGINE,
        );
      })
      .catch(() => {
        if (active) setSelectedSearchEngine(DEFAULT_ENGINE);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setProductUrl((currentUrl) =>
      normalizeProductUrlForType(currentUrl, productType),
    );
  }, [productType]);

  const selectedEngine =
    SEARCH_ENGINES[selectedSearchEngine] || SEARCH_ENGINES[DEFAULT_ENGINE];
  const selectedEngineLabel = selectedEngine?.label || "Buscar producto";

  const resolvedName = useMemo(() => {
    return (
      normalizeString(name) ||
      getProductDisplayName(product, barcode) ||
      "Producto sin identificar"
    );
  }, [name, product, barcode]);

  const fillFormFromProduct = useCallback(
    (nextProduct) => {
      if (!nextProduct) {
        return;
      }

      const nextProductType = normalizeString(
        nextProduct.productType || nextProduct.product_type,
      );

      setName(getProductDisplayName(nextProduct, barcode));
      setBrand(getProductBrand(nextProduct));
      setCategory(getProductCategory(nextProduct));
      setProductType(nextProductType);
      setDetails(
        nextProduct.details && typeof nextProduct.details === "object"
          ? nextProduct.details
          : {},
      );
      setNotes(normalizeString(nextProduct.notes));
      setProductUrl(
        normalizeProductUrlForType(
          getProductUrl(nextProduct, barcode),
          nextProductType,
        ),
      );
    },
    [barcode],
  );

  const applyConvexProduct = useCallback(
    (convexProduct) => {
      if (!convexProduct) {
        return;
      }

      setProduct(convexProduct);
      setAccessCount(convexProduct.accessCount || 1);
      setProductStatus(convexProduct.status || "pending");
      setDataSource(convexProduct.source || "convex");

      fillFormFromProduct(convexProduct);
    },
    [fillFormFromProduct],
  );

  const searchExternalProduct = useCallback(
    async ({ silent = false } = {}) => {
      if (!barcode) {
        setLocalError("No se ha recibido ningún código de barras.");
        return null;
      }

      if (!silent) {
        setLocalError(null);
      }

      setConsultingInternet(true);

      try {
        const result = await lookupWithCache(barcode, {
          forceRefresh: !silent,
        });
        const cachedProduct = result?.product ?? null;

        if (result?.notFound || !hasUsefulProductData(cachedProduct)) {
          setProductStatus("not_found");

          if (!silent) {
            setLocalError(
              "No se encontró información. Puedes introducirla manualmente.",
            );
          }

          return null;
        }

        setRecordCreated(false);
        applyConvexProduct(cachedProduct);

        return cachedProduct;
      } catch (error) {
        console.error("EditScannedItemScreen external lookup error:", error);

        if (!silent) {
          setLocalError(
            error?.message ||
              "No se pudo consultar la información del producto.",
          );
        }

        return null;
      } finally {
        setConsultingInternet(false);
      }
    },
    [barcode, lookupWithCache, applyConvexProduct],
  );

  useEffect(() => {
    let active = true;

    async function initializeProduct() {
      if (userIsLoading) {
        return;
      }

      if (!barcode) {
        setLocalError("No se ha recibido ningún código de barras.");
        setInitializing(false);
        return;
      }

      if (initializedBarcodeRef.current === barcode) {
        return;
      }

      initializedBarcodeRef.current = barcode;

      setInitializing(true);
      setLocalError(null);

      if (!isAdmin) {
        if (initialProduct && hasUsefulProductData(initialProduct)) {
          setProduct(initialProduct);
          setProductStatus(initialProduct.status || "pending_review");
          setDataSource(initialProduct.source || "scanner");
          fillFormFromProduct(initialProduct);
        } else {
          await searchExternalProduct({ silent: true });
        }

        if (active) {
          setInitializing(false);
        }

        return;
      }

      try {
        const result = await registerAccess({ barcode });

        if (!active) {
          return;
        }

        const convexProduct = result?.product ?? null;

        setRecordCreated(Boolean(result?.created));
        applyConvexProduct(convexProduct);

        if (
          initialProduct &&
          hasUsefulProductData(initialProduct) &&
          !hasUsefulProductData(convexProduct)
        ) {
          fillFormFromProduct(initialProduct);
        }

        if (!hasUsefulProductData(convexProduct)) {
          await searchExternalProduct({ silent: true });
        }
      } catch (error) {
        console.error("EditScannedItemScreen initialization error:", error);

        if (active) {
          setLocalError(
            error?.message || "No se pudo registrar el acceso al producto.",
          );
        }
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    }

    initializeProduct();

    return () => {
      active = false;
    };
  }, [
    barcode,
    userIsLoading,
    isAdmin,
    initialProduct,
    registerAccess,
    applyConvexProduct,
    fillFormFromProduct,
    searchExternalProduct,
  ]);

  const handleSave = useCallback(async () => {
    if (!barcode) {
      setLocalError("No hay código de barras para guardar.");
      return;
    }

    const normalizedName = normalizeString(name);

    if (!normalizedName) {
      setLocalError("El nombre del producto no puede estar vacío.");
      return;
    }

    setSaving(true);
    setLocalError(null);

    try {
      // IndexedDB sigue siendo la copia principal. Si el usuario activó la
      // sincronización, Convex conserva ambas imágenes durante siete días.
      const normalizedDetails = Object.fromEntries(
        Object.entries(details || {})
          .map(([key, value]) => [key, normalizeString(value)])
          .filter(([, value]) => Boolean(value)),
      );

      if (!isAdmin) {
        await submitProductReview({
          barcode,
          name: normalizedName,
          brand: normalizeString(brand) || undefined,
          category: normalizeString(category) || undefined,
          productType: normalizeString(productType) || undefined,
          details: normalizedDetails,
          notes: normalizeString(notes) || undefined,
          productUrl: normalizeString(productUrl) || undefined,
          source: "user_review",
          status: "pending_review",
        });

        const historyPatch = {
          barcode,
          name: normalizedName,
          brand: normalizeString(brand),
          category: normalizeString(category),
          productType: normalizeString(productType),
          details: normalizedDetails,
          notes: normalizeString(notes),
          url: normalizeString(productUrl),
          productUrl: normalizeString(productUrl),
          source: historyItem?.source || "scanner",
          dataSource: "pending_review",
          reviewStatus: "pending_review",
        };

        await scanHistoryStorage.updateScannedEntry(barcode, historyPatch);
        if (scanHistoryStorage.syncEnabled) {
          try {
            await uploadTemporaryProductImages({
              barcode,
              generateUploadUrl: generateProductImageUploadUrl,
              saveRemoteImages: saveRemoteProductImages,
            });
          } catch (imageSyncError) {
            console.warn(
              "Temporary product image upload failed:",
              imageSyncError,
            );
          }
        }
        navigation.goBack();
        return;
      }

      const savedProduct = await saveProductData({
        barcode,
        name: normalizedName,
        brand: normalizeString(brand) || undefined,
        category: normalizeString(category) || undefined,
        productType: normalizeString(productType) || undefined,
        details: normalizedDetails,
        notes: normalizeString(notes) || undefined,
        productUrl: normalizeString(productUrl) || undefined,
        source: "manual",
        status: "complete",
      });

      const historyPatch = {
        barcode,
        name: normalizedName,
        brand: normalizeString(brand),
        category: normalizeString(category),
        productType: normalizeString(productType),
        details: normalizedDetails,
        notes: normalizeString(notes),
        url: normalizeString(productUrl),
        productUrl: normalizeString(productUrl),
        source: historyItem?.source || "scanner",
        dataSource: "manual",
      };

      await scanHistoryStorage.updateScannedEntry(barcode, historyPatch);

      if (scanHistoryStorage.syncEnabled) {
        try {
          await uploadTemporaryProductImages({
            barcode,
            generateUploadUrl: generateProductImageUploadUrl,
            saveRemoteImages: saveRemoteProductImages,
          });
        } catch (imageSyncError) {
          console.warn("Temporary product image upload failed:", imageSyncError);
        }
      }

      setProduct(savedProduct);
      navigation.goBack();
    } catch (error) {
      console.error("EditScannedItemScreen save error:", error);

      setLocalError(
        error?.message ||
          (isAdmin
            ? "No se pudo guardar la información del producto."
            : "No se pudo enviar la propuesta a revisión."),
      );
    } finally {
      setSaving(false);
    }
  }, [
    barcode,
    isAdmin,
    historyItem,
    name,
    brand,
    category,
    productType,
    details,
    notes,
    productUrl,
    saveProductData,
    submitProductReview,
    scanHistoryStorage,
    navigation,
    generateProductImageUploadUrl,
    saveRemoteProductImages,
  ]);

  const handleDeleteFromHistory = useCallback(async () => {
    if (!barcode) {
      navigation.goBack();
      return;
    }

    setDeleting(true);
    setLocalError(null);

    try {
      await scanHistoryStorage.removeScannedItem(barcode);
      if (scanHistoryStorage.syncEnabled) {
        await removeRemoteProductImages({ barcode });
      }
      navigation.goBack();
    } catch (error) {
      console.error("EditScannedItemScreen delete error:", error);

      setLocalError("No se pudo eliminar el producto del historial local.");
    } finally {
      setDeleting(false);
    }
  }, [
    barcode,
    navigation,
    scanHistoryStorage,
    removeRemoteProductImages,
  ]);

  const handleDeleteFromDatabase = useCallback(async () => {
    if (!barcode) {
      setLocalError("No hay código de barras para eliminar.");
      return;
    }

    setDeletingFromDatabase(true);
    setLocalError(null);

    try {
      await deleteProductByBarcode({ barcode });
      await scanHistoryStorage.removeScannedItem(barcode);
      navigation.goBack();
    } catch (error) {
      console.error("EditScannedItemScreen database delete error:", error);
      setLocalError(
        error?.message || "No se pudo eliminar la ficha de la base de datos.",
      );
    } finally {
      setDeletingFromDatabase(false);
    }
  }, [barcode, deleteProductByBarcode, navigation, scanHistoryStorage]);

  const handleExternalSearch = useCallback(async () => {
    if (!barcode) {
      setLocalError("No hay código de barras para buscar.");
      return;
    }

    try {
      setLocalError(null);
      await openSearchEngine(selectedSearchEngine, barcode);
    } catch (error) {
      setLocalError(error?.message || "No se pudo abrir el motor de búsqueda.");
    }
  }, [barcode, selectedSearchEngine]);

  const handleGoogleAIModeSearch = useCallback(async () => {
    if (!barcode) {
      setLocalError("No hay código de barras para buscar.");
      return;
    }

    try {
      setLocalError(null);
      const query = isMusicProductType(productType)
        ? buildMusicCdLookupPrompt(barcode)
        : isBookProductType(productType)
          ? buildBookLookupPrompt(barcode)
          : buildSupermarketLookupPrompt(barcode);
      await openGoogleAIMode(query);
    } catch (error) {
      setLocalError(error?.message || "No se pudo abrir Google Modo IA.");
    }
  }, [barcode, productType]);

  const handleApplySupermarketJson = useCallback(() => {
    try {
      setLocalError(null);
      const data = parseMusicJson(supermarketJson);
      const jsonBarcode = normalizeBarcode(
        data.barcode || data.ean || data.gtin,
      );

      if (jsonBarcode && barcode && jsonBarcode !== barcode) {
        throw new Error(
          `El JSON corresponde al código ${jsonBarcode}, no a ${barcode}.`,
        );
      }

      const nextDetails = {
        subcategory: normalizeString(data.subcategory),
        manufacturer: normalizeString(data.manufacturer),
        countryOfOrigin: normalizeString(data.countryOfOrigin),
        ingredients: normalizeString(data.ingredients),
        allergens: joinJsonValues(data.allergens),
      };

      setProductType("Supermercado");
      if (normalizeString(data.name)) setName(normalizeString(data.name));
      if (normalizeString(data.brand)) setBrand(normalizeString(data.brand));
      if (normalizeString(data.category)) {
        setCategory(normalizeString(data.category));
      }
      setDetails((current) => {
        const merged = { ...current };
        Object.entries(nextDetails).forEach(([key, value]) => {
          if (value) merged[key] = value;
        });
        return merged;
      });
      const nextProductUrl = normalizeExternalUrl(
        data.productPageUrl || data.productUrl || data.sourceUrl,
      );
      if (nextProductUrl) setProductUrl(nextProductUrl);
      if (normalizeString(data.description || data.verificationNotes)) {
        setNotes(joinJsonValues(data.description, data.verificationNotes));
      }
      setSupermarketJson("");
    } catch (error) {
      setLocalError(
        error instanceof SyntaxError
          ? "El texto pegado no es un JSON válido. Copia únicamente el objeto JSON."
          : error?.message || "No se pudo aplicar la ficha de supermercado.",
      );
    }
  }, [barcode, supermarketJson]);

  const handleApplyMusicJson = useCallback(() => {
    try {
      setLocalError(null);
      const data = parseMusicJson(musicJson);
      const jsonBarcode = normalizeBarcode(
        data.barcode || data.ean13 || data.upcA,
      );

      if (jsonBarcode && barcode && jsonBarcode !== barcode) {
        throw new Error(
          `El JSON corresponde al código ${jsonBarcode}, no a ${barcode}.`,
        );
      }

      const nextDetails = {
        artist: joinJsonValues(data.primaryArtist, data.artists),
        composer: joinJsonValues(data.composer, data.composers),
        format: normalizeString(data.physicalFormat || data.support),
        discCount: normalizeString(data.numberOfDiscs || data.discCount),
        subcategory: normalizeString(data.subcategory || data.subgenre),
        label: normalizeString(data.label),
        releaseYear: normalizeString(data.releaseYear || data.releaseDate),
      };

      setProductType("Música");
      if (normalizeString(data.title)) setName(normalizeString(data.title));
      if (normalizeString(data.category || data.genre)) {
        setCategory(normalizeString(data.category || data.genre));
      }
      setDetails((current) => {
        const merged = { ...current };
        Object.entries(nextDetails).forEach(([key, value]) => {
          if (value) merged[key] = value;
        });
        return merged;
      });
      if (normalizeString(data.productPageUrl)) {
        const nextProductUrl = normalizeExternalUrl(data.productPageUrl);
        if (nextProductUrl) setProductUrl(nextProductUrl);
      }
      if (normalizeString(data.description || data.contentsSummary)) {
        setNotes(joinJsonValues(data.description, data.contentsSummary));
      }
      setMusicJson("");
    } catch (error) {
      setLocalError(
        error instanceof SyntaxError
          ? "El texto pegado no es un JSON válido. Copia únicamente el objeto JSON."
          : error?.message || "No se pudo aplicar la ficha musical.",
      );
    }
  }, [barcode, musicJson]);

  const handleApplyBookJson = useCallback(() => {
    try {
      setLocalError(null);
      const data = parseMusicJson(bookJson);
      const jsonBarcode = normalizeBarcode(
        data.barcode || data.isbn13 || data.isbn10,
      );

      if (jsonBarcode && barcode && jsonBarcode !== barcode) {
        throw new Error(
          `El JSON corresponde al código ${jsonBarcode}, no a ${barcode}.`,
        );
      }

      const nextDetails = {
        authors: joinJsonValues(data.authors, data.author),
        isbn13: normalizeString(data.isbn13),
        publisher: normalizeString(data.publisher),
        publicationYear: normalizeString(data.publicationYear),
        language: normalizeString(data.language),
        pageCount: normalizeString(data.pageCount),
        category: normalizeString(data.category || data.genre),
        format: normalizeString(data.physicalFormat || data.format),
        synopsis: normalizeString(data.synopsis || data.description),
      };

      setProductType("Libros");
      if (normalizeString(data.title)) setName(normalizeString(data.title));
      setDetails((current) => {
        const merged = { ...current };
        Object.entries(nextDetails).forEach(([key, value]) => {
          if (value) merged[key] = value;
        });
        return merged;
      });
      if (normalizeString(data.productPageUrl)) {
        const nextProductUrl = normalizeExternalUrl(data.productPageUrl);
        if (nextProductUrl) setProductUrl(nextProductUrl);
      }
      setBookJson("");
    } catch (error) {
      setLocalError(
        error instanceof SyntaxError
          ? "El texto pegado no es un JSON válido. Copia únicamente el objeto JSON."
          : error?.message || "No se pudo aplicar la ficha del libro.",
      );
    }
  }, [barcode, bookJson]);

  if (userIsLoading) {
    return (
      <View style={styles.accessScreen}>
        <View style={styles.accessCard}>
          <ActivityIndicator color="#2563EB" />
          <Text style={styles.accessTitle}>Comprobando permisos</Text>
          <Text style={styles.accessDescription}>
            Estamos verificando si tu usuario puede editar productos escaneados.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isWideLayout && styles.contentWide,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.productHeader}>
          <View style={styles.productHeaderTopRow}>
            <View style={styles.productHeaderIdentity}>
              <View style={styles.productIconContainer}>
                <Ionicons name="barcode-outline" size={26} color="#FFFFFF" />
              </View>

              <Text style={styles.productHeaderLabel}>PRODUCTO ESCANEADO</Text>
            </View>

            <View style={styles.productLocatedBadge}>
              <View
                style={[
                  styles.productLocatedDot,
                  productStatus === "not_found" &&
                    styles.productLocatedDotWarning,
                ]}
              />
              <Text style={styles.productLocatedText}>
                {productStatus === "not_found"
                  ? "Sin identificar"
                  : "Producto localizado"}
              </Text>
            </View>
          </View>

          <Text style={styles.productName} numberOfLines={3}>
            {resolvedName}
          </Text>

          <BarcodeLink barcode={barcode} style={styles.productBarcodeRow}>
            <View style={styles.productBarcodeContent}>
              <Text style={styles.productBarcodeLabel}>Código de barras</Text>
              <Text
                style={styles.productBarcodeValue}
                numberOfLines={1}
                selectable
              >
                {barcode || "Sin código"}
              </Text>
            </View>

            <View style={styles.productBarcodeTypeBadge}>
              <Text style={styles.productBarcodeTypeText}>EAN-13</Text>
            </View>
          </BarcodeLink>
        </View>

        {visibleError ? (
          <View style={styles.errorBox}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={20} color="#B42318" />
            </View>

            <Text style={styles.errorText}>{visibleError}</Text>
          </View>
        ) : null}

        <View style={[styles.workspace, isWideLayout && styles.workspaceWide]}>
          <View
            style={[styles.leftColumn, isWideLayout && styles.leftColumnWide]}
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>VISTA PREVIA</Text>
                  <Text style={styles.cardTitle}>Imagen del producto</Text>
                </View>

                <View style={styles.softBadge}>
                  <Ionicons name="image-outline" size={15} color="#475467" />
                  <Text style={styles.softBadgeText}>Caché activa</Text>
                </View>
              </View>

              <ProductImage
                uri={displayedImageUri}
                productName={resolvedName}
              />

              {isAdmin && Platform.OS === "web" ? (
                <View style={styles.imageImportArea}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Importar imagen del producto"
                    accessibilityState={{ disabled: selectingImage }}
                    style={({ pressed }) => [
                      styles.pasteImageButton,
                      styles.imageImportButton,
                      pressed && styles.pasteImageButtonPressed,
                      selectingImage && styles.pasteImageButtonDisabled,
                    ]}
                    onPress={handleSelectProductImage}
                    disabled={selectingImage}
                  >
                    {selectingImage ? (
                      <ActivityIndicator size="small" color="#175CD3" />
                    ) : (
                      <Ionicons
                        name="cloud-upload-outline"
                        size={18}
                        color="#175CD3"
                      />
                    )}
                    <View style={styles.imageImportTextBlock}>
                      <Text style={styles.pasteImageButtonText}>
                        {selectingImage
                          ? "Importando imagen..."
                          : "Importar imagen"}
                      </Text>
                      <Text style={styles.imageImportHint}>
                        Crea detalle.jpeg de 256 px y thumbnail.jpeg de 64 px
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}

              {formatKilobytes(imageSizeBytes) ||
              formatKilobytes(thumbnailSizeBytes) ? (
                <View style={styles.imageSizeNotice}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color="#475467"
                  />
                  <Text style={styles.imageSizeNoticeText}>
                    Detalle {PRODUCT_DETAIL_MAX_SIZE} px :{" "}
                    {formatKilobytes(imageSizeBytes) || "—"}
                    {"  ·  "}
                    Miniatura {PRODUCT_THUMBNAIL_MAX_SIZE} px :{" "}
                    {formatKilobytes(thumbnailSizeBytes) || "—"}
                  </Text>
                </View>
              ) : null}
            </View>

            <StatusCard
              source={dataSource}
              created={recordCreated}
              accessCount={accessCount}
              status={productStatus}
              loading={initializing}
              consultingInternet={consultingInternet || internetLookupLoading}
            />

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>BÚSQUEDA EXTERNA</Text>
                  <Text style={styles.cardTitle}>Buscar más información</Text>
                  <Text style={styles.cardDescription}>
                    Abre el código de barras en un buscador externo.
                  </Text>
                </View>

                <Ionicons name="open-outline" size={20} color="#667085" />
              </View>
              {!isMusicProductType(productType) &&
              !isBookProductType(productType) ? (
                <GoogleModeIA
                  busy={busy}
                  barcode={barcode}
                  onPress={handleGoogleAIModeSearch}
                />
              ) : null}
              <ExternalSearchButton
                busy={busy}
                barcode={barcode}
                engineLabel={selectedEngineLabel}
                onPress={handleExternalSearch}
              />
            </View>
          </View>

          <View
            style={[styles.rightColumn, isWideLayout && styles.rightColumnWide]}
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardEyebrow}>DATOS PRINCIPALES</Text>
                  <Text style={styles.cardTitle}>Información del producto</Text>
                  <Text style={styles.cardDescription}>
                    {isAdmin
                      ? "Edita los campos y guarda la ficha consolidada en Convex."
                      : "Completa los campos y envía la propuesta para revisión."}
                  </Text>
                </View>

                <View style={styles.editBadge}>
                  <Ionicons
                    name={isAdmin ? "create-outline" : "time-outline"}
                    size={14}
                    color="#027A48"
                  />
                  <Text style={styles.editBadgeText}>
                    {isAdmin ? "Editable" : "Revisión"}
                  </Text>
                </View>
              </View>

              <FormField
                label={
                  productType === "Libros"
                    ? "Título"
                    : productType === "Música"
                      ? "Título"
                      : "Nombre"
                }
                value={name}
                onChangeText={setName}
                placeholder={
                  productType === "Libros"
                    ? "Título del libro"
                    : productType === "Música"
                      ? "Título de la obra o álbum"
                      : "Nombre del producto"
                }
              />

              <ProductTypeSelector
                value={productType}
                onChange={setProductType}
              />

              {isSupermarketProductType(productType) ? (
                <>
                  <View style={styles.musicJsonSearchAction}>
                    <GoogleModeIA
                      busy={busy}
                      barcode={barcode}
                      supermarketJsonSearch
                      onPress={handleGoogleAIModeSearch}
                    />
                  </View>
                  <View style={styles.musicJsonImporter}>
                    <Text style={styles.label}>
                      JSON de la ficha de supermercado
                    </Text>
                    <Text style={styles.musicJsonDescription}>
                      Copia la respuesta de Google Modo IA, pégala aquí y
                      aplícala para rellenar los campos.
                    </Text>
                    <TextInput
                      value={supermarketJson}
                      onChangeText={setSupermarketJson}
                      placeholder={'{"barcode":"...","name":"..."}'}
                      placeholderTextColor="#98A2B3"
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.musicJsonInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Aplicar JSON a la ficha de supermercado"
                      disabled={busy || !normalizeString(supermarketJson)}
                      onPress={handleApplySupermarketJson}
                      style={({ pressed }) => [
                        styles.applyJsonButton,
                        pressed && styles.applyJsonButtonPressed,
                        (busy || !normalizeString(supermarketJson)) &&
                          styles.disabledButton,
                      ]}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.applyJsonButtonText}>
                        Aplicar datos del JSON
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {isMusicProductType(productType) ? (
                <>
                  <View style={styles.musicJsonSearchAction}>
                    <GoogleModeIA
                      busy={busy}
                      barcode={barcode}
                      musicJsonSearch
                      onPress={handleGoogleAIModeSearch}
                    />
                  </View>
                  <View style={styles.musicJsonImporter}>
                    <Text style={styles.label}>JSON de la ficha musical</Text>
                    <Text style={styles.musicJsonDescription}>
                      Copia la respuesta de Google Modo IA, pégala aquí y
                      aplícala para rellenar los campos.
                    </Text>
                    <TextInput
                      value={musicJson}
                      onChangeText={setMusicJson}
                      placeholder={'{"barcode":"...","title":"..."}'}
                      placeholderTextColor="#98A2B3"
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.musicJsonInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Aplicar JSON a la ficha musical"
                      disabled={busy || !normalizeString(musicJson)}
                      onPress={handleApplyMusicJson}
                      style={({ pressed }) => [
                        styles.applyJsonButton,
                        pressed && styles.applyJsonButtonPressed,
                        (busy || !normalizeString(musicJson)) &&
                          styles.disabledButton,
                      ]}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.applyJsonButtonText}>
                        Aplicar datos del JSON
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {isBookProductType(productType) ? (
                <>
                  <View style={styles.musicJsonSearchAction}>
                    <GoogleModeIA
                      busy={busy}
                      barcode={barcode}
                      bookJsonSearch
                      onPress={handleGoogleAIModeSearch}
                    />
                  </View>
                  <View style={styles.musicJsonImporter}>
                    <Text style={styles.label}>JSON de la ficha del libro</Text>
                    <Text style={styles.musicJsonDescription}>
                      Copia la respuesta de Google Modo IA, pégala aquí y
                      aplícala para rellenar los campos.
                    </Text>
                    <TextInput
                      value={bookJson}
                      onChangeText={setBookJson}
                      placeholder={'{"barcode":"...","title":"..."}'}
                      placeholderTextColor="#98A2B3"
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.musicJsonInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Aplicar JSON a la ficha del libro"
                      disabled={busy || !normalizeString(bookJson)}
                      onPress={handleApplyBookJson}
                      style={({ pressed }) => [
                        styles.applyJsonButton,
                        pressed && styles.applyJsonButtonPressed,
                        (busy || !normalizeString(bookJson)) &&
                          styles.disabledButton,
                      ]}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.applyJsonButtonText}>
                        Aplicar datos del JSON
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {!productType || productType === "Supermercado" ? (
                <FormField
                  label="Marca"
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="Marca o fabricante"
                  autoCapitalize="words"
                />
              ) : null}

              {isMusicProductType(productType) ? (
                <FormField
                  label="Categoría"
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Ej. Música clásica"
                />
              ) : null}

              <ProductDetailsFields
                productType={productType}
                details={details}
                category={category}
                onCategoryChange={setCategory}
                onChange={(key, value) =>
                  setDetails((current) => ({ ...current, [key]: value }))
                }
              />

              <FormField
                label="Notas"
                value={notes}
                onChangeText={setNotes}
                placeholder="Notas personales sobre el producto"
                multiline
              />

              <FormField
                label="URL del producto"
                value={productUrl}
                onChangeText={setProductUrl}
                placeholder="https://..."
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>ACCIONES</Text>
                  <Text style={styles.cardTitle}>Producto</Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  busy && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={busy}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        isAdmin ? "checkmark-circle-outline" : "send-outline"
                      }
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.primaryButtonText}>
                      {isAdmin ? "Guardar producto" : "Enviar a revisión"}
                    </Text>
                  </>
                )}
              </Pressable>

              {isAdmin ? (
                <>
                  <ActualizarDesdeInternet
                    busy={busy}
                    consultingInternet={consultingInternet}
                    internetLookupLoading={internetLookupLoading}
                    onPress={() => searchExternalProduct({ silent: false })}
                  />
                  <ProductInfo
                    busy={busy}
                    barcode={barcode}
                    dataSource={dataSource}
                    navigation={navigation}
                    product={product}
                  />
                  <EliminarDelHistorial
                    busy={busy}
                    deleting={deleting}
                    onDelete={handleDeleteFromHistory}
                  />
                  <EliminarDeBaseDeDatos
                    busy={busy}
                    deleting={deletingFromDatabase}
                    onDelete={handleDeleteFromDatabase}
                  />
                  <CerrarSinGuardar navigation={navigation} busy={busy} />
                </>
              ) : (
                <>
                  <EliminarDelHistorial
                    busy={busy}
                    deleting={deleting}
                    onDelete={handleDeleteFromHistory}
                  />
                  <CerrarSinGuardar navigation={navigation} busy={busy} />
                </>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.footerNote}>
          {isAdmin
            ? "La ficha global se conserva en Convex. El historial local pertenece a este dispositivo."
            : "Tu propuesta quedará pendiente hasta que un administrador la revise."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F2F4F7",
  },

  accessScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F2F4F7",
  },

  accessCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    padding: 24,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.08)",
      },
      default: {
        shadowColor: "#101828",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },

  accessTitle: {
    marginTop: 12,
    color: "#101828",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    textAlign: "center",
  },

  accessDescription: {
    marginTop: 8,
    color: "#667085",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },

  scroll: {
    flex: 1,
  },

  content: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 44,
  },

  contentWide: {
    maxWidth: 1180,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 56,
  },

  workspace: {
    gap: 14,
  },

  workspaceWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 18,
  },

  leftColumn: {
    gap: 14,
  },

  leftColumnWide: {
    width: 420,
    flexShrink: 0,
  },

  rightColumn: {
    gap: 14,
  },

  rightColumnWide: {
    flex: 1,
    minWidth: 0,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.06)",
      },
      default: {
        shadowColor: "#101828",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  cardEyebrow: {
    color: "#98A2B3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 4,
  },

  cardTitle: {
    color: "#101828",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },

  cardDescription: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  softBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F2F4F7",
  },

  softBadgeText: {
    color: "#475467",
    fontSize: 10,
    fontWeight: "800",
  },

  imageContainer: {
    position: "relative",
    minHeight: 240,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
  },

  imageClipboardActions: {
    marginTop: 10,
  },

  imageImportArea: {
    marginTop: 12,
  },
  imageImportButton: {
    width: "100%",
    justifyContent: "center",
  },
  imageImportTextBlock: {
    flex: 1,
  },
  imageImportHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: "#667085",
    fontWeight: "500",
  },

  imageSizeNotice: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#F2F4F7",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },

  imageSizeNoticeText: {
    color: "#475467",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
  },

  productImage: {
    width: "100%",
    height: 260,
    backgroundColor: "#F8FAFC",
  },

  cacheBadge: {
    display: "none",
  },

  cacheBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  imagePlaceholder: {
    minHeight: 240,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderStyle: "dashed",
  },

  imagePlaceholderIcon: {
    fontSize: 36,
    marginBottom: 10,
  },

  imagePlaceholderTitle: {
    color: "#344054",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  imagePlaceholderDescription: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 5,
  },

  statusCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    ...Platform.select({
      web: {
        boxShadow: "0 8px 24px rgba(16, 24, 40, 0.05)",
      },
      default: {
        shadowColor: "#101828",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 1,
      },
    }),
  },

  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  statusIconText: {
    color: "#2563EB",
    fontSize: 20,
    fontWeight: "900",
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    color: "#101828",
    fontSize: 15,
    fontWeight: "900",
  },

  statusDescription: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },

  statusMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },

  metaBadge: {
    backgroundColor: "#F2F4F7",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  metaBadgeText: {
    color: "#475467",
    fontSize: 11,
    fontWeight: "800",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "#FECDCA",
    borderRadius: 17,
    padding: 14,
    marginBottom: 14,
  },

  errorIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#FEE4E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  errorText: {
    flex: 1,
    color: "#B42318",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },

  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF3",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  editBadgeText: {
    color: "#027A48",
    fontSize: 11,
    fontWeight: "900",
  },

  formGrid: {
    flexDirection: "row",
    gap: 12,
  },

  formGridItem: {
    flex: 1,
    minWidth: 0,
  },

  detailsSection: {
    marginTop: 8,
    marginBottom: 4,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },

  musicJsonImporter: {
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
  },

  musicJsonSearchAction: {
    marginTop: 14,
  },

  musicJsonDescription: {
    marginTop: 4,
    marginBottom: 10,
    color: "#475467",
    fontSize: 12,
    lineHeight: 18,
  },

  musicJsonInput: {
    minHeight: 130,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    color: "#101828",
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  applyJsonButton: {
    minHeight: 46,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  applyJsonButtonPressed: {
    backgroundColor: "#1D4ED8",
  },

  applyJsonButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  detailsGrid: {
    marginTop: 14,
  },

  detailsGridItem: {
    width: "100%",
  },

  productTypeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  productTypeOption: {
    minHeight: 42,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
  },

  productTypeOptionSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },

  productTypeOptionPressed: {
    opacity: 0.75,
  },

  productTypeOptionText: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "700",
  },

  productTypeOptionTextSelected: {
    color: "#1D4ED8",
    fontWeight: "900",
  },

  field: {
    marginTop: 14,
  },

  label: {
    color: "#344054",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7,
  },

  input: {
    minHeight: 50,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: "#101828",
    fontSize: 15,
    outlineStyle: Platform.OS === "web" ? "none" : undefined,
  },

  multilineInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },

  pasteImageButton: {
    minHeight: 46,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#B2CCFF",
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },

  pasteImageButtonPressed: {
    opacity: 0.75,
  },

  pasteImageButtonDisabled: {
    opacity: 0.6,
  },

  pasteImageButtonText: {
    color: "#175CD3",
    fontSize: 14,
    fontWeight: "800",
  },

  primaryButton: {
    minHeight: 54,
    backgroundColor: "#101828",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },

  primaryButtonPressed: {
    backgroundColor: "#1D2939",
    transform: [{ scale: 0.995 }],
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryButton: {
    minHeight: 58,
    marginTop: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },

  secondaryButtonPressed: {
    backgroundColor: "#DBEAFE",
    transform: [{ scale: 0.995 }],
  },

  buttonTextBlock: {
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "900",
  },

  secondaryButtonHint: {
    color: "#5B76A8",
    fontSize: 10,
    marginTop: 2,
  },

  dangerZone: {
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECDCA",
    borderRadius: 16,
    backgroundColor: "#FFF9F8",
  },

  dangerZoneHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  dangerZoneText: {
    flex: 1,
  },

  dangerZoneTitle: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "900",
  },

  dangerZoneDescription: {
    color: "#B5473C",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  deleteButton: {
    minHeight: 44,
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FDA29B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
  },

  deleteButtonStandalone: {
    marginTop: 14,
  },

  deleteButtonPressed: {
    backgroundColor: "#FEF3F2",
  },

  deleteButtonText: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "900",
  },

  deleteDatabaseButton: {
    minHeight: 44,
    marginTop: 10,
    borderRadius: 13,
    backgroundColor: "#B42318",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
  },

  deleteDatabaseButtonPressed: {
    backgroundColor: "#912018",
  },

  deleteDatabaseButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  cancelButton: {
    minHeight: 46,
    marginTop: 8,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  cancelButtonPressed: {
    backgroundColor: "#F2F4F7",
  },

  cancelButtonText: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "800",
  },

  externalAction: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },

  externalActionPressed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#98A2B3",
  },

  externalActionPrimary: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    borderColor: "#1D4ED8",
  },

  externalActionPrimaryPressed: {
    backgroundColor: "#1D4ED8",
  },

  googleIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  googleIconText: {
    color: "#4285F4",
    fontSize: 22,
    fontWeight: "900",
  },

  shoppingIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  externalActionContent: {
    flex: 1,
    minWidth: 0,
  },

  externalActionTitle: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "900",
  },

  externalActionTitleLight: {
    color: "#FFFFFF",
  },

  externalActionDescription: {
    color: "#667085",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  externalActionDescriptionLight: {
    color: "#DBEAFE",
  },

  disabledButton: {
    opacity: 0.5,
  },

  footerNote: {
    color: "#667085",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 20,
    marginTop: 14,
  },

  productHeader: {
    width: "100%",
    gap: 14,
    marginBottom: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#101828",
    ...Platform.select({
      web: {
        boxShadow: "0 18px 50px rgba(16, 24, 40, 0.16)",
      },
      default: {
        shadowColor: "#101828",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 22,
        elevation: 5,
      },
    }),
  },

  productHeaderTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  productHeaderIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  productIconContainer: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#1D2939",
  },

  productHeaderLabel: {
    flexShrink: 1,
    color: "#A5B0C4",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: 1.6,
  },

  productLocatedBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#202C42",
  },

  productLocatedDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#39D98A",
  },

  productLocatedDotWarning: {
    backgroundColor: "#FDB022",
  },

  productLocatedText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  productName: {
    color: "#FFFFFF",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
  },

  productBarcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: "#1D2939",
  },

  productBarcodeRowPressed: {
    opacity: 0.82,
  },

  productBarcodeContent: {
    flex: 1,
    minWidth: 0,
  },

  productBarcodeLabel: {
    marginBottom: 3,
    color: "#98A2B3",
    fontSize: 11,
    fontWeight: "800",
  },

  productBarcodeValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  productBarcodeTypeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#344054",
  },

  productBarcodeTypeText: {
    color: "#D0D5DD",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
});
