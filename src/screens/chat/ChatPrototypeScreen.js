import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { api } from "@/convex/_generated/api";
import {
  I18nText as Text,
  I18nTextInput as TextInput,
  tr,
  useI18n,
} from "@/src/i18n";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import QuickEan13Scanner from "@/src/components/features/scanner/QuickEan13Scanner";
import { useProductLookupWithCache } from "@/src/hooks/useProductLookupWithCache";

const DEMO_STORE = {
  id: "carrefour-los-fresnos",
  name: "Carrefour Los Fresnos",
  address: "Centro Comercial Los Fresnos, 33206 Gijón",
  radiusMeters: 3000,
  latitude: 43.53263,
  longitude: -5.661265,
};

const MAX_MESSAGE_LENGTH = 280;
const MESSAGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_CHAT_IMAGE_SIZE_PX = 512;

function distanceToStoreMeters(latitude, longitude) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(DEMO_STORE.latitude - latitude);
  const deltaLongitude = toRadians(DEMO_STORE.longitude - longitude);
  const latitude1 = toRadians(latitude);
  const latitude2 = toRadians(DEMO_STORE.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(timestamp, language = "es") {
  if (!timestamp) return "";

  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function formatRemainingTime(item, now, language = "es") {
  const createdAt = Number(item.createdAt || item._creationTime);
  const expiresAt = Number(item.expiresAt) || createdAt + MESSAGE_LIFETIME_MS;

  if (!Number.isFinite(expiresAt)) return "";

  const remainingMs = Math.max(0, expiresAt - now);
  const totalMinutes = Math.ceil(remainingMs / 60000);

  if (totalMinutes <= 0) {
    return language === "en" ? "deleting soon" : "se borrará pronto";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const remaining = hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;

  return language === "en"
    ? `deletes in ${remaining}`
    : `se borra en ${remaining}`;
}

function formatImageInfo(image, sizeKey = "size") {
  const width = Math.round(Number(image?.width) || 0);
  const height = Math.round(Number(image?.height) || 0);
  const bytes = Number(image?.[sizeKey] ?? image?.fileSize) || 0;
  const dimensions = width > 0 && height > 0 ? `${width} × ${height} px` : "";
  const kilobytes = bytes > 0 ? `${(bytes / 1000).toFixed(1)} KB` : "";
  return [dimensions, kilobytes].filter(Boolean).join(" · ");
}

function formatPreparedImageInfo(image) {
  const original = formatImageInfo({
    width: image?.originalWidth,
    height: image?.originalHeight,
    size: image?.originalFileSize,
  });
  const processed = formatImageInfo(image, "fileSize");
  if (original && original !== processed)
    return `Original: ${original}\nEnvío: ${processed}`;
  return processed;
}

function MessageBubble({ item, mine, now, onImagePress, onDelete, deleting }) {
  const { language } = useI18n();
  return (
    <View
      style={[
        styles.messageRow,
        mine ? styles.messageRowMine : styles.messageRowOther,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          mine ? styles.messageBubbleMine : styles.messageBubbleOther,
        ]}
      >
        <View style={styles.messageHeader}>
          <Text style={styles.alias} numberOfLines={1}>
            {item.username || "Usuario"}
          </Text>
          {item.canDelete ? (
            <Pressable
              onPress={() => onDelete?.(item)}
              disabled={deleting}
              hitSlop={8}
              style={({ pressed }) => [
                styles.deleteMessageButton,
                pressed && styles.deleteMessageButtonPressed,
                deleting && styles.deleteMessageButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                language === "en" ? "Delete message" : "Borrar mensaje"
              }
            >
              <Ionicons name="trash-outline" size={17} color="#EF4444" />
            </Pressable>
          ) : null}
        </View>

        {Array.isArray(item.images) && item.images.length > 0 ? (
          <View style={styles.messageImages}>
            {item.images.map((image, index) => (
              <View
                key={`${image.uri}-${index}`}
                style={styles.messageImageCard}
              >
                <Pressable
                  onPress={() => onImagePress?.(image)}
                  style={({ pressed }) => [
                    styles.messageImageButton,
                    pressed && styles.messageImagePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    language === "en"
                      ? "View image full screen"
                      : "Ver imagen a pantalla completa"
                  }
                >
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                </Pressable>
                {formatImageInfo(image) ? (
                  <Text style={styles.messageImageInfo}>
                    {formatImageInfo(image)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}

        {item.product ? (
          <View style={styles.productCard}>
            <View style={styles.productIcon}>
              <Ionicons name="basket-outline" size={22} color="#1D4ED8" />
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.product.name}</Text>
              {item.product.brand ? (
                <Text style={styles.productMeta}>{item.product.brand}</Text>
              ) : null}
              <Text style={styles.productBarcode}>{item.product.barcode}</Text>
            </View>
            <Text style={styles.productPrice}>
              {Number(item.product.price).toFixed(2).replace(".", ",")} €
            </Text>
          </View>
        ) : null}

        <Text style={styles.messageTime}>
          {mine ? (language === "en" ? "You · " : "Tú · ") : ""}
          {formatTime(item.createdAt || item._creationTime, language)}
          {" · "}
          {formatRemainingTime(item, now, language)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatPrototypeScreen() {
  const listRef = useRef(null);
  const { language } = useI18n();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationState, setLocationState] = useState("checking");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [productDraft, setProductDraft] = useState(null);
  const [productPrice, setProductPrice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [expandedImage, setExpandedImage] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const { lookupWithCache, loading: productLoading } =
    useProductLookupWithCache();

  const checkLocation = useCallback(async () => {
    setLocationState("checking");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocation(null);
        setLocationState("denied");
        return null;
      }
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLocation = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      const nearby =
        distanceToStoreMeters(nextLocation.latitude, nextLocation.longitude) <=
        DEMO_STORE.radiusMeters;
      setLocation(nextLocation);
      setLocationState(nearby ? "ready" : "outside");
      return nearby ? nextLocation : null;
    } catch (error) {
      console.error("[ChatPrototypeScreen] location failed", error);
      setLocation(null);
      setLocationState("error");
      return null;
    }
  }, []);

  useEffect(() => {
    checkLocation();
  }, [checkLocation]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentUser = useQuery(api.users.current);
  const messages = useQuery(
    api.chat.listMessages,
    location && locationState === "ready"
      ? {
          room: DEMO_STORE.id,
          latitude: location.latitude,
          longitude: location.longitude,
        }
      : "skip",
  );
  const sendMessage = useMutation(api.chat.sendMessage);
  const deleteMessage = useMutation(api.chat.deleteMessage);
  const generateImageUploadUrl = useMutation(api.chat.generateImageUploadUrl);

  const handleProductDetected = useCallback(
    async (barcode) => {
      setScannerVisible(false);
      try {
        const result = await lookupWithCache(barcode);
        const product = result?.product || {};
        setProductDraft({
          barcode,
          name:
            String(product.name || "").trim() ||
            (language === "en" ? `Product ${barcode}` : `Producto ${barcode}`),
          brand: String(product.brand || "").trim(),
        });
        setProductPrice("");
      } catch (error) {
        console.error("[ChatPrototypeScreen] product lookup failed", error);
        setProductDraft({
          barcode,
          name:
            language === "en" ? `Product ${barcode}` : `Producto ${barcode}`,
          brand: "",
        });
        setProductPrice("");
      }
    },
    [language, lookupWithCache],
  );

  const currentUserId = currentUser?._id ? String(currentUser._id) : null;

  const handleDeleteMessage = useCallback(
    (item) => {
      if (!item?._id || !item.canDelete || deletingMessageId) return;

      const performDelete = async () => {
        setDeletingMessageId(String(item._id));
        try {
          await deleteMessage({ messageId: item._id });
        } catch (error) {
          console.error("[ChatPrototypeScreen] deleteMessage failed", error);
          safeAlert(
            tr("No se pudo borrar"),
            tr(error?.message || "No se pudo borrar el mensaje."),
          );
        } finally {
          setDeletingMessageId(null);
        }
      };

      const title = language === "en" ? "Delete message?" : "¿Borrar mensaje?";
      const description =
        language === "en"
          ? "This action cannot be undone."
          : "Esta acción no se puede deshacer.";

      safeAlert(title, description, [
        { text: language === "en" ? "Cancel" : "Cancelar", style: "cancel" },
        {
          text: language === "en" ? "Delete" : "Borrar",
          style: "destructive",
          onPress: performDelete,
        },
      ]);
    },
    [deleteMessage, deletingMessageId, language],
  );

  const handleOpenImage = useCallback((image) => {
    if (!image?.uri) return;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.activeElement?.blur?.();
    }
    setExpandedImage(image);
  }, []);

  const displayAlias = useMemo(() => {
    return (
      currentUser?.profile?.alias ||
      currentUser?.name ||
      currentUser?.email ||
      "Usuario"
    );
  }, [currentUser]);

  const canSend =
    text.trim().length > 0 &&
    !sending &&
    currentUser !== null &&
    locationState === "ready";

  const handleSend = useCallback(async () => {
    const cleanText = text.trim();

    if (!cleanText || sending) return;

    if (!currentUser) {
      safeAlert(
        tr("Usuario no autenticado"),
        tr("Debes iniciar sesión para participar en el chat de la tienda."),
      );
      return;
    }

    if (cleanText.length > MAX_MESSAGE_LENGTH) {
      safeAlert(
        tr("Mensaje demasiado largo"),
        language === "en"
          ? `The message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`
          : `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`,
      );
      return;
    }

    setSending(true);

    try {
      const currentLocation = await checkLocation();
      if (!currentLocation) {
        throw new Error("No se pudo comprobar que estás cerca de la tienda.");
      }
      await sendMessage({
        room: DEMO_STORE.id,
        username: displayAlias,
        text: cleanText,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });

      setText("");

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (error) {
      console.error("[ChatPrototypeScreen] sendMessage failed", error);
      safeAlert(
        tr("No se pudo enviar"),
        tr(error?.message || "No se pudo enviar el mensaje."),
      );
    } finally {
      setSending(false);
    }
  }, [
    checkLocation,
    currentUser,
    displayAlias,
    language,
    sendMessage,
    sending,
    text,
  ]);

  const renderItem = useCallback(
    ({ item }) => {
      const mineById =
        Boolean(currentUserId) && String(item.userId || "") === currentUserId;
      const mineByAlias =
        String(item.username || "")
          .trim()
          .toLowerCase() ===
        String(displayAlias || "")
          .trim()
          .toLowerCase();
      const mine = mineById || mineByAlias;

      return (
        <MessageBubble
          item={item}
          mine={mine}
          now={now}
          onImagePress={handleOpenImage}
          onDelete={handleDeleteMessage}
          deleting={deletingMessageId === String(item._id)}
        />
      );
    },
    [
      currentUserId,
      deletingMessageId,
      displayAlias,
      handleDeleteMessage,
      handleOpenImage,
      now,
    ],
  );

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const processedImages = [];

      for (const asset of result.assets) {
        const width = Number(asset.width) || 0;
        const height = Number(asset.height) || 0;
        const maxSide = Math.max(width, height);
        let originalFileSize = Number(asset.fileSize) || 0;

        if (!originalFileSize) {
          try {
            const originalResponse = await fetch(asset.uri);
            originalFileSize = (await originalResponse.blob()).size;
          } catch {
            originalFileSize = 0;
          }
        }

        const actions =
          maxSide > MAX_CHAT_IMAGE_SIZE_PX
            ? [
                {
                  resize:
                    width >= height
                      ? { width: MAX_CHAT_IMAGE_SIZE_PX }
                      : { height: MAX_CHAT_IMAGE_SIZE_PX },
                },
              ]
            : [];

        const processed = await ImageManipulator.manipulateAsync(
          asset.uri,
          actions,
          {
            compress: 0.82,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );

        let fileSize = null;
        try {
          const response = await fetch(processed.uri);
          const blob = await response.blob();
          fileSize = blob.size;
        } catch (sizeError) {
          console.warn(
            "[ChatPrototypeScreen] image size unavailable",
            sizeError,
          );
        }

        processedImages.push({
          uri: processed.uri,
          width: processed.width,
          height: processed.height,
          fileName: "imagen.jpeg",
          mimeType: "image/jpeg",
          fileSize,
          originalWidth: width,
          originalHeight: height,
          originalFileSize,
        });
      }

      setSelectedImages((current) => [...current, ...processedImages]);
    } catch (error) {
      console.error("[ChatPrototypeScreen] image picker failed", error);
      safeAlert(
        tr("No se pudo preparar la imagen"),
        tr(
          error?.message ||
            "No se pudo seleccionar, reducir o convertir la imagen a JPEG.",
        ),
      );
    }
  }, []);

  const removeSelectedImage = useCallback((indexToRemove) => {
    setSelectedImages((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  }, []);

  const handleSendComposer = useCallback(async () => {
    const cleanText = text.trim();

    if ((cleanText.length === 0 && selectedImages.length === 0) || sending) {
      return;
    }

    if (!currentUser) {
      safeAlert(
        tr("Usuario no autenticado"),
        tr("Debes iniciar sesión para participar en el chat de la tienda."),
      );
      return;
    }

    if (cleanText.length > MAX_MESSAGE_LENGTH) {
      safeAlert(
        tr("Mensaje demasiado largo"),
        language === "en"
          ? `The message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`
          : `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`,
      );
      return;
    }

    setSending(true);

    try {
      const currentLocation = await checkLocation();
      if (!currentLocation) {
        throw new Error("No se pudo comprobar que estás cerca de la tienda.");
      }

      const uploadedImages = [];

      for (const image of selectedImages) {
        const uploadUrl = await generateImageUploadUrl();
        const imageResponse = await fetch(image.uri);
        const blob = await imageResponse.blob();

        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "image/jpeg",
          },
          body: blob,
        });

        if (!uploadResponse.ok) {
          throw new Error("No se pudo subir una de las imágenes.");
        }

        const { storageId } = await uploadResponse.json();

        uploadedImages.push({
          storageId,
          mimeType: "image/jpeg",
          width: Number(image.width) || 0,
          height: Number(image.height) || 0,
          size: Number(image.fileSize) || blob.size || 0,
        });
      }

      await sendMessage({
        room: DEMO_STORE.id,
        username: displayAlias,
        text: cleanText,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });

      setSelectedImages([]);
      setText("");

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (error) {
      console.error("[ChatPrototypeScreen] send composer failed", error);
      safeAlert(
        tr("No se pudo enviar"),
        tr(error?.message || "No se pudo enviar el mensaje."),
      );
    } finally {
      setSending(false);
    }
  }, [
    checkLocation,
    currentUser,
    displayAlias,
    generateImageUploadUrl,
    language,
    selectedImages,
    sendMessage,
    sending,
    text,
  ]);

  const handleShareProduct = useCallback(async () => {
    if (!productDraft || sending) return;
    const price = Number(String(productPrice).replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      safeAlert(
        tr("Precio no válido"),
        tr("Introduce el precio pagado por el producto."),
      );
      return;
    }
    setSending(true);
    try {
      const currentLocation = await checkLocation();
      if (!currentLocation)
        throw new Error("No se pudo comprobar que estás cerca de la tienda.");
      await sendMessage({
        room: DEMO_STORE.id,
        username: displayAlias,
        text: "Producto comprado",
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        product: {
          barcode: productDraft.barcode,
          name: productDraft.name,
          brand: productDraft.brand || undefined,
          price,
          currency: "EUR",
        },
      });
      setProductDraft(null);
      setProductPrice("");
    } catch (error) {
      safeAlert(
        tr("No se pudo compartir"),
        tr(error?.message || "No se pudo publicar el producto."),
      );
    } finally {
      setSending(false);
    }
  }, [
    checkLocation,
    displayAlias,
    productDraft,
    productPrice,
    sendMessage,
    sending,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.header}>
          <View style={styles.placeIcon}>
            <Ionicons name="storefront" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>{DEMO_STORE.name}</Text>
            <Text style={styles.subtitle}>
              {language === "en"
                ? `nearby chat · ${DEMO_STORE.radiusMeters} m radius`
                : `chat cercano · radio de ${DEMO_STORE.radiusMeters} m`}
            </Text>
          </View>

          <Ionicons name="location-outline" size={23} color="#FFFFFF" />
        </View>

        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={Array.isArray(messages) ? messages : []}
          extraData={now}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd?.({ animated: false })
          }
          ListHeaderComponent={
            <View style={styles.notice}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#5F7890"
              />
              <Text style={styles.noticeText}>
                {locationState === "checking"
                  ? "Comprobando si estás cerca de la tienda…"
                  : locationState === "denied"
                    ? "Activa el permiso de ubicación para acceder a este chat."
                    : locationState === "error"
                      ? "No se pudo obtener tu ubicación. Pulsa para intentarlo de nuevo."
                      : locationState === "outside"
                        ? language === "en"
                          ? `You are outside the ${DEMO_STORE.radiusMeters}-metre radius of Carrefour Los Fresnos.`
                          : `Estás fuera del radio de ${DEMO_STORE.radiusMeters} metros de Carrefour Los Fresnos.`
                        : "El chat solo está disponible para personas situadas cerca de Carrefour Los Fresnos."}
              </Text>
              {locationState !== "ready" && locationState !== "checking" ? (
                <Pressable onPress={checkLocation} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            messages === undefined ? (
              <Text style={styles.emptyText}>Cargando mensajes…</Text>
            ) : (
              <Text style={styles.emptyText}>
                Todavía no hay mensajes en esta tienda.
              </Text>
            )
          }
        />

        {productDraft ? (
          <View style={styles.productComposer}>
            <View style={styles.productComposerHeader}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{productDraft.name}</Text>
                <Text style={styles.productBarcode}>
                  {productDraft.barcode}
                </Text>
              </View>
              <Pressable onPress={() => setProductDraft(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                value={productPrice}
                onChangeText={setProductPrice}
                placeholder="Precio pagado"
                keyboardType="decimal-pad"
              />
              <Text style={styles.euroLabel}>€</Text>
              <Pressable
                style={styles.shareProductButton}
                onPress={handleShareProduct}
              >
                <Text style={styles.shareProductText}>Compartir</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.composerShell}>
          {selectedImages.length > 0 ? (
            <FlatList
              horizontal
              data={selectedImages}
              keyExtractor={(item, index) => `${item.uri}-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedImagesList}
              renderItem={({ item, index }) => (
                <View style={styles.selectedImageItem}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.selectedImagePreview}
                    resizeMode="cover"
                  />
                  {formatPreparedImageInfo(item) ? (
                    <Text style={styles.selectedImageInfo}>
                      {formatPreparedImageInfo(item)}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => removeSelectedImage(index)}
                    style={styles.selectedImageRemove}
                    accessibilityRole="button"
                    accessibilityLabel={tr("Quitar imagen")}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
            />
          ) : null}

          <View style={styles.composer}>
            <Pressable
              onPress={handlePickImage}
              style={styles.mediaButton}
              accessibilityRole="button"
              accessibilityLabel={tr("Añadir imagen")}
            >
              <Ionicons name="image-outline" size={24} color="#168AC0" />
            </Pressable>

            <View style={styles.messageInputShell}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={
                  selectedImages.length > 0 ? "Añade un comentario…" : "Mensaje"
                }
                placeholderTextColor="#8A959E"
                multiline={false}
                maxLength={MAX_MESSAGE_LENGTH}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={handleSendComposer}
                accessibilityLabel={tr("Mensaje para el chat de la tienda")}
              />
            </View>

            <Pressable
              onPress={handleSendComposer}
              disabled={
                (text.trim().length === 0 && selectedImages.length === 0) ||
                (text.trim().length > 0 &&
                  selectedImages.length === 0 &&
                  !canSend)
              }
              style={({ pressed }) => [
                styles.sendAction,
                text.trim().length === 0 &&
                  selectedImages.length === 0 &&
                  styles.sendActionDisabled,
                text.trim().length > 0 &&
                  selectedImages.length === 0 &&
                  !canSend &&
                  styles.sendActionDisabled,
                pressed && styles.sendButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={tr("Enviar mensaje")}
            >
              <Ionicons name="send" size={22} color="#168AC0" />
            </Pressable>
          </View>
        </View>

        <Modal
          visible={attachmentMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAttachmentMenuVisible(false)}
        >
          <Pressable
            style={styles.attachmentOverlay}
            onPress={() => setAttachmentMenuVisible(false)}
          >
            <Pressable style={styles.attachmentSheet} onPress={() => {}}>
              <Pressable
                style={styles.attachmentAction}
                disabled={locationState !== "ready" || productLoading}
                onPress={() => {
                  setAttachmentMenuVisible(false);
                  setScannerVisible(true);
                }}
              >
                <View
                  style={[styles.attachmentCircle, styles.attachmentCircleBlue]}
                >
                  <Ionicons name="barcode-outline" size={27} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Producto</Text>
              </Pressable>

              <Pressable
                style={styles.attachmentAction}
                onPress={() => {
                  setAttachmentMenuVisible(false);
                  handlePickImage();
                }}
              >
                <View
                  style={[
                    styles.attachmentCircle,
                    styles.attachmentCircleGreen,
                  ]}
                >
                  <Ionicons name="images-outline" size={27} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Imagen</Text>
              </Pressable>

              <Pressable
                style={styles.attachmentAction}
                onPress={() => setAttachmentMenuVisible(false)}
              >
                <View
                  style={[
                    styles.attachmentCircle,
                    styles.attachmentCircleSlate,
                  ]}
                >
                  <Ionicons name="location-outline" size={27} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Ubicación</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>

      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <QuickEan13Scanner
          onDetected={handleProductDetected}
          onCancel={() => setScannerVisible(false)}
        />
      </Modal>

      <Modal
        visible={Boolean(expandedImage)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setExpandedImage(null)}
      >
        <Pressable
          style={styles.fullscreenImageBackdrop}
          onPress={() => setExpandedImage(null)}
          accessibilityRole="button"
          accessibilityLabel={
            language === "en"
              ? "Close full-screen image"
              : "Cerrar imagen a pantalla completa"
          }
        >
          {expandedImage ? (
            <Image
              source={{ uri: expandedImage.uri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.fullscreenImageClose} pointerEvents="none">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </View>
          {formatImageInfo(expandedImage) ? (
            <View style={styles.fullscreenImageInfo} pointerEvents="none">
              <Text style={styles.fullscreenImageInfoText}>
                {formatImageInfo(expandedImage)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#2AABEE",
  },
  container: {
    flex: 1,
    backgroundColor: "#DCE8F1",
  },
  retryButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E7F3FA",
  },
  retryButtonText: {
    color: "#168AC0",
    fontWeight: "700",
  },
  productCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#C8DAE8",
  },
  productIcon: { marginRight: 9 },
  productInfo: { flex: 1 },
  productName: { fontWeight: "700", color: "#111827" },
  productMeta: { marginTop: 2, color: "#4B5563", fontSize: 12 },
  productBarcode: { marginTop: 2, color: "#6B7280", fontSize: 11 },
  productPrice: {
    marginLeft: 10,
    color: "#168AC0",
    fontSize: 17,
    fontWeight: "800",
  },
  productComposer: {
    padding: 12,
    backgroundColor: "#EDF6FB",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C8DAE8",
  },
  productComposerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  priceRow: { flexDirection: "row", alignItems: "center" },
  priceInput: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  euroLabel: { marginHorizontal: 8, fontSize: 18, fontWeight: "700" },
  shareProductButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: "#2AABEE",
  },
  shareProductText: { color: "#FFFFFF", fontWeight: "700" },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#2AABEE",
  },
  placeIcon: {
    width: 42,
    height: 42,
    marginRight: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 21,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 3,
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 16,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 16,
  },
  noticeText: {
    flex: 1,
    color: "#50687C",
    fontSize: 11,
    lineHeight: 16,
  },
  emptyText: {
    marginTop: 26,
    color: "#667085",
    fontSize: 13,
    textAlign: "center",
  },
  messageRow: {
    marginBottom: 7,
    paddingHorizontal: 2,
  },
  messageRowMine: {
    alignItems: "flex-end",
  },
  messageRowOther: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "86%",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 14,
  },
  messageBubbleMine: {
    backgroundColor: "#D9FDD3",
    borderBottomRightRadius: 5,
  },
  messageBubbleOther: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 5,
  },
  alias: {
    flex: 1,
    minWidth: 0,
    marginBottom: 3,
    color: "#168AC0",
    fontSize: 12,
    fontWeight: "800",
  },
  messageText: {
    color: "#172033",
    fontSize: 15,
    lineHeight: 20,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  deleteMessageButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  deleteMessageButtonPressed: { backgroundColor: "rgba(239,68,68,0.10)" },
  deleteMessageButtonDisabled: { opacity: 0.45 },
  messageTime: {
    marginTop: 5,
    alignSelf: "flex-end",
    color: "#6E8798",
    fontSize: 10,
  },
  messageImages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  messageImageCard: { width: 118 },
  messageImage: {
    width: 118,
    height: 118,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  messageImageButton: {
    width: 118,
    height: 118,
    borderRadius: 10,
    overflow: "hidden",
  },
  messageImagePressed: { opacity: 0.78 },
  messageImageInfo: {
    marginTop: 3,
    color: "#6E8798",
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
  },
  fullscreenImageBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenImageClose: {
    position: "absolute",
    top: Platform.OS === "web" ? 18 : 48,
    right: 18,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "rgba(15,23,42,0.72)",
  },
  fullscreenImageInfo: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 20 : 42,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(15,23,42,0.78)",
  },
  fullscreenImageInfoText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  selectedImagesList: {
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: "transparent",
  },
  selectedImageItem: {
    position: "relative",
    width: 190,
    minHeight: 94,
    alignItems: "center",
  },
  selectedImagePreview: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  selectedImageRemove: {
    position: "absolute",
    top: -5,
    right: 58,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(51,65,85,0.92)",
  },
  selectedImageInfo: {
    marginTop: 3,
    color: "#536779",
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
  },
  composerShell: {
    backgroundColor: "rgba(220,232,241,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.35)",
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "transparent",
  },
  mediaButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },

  messageInputShell: {
    flex: 1,
    height: 30,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.55)",
    borderRadius: 16,
  },
  inlineAction: {
    width: 38,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    height: 28,
    paddingHorizontal: 13,
    paddingVertical: 0,
    color: "#17202A",
    backgroundColor: "transparent",
    fontSize: 15,
    lineHeight: 18,
    textAlignVertical: "center",
  },
  sendAction: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderRadius: 17,
  },
  sendActionDisabled: {
    opacity: 0.35,
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  sendButtonPressed: {
    opacity: 0.72,
  },
  attachmentOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.16)",
  },
  attachmentSheet: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 30,
    backgroundColor: "#F5F2EC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  attachmentAction: {
    minWidth: 76,
    alignItems: "center",
  },
  attachmentCircle: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
  },
  attachmentCircleBlue: { backgroundColor: "#2AABEE" },
  attachmentCircleGreen: { backgroundColor: "#35B886" },
  attachmentCircleSlate: { backgroundColor: "#64748B" },
  attachmentLabel: {
    marginTop: 7,
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
});
