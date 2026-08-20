// src/screens/ChatScreen.js
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  I18nText as Text,
  I18nTextInput as TextInput,
  useI18n,
} from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import YouTubePlaylistPlayer from "@/src/components/chat/YouTubePlaylistPlayer";
import {
  extractUrlsFromText,
  parseYouTubeUrl,
} from "@/src/services/urlSafety";

const ROOMS = [
  { id: "compras", label: "Compras", icon: "cart-outline" },
  { id: "musica", label: "Música", icon: "musical-notes-outline" },
  { id: "humor", label: "Humor", icon: "happy-outline" },
  { id: "informatica", label: "Informática", icon: "laptop-outline" },
  { id: "noticias", label: "Noticias", icon: "newspaper-outline" },
  { id: "youtube", label: "YouTube", icon: "logo-youtube" },
];
const MAX_MESSAGE_LENGTH = 280;
const MAX_YOUTUBE_MESSAGE_LENGTH = 2048;
const MAX_IMAGES = 8;
const CHAT_CLIENT_ID_KEY = "shopp-chat-client-id";

function createChatClientId() {
  if (typeof globalThis?.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateChatClientId() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const saved = window.localStorage?.getItem(CHAT_CLIENT_ID_KEY);
      if (saved?.trim()) return saved.trim();
      const next = createChatClientId();
      window.localStorage?.setItem(CHAT_CLIENT_ID_KEY, next);
      return next;
    } catch {}
  }
  return createChatClientId();
}
function createDefaultAlias() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const saved = window.localStorage?.getItem("shopp-chat-alias");
    if (saved?.trim()) return saved.trim();
    const ua = window.navigator?.userAgent || "";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return "Android";
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
    if (/Chrome/i.test(ua)) return "Chrome";
  }
  return Platform.OS === "ios"
    ? "iPhone"
    : Platform.OS === "android"
      ? "Android"
      : "anonymous";
}

function saveAlias(alias) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.localStorage?.setItem("shopp-chat-alias", alias);
  } catch {}
}

function formatTime(timestamp, language = "es") {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString(
      language === "en" ? "en-GB" : "es-ES",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  } catch {
    return "";
  }
}

function Message({ item, language, onDelete, onImagePress, deleting }) {
  const mine = item.isOwnMessage === true;
  const deletedForUsers = item.isDeletedByUser === true;
  const timestamp = item.createdAt || item._creationTime;
  const content = {
    text: item.text || "",
    images: Array.isArray(item.images)
      ? item.images.map((image) => image?.uri).filter(Boolean)
      : [],
  };
  const youtubeMedia = useMemo(() => {
    const youtubeUrl = extractUrlsFromText(content.text).find(
      (url) => parseYouTubeUrl(url).isValid,
    );

    if (!youtubeUrl) return null;
    return { sourceUrl: youtubeUrl, ...parseYouTubeUrl(youtubeUrl) };
  }, [content.text]);
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <View
        style={[
          styles.bubble,
          mine && styles.bubbleMine,
          deletedForUsers && styles.bubbleDeletedAdmin,
        ]}
      >
        <View style={styles.messageHeader}>
          <Text style={styles.username} numberOfLines={1}>
            {item.username || "anonymous"}
          </Text>

          <View style={styles.messageHeaderActions}>
            <Text style={styles.time}>{formatTime(timestamp, language)}</Text>

            {item.canDelete === true ? (
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
                  language === "en" ? "Delete post" : "Borrar publicación"
                }
              >
                <Ionicons name="trash-outline" size={15} color="#dc2626" />
              </Pressable>
            ) : null}
          </View>
        </View>
        {deletedForUsers ? (
          <View style={styles.deletedAdminNotice}>
            <Ionicons name="eye-outline" size={13} color="#92400e" />
            <Text style={styles.deletedAdminNoticeText}>
              {language === "en"
                ? "Deleted by the author · visible only to administrators"
                : "Borrado por el autor · visible solo para administradores"}
            </Text>
          </View>
        ) : null}
        {content.images.length ? (
          <View style={styles.messageImagesPanel}>
            {content.images.map((uri, index) => (
              <Pressable
                key={`${item._id || item.id}-image-${index}`}
                onPress={() => onImagePress?.(uri)}
                style={
                  content.images.length === 1
                    ? styles.messageImageSingle
                    : styles.messageImage
                }
                accessibilityRole="button"
                accessibilityLabel={
                  language === "en" ? "Enlarge image" : "Ampliar imagen"
                }
              >
                <Image
                  source={{ uri }}
                  style={styles.messageImageFill}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        ) : null}
        {content.text ? (
          <Text
            style={[
              styles.messageText,
              content.images.length > 0 && styles.messageTextAfterImage,
            ]}
          >
            {content.text}
          </Text>
        ) : null}
        {youtubeMedia ? (
          <YouTubePlaylistPlayer
            playlistId={youtubeMedia.playlistId}
            videoId={youtubeMedia.videoId}
            sourceUrl={youtubeMedia.playableUrl || youtubeMedia.sourceUrl}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const listRef = useRef(null);
  const { language } = useI18n();
  const [room, setRoom] = useState("compras");
  const [chatClientId] = useState(getOrCreateChatClientId);
  const [alias, setAlias] = useState(createDefaultAlias);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [expandedImageUri, setExpandedImageUri] = useState(null);

  const messages = useQuery(api.chat.listMessages, { room, clientId: chatClientId });
  const sendMessage = useMutation(api.chat.sendMessage);
  const deleteMessage = useMutation(api.chat.deleteMessage);
  const generateImageUploadUrl = useMutation(api.chat.generateImageUploadUrl);

  const visibleMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    return [...messages].sort(
      (a, b) =>
        (a.createdAt || a._creationTime || 0) -
        (b.createdAt || b._creationTime || 0),
    );
  }, [messages]);

  const cleanAlias = alias.trim() || "anonymous";
  const cleanInput = input.trim();
  const messageLengthLimit =
    room === "youtube" ? MAX_YOUTUBE_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH;
  const canSend =
    Boolean(cleanInput || selectedImages.length) &&
    cleanInput.length <= messageLengthLimit &&
    !sending;

  const handleAliasChange = useCallback((value) => {
    const next = value.slice(0, 40);
    setAlias(next);
    saveAlias(next);
  }, []);

  const handlePickImages = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;

      const resizedImages = await Promise.all(
        result.assets.slice(0, MAX_IMAGES).map(async (asset) => {
          if (!asset.uri) return null;
          const resize =
            asset.width > asset.height ? { width: 256 } : { height: 256 };
          const actions =
            Math.max(asset.width || 0, asset.height || 0) > 256
              ? [{ resize }]
              : [];
          const resized = await ImageManipulator.manipulateAsync(
            asset.uri,
            actions,
            {
              compress: 0.72,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            },
          );
          if (!resized.uri) return null;

          const base64Length = resized.base64?.length || 0;
          const approximateSize = base64Length
            ? Math.ceil((base64Length * 3) / 4)
            : 0;

          return {
            uri: resized.uri,
            width: resized.width || 256,
            height: resized.height || 256,
            mimeType: "image/jpeg",
            size: approximateSize,
          };
        }),
      );

      setSelectedImages((current) =>
        [...current, ...resizedImages.filter(Boolean)].slice(0, MAX_IMAGES),
      );
    } catch (error) {
      console.error("[Chat] No se pudieron seleccionar las imágenes:", error);
    }
  }, []);

  const handleRemoveImage = useCallback((indexToRemove) => {
    setSelectedImages((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  }, []);

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    setSending(true);

    try {
      const uploadedImages = [];

      for (const image of selectedImages) {
        const uploadUrl = await generateImageUploadUrl();

        const imageResponse = await fetch(image.uri);
        const blob = await imageResponse.blob();

        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": image.mimeType || "image/jpeg",
          },
          body: blob,
        });

        if (!uploadResponse.ok) {
          throw new Error(`No se pudo subir una imagen (${uploadResponse.status}).`);
        }

        const { storageId } = await uploadResponse.json();

        uploadedImages.push({
          storageId,
          mimeType: image.mimeType || "image/jpeg",
          width: image.width || 256,
          height: image.height || 256,
          size: image.size || blob.size || 0,
        });
      }

      await sendMessage({
        room,
        username: cleanAlias,
        text: cleanInput,
        clientId: chatClientId,
        images: uploadedImages.length ? uploadedImages : undefined,
      });

      setInput("");
      setSelectedImages([]);

      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() =>
          listRef.current?.scrollToEnd?.({ animated: true }),
        );
      }
    } catch (error) {
      console.error("[Chat] No se pudo enviar el mensaje:", error);
    } finally {
      setSending(false);
    }
  }, [
    canSend,
    cleanAlias,
    cleanInput,
    room,
    chatClientId,
    selectedImages,
    sendMessage,
    generateImageUploadUrl,
  ]);


  const deletePost = useCallback(
    async (item) => {
      const messageId = item?._id;
      if (!messageId || deletingMessageId) return;

      setDeletingMessageId(messageId);

      try {
        await deleteMessage({ messageId, clientId: chatClientId });
      } catch (error) {
        console.error("[Chat] No se pudo borrar el post:", error);

        const message =
          error?.message ||
          (language === "en"
            ? "The post could not be deleted."
            : "No se pudo borrar la publicación.");

        safeAlert(
          language === "en" ? "Error" : "Error",
          message,
        );
      } finally {
        setDeletingMessageId(null);
      }
    },
    [deleteMessage, deletingMessageId, language, chatClientId],
  );

  const handleDeletePost = useCallback(
    (item) => {
      if (!item?._id || deletingMessageId) return;

      const title = language === "en" ? "Delete post" : "Borrar publicación";
      const message =
        item.isDeletedByUser
          ? language === "en"
            ? "Permanently delete this post and its images? This action cannot be undone."
            : "¿Quieres eliminar definitivamente esta publicación y sus imágenes? Esta acción no se puede deshacer."
          : language === "en"
            ? "Delete this post? Authors hide their own posts; administrators delete them permanently."
            : "¿Quieres borrar esta publicación? Los autores ocultan sus propios posts; los administradores los eliminan definitivamente.";

      safeAlert(title, message, [
        {
          key: "cancel",
          text: language === "en" ? "Cancel" : "Cancelar",
          style: "cancel",
        },
        {
          key: "delete",
          text: language === "en" ? "Delete" : "Borrar",
          style: "destructive",
          onPress: () => void deletePost(item),
        },
      ]);
    },
    [deletePost, deletingMessageId, language],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.iconBox}>
              <Ionicons name="chatbubbles-outline" size={21} color="#2563eb" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Chat de compras</Text>
              <Text style={styles.subtitle}>
                {language === "en"
                  ? `Open room · #${room}`
                  : `Sala abierta · #${room}`}
              </Text>
            </View>
          </View>
          <View style={styles.aliasRow}>
            <Text style={styles.aliasLabel}>Alias</Text>
            <TextInput
              value={alias}
              onChangeText={handleAliasChange}
              placeholder="Tu alias"
              placeholderTextColor="#9ca3af"
              style={styles.aliasInput}
              maxLength={40}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.roomsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roomsContent}
          >
            {ROOMS.map((item) => {
              const active = room === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setRoom(item.id)}
                  style={[styles.roomButton, active && styles.roomButtonActive]}
                >
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={active ? "#ffffff" : "#475569"}
                  />
                  <Text
                    style={[styles.roomText, active && styles.roomTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => String(item._id || item.id)}
          renderItem={({ item }) => (
            <Message
              item={item}
              myAlias={cleanAlias}
              language={language}
              onDelete={handleDeletePost}
              onImagePress={setExpandedImageUri}
              deleting={deletingMessageId === item._id}
            />
          )}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            visibleMessages.length === 0 && styles.listEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd?.({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={room === "youtube" ? "logo-youtube" : "chatbubble-ellipses-outline"}
                size={34}
                color={room === "youtube" ? "#dc2626" : "#94a3b8"}
              />
              <Text style={styles.emptyTitle}>
                {messages === undefined
                  ? "Conectando con Convex…"
                  : room === "youtube"
                    ? "Comparte el primer vídeo o playlist"
                    : "Todavía no hay mensajes"}
              </Text>
              <Text style={styles.emptyText}>
                {room === "youtube"
                  ? "Pega un enlace de vídeo o playlist de YouTube y pulsa enviar. Podrás reproducirlo dentro del chat; las playlists conservarán su selector de vídeos."
                  : "Abre Shopp en otro dispositivo y usa un alias diferente para probar la conversación en tiempo real."}
              </Text>
            </View>
          }
        />

        {selectedImages.length ? (
          <View style={styles.imagePreviewPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagePreviewContent}
            >
              {selectedImages.map((image, index) => (
                <View
                  key={`selected-image-${index}`}
                  style={styles.imagePreviewItem}
                >
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => handleRemoveImage(index)}
                    style={styles.removeImageButton}
                    accessibilityLabel={`Quitar imagen ${index + 1}`}
                  >
                    <Ionicons name="close" size={16} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Text style={styles.imagesCounter}>
              {selectedImages.length}/{MAX_IMAGES}
            </Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            onPress={handlePickImages}
            disabled={sending || selectedImages.length >= MAX_IMAGES}
            style={styles.imageButton}
            accessibilityLabel="Añadir imágenes"
          >
            <Ionicons name="image-outline" size={23} color="#2563eb" />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={(value) =>
              setInput(value.slice(0, messageLengthLimit))
            }
            placeholder={
              room === "youtube"
                ? "Pega un vídeo o playlist de YouTube…"
                : "Escribe un mensaje…"
            }
            placeholderTextColor="#9ca3af"
            style={styles.messageInput}
            multiline
            maxLength={messageLengthLimit}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
              pressed && canSend && styles.sendButtonPressed,
            ]}
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.counter}>
            {input.length}/{messageLengthLimit}
          </Text>
          <Text style={styles.footerText}>
            Pruebas abiertas · sin login obligatorio
          </Text>
        </View>

        <Modal
          visible={Boolean(expandedImageUri)}
          transparent
          animationType="fade"
          onRequestClose={() => setExpandedImageUri(null)}
        >
          <View style={styles.imageModalBackdrop}>
            <Pressable
              style={styles.imageModalClose}
              onPress={() => setExpandedImageUri(null)}
              accessibilityRole="button"
              accessibilityLabel={language === "en" ? "Close image" : "Cerrar imagen"}
            >
              <Ionicons name="close" size={30} color="#ffffff" />
            </Pressable>
            <Pressable
              style={styles.imageModalContent}
              onPress={() => setExpandedImageUri(null)}
            >
              {expandedImageUri ? (
                <Image
                  source={{ uri: expandedImageUri }}
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
              ) : null}
            </Pressable>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d1d5db",
  },
  titleRow: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    marginRight: 10,
  },
  titleBlock: { flex: 1 },
  title: { fontSize: 19, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 12, color: "#6b7280" },
  aliasRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aliasLabel: { fontSize: 13, fontWeight: "700", color: "#4b5563" },
  aliasInput: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
  },
  roomsBar: {
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d1d5db",
  },
  roomsContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 7 },
  roomButton: {
    height: 32,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  roomButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  roomText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  roomTextActive: { color: "#fff" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 12 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", paddingHorizontal: 28 },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#6b7280",
    textAlign: "center",
  },
  messageRow: { alignItems: "flex-start", marginBottom: 8 },
  messageRowMine: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "86%",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  bubbleMine: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  bubbleDeletedAdmin: {
    opacity: 0.72,
    borderStyle: "dashed",
    borderColor: "#d97706",
    backgroundColor: "#fffbeb",
  },
  deletedAdminNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  deletedAdminNoticeText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  messageHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  deleteMessageButton: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  deleteMessageButtonPressed: {
    backgroundColor: "#fee2e2",
  },
  deleteMessageButtonDisabled: {
    opacity: 0.4,
  },
  username: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
    color: "#2563eb",
  },
  time: { fontSize: 10, color: "#6b7280" },
  messageText: { fontSize: 15, lineHeight: 20, color: "#111827" },
  messageTextAfterImage: { marginTop: 7 },
  messageImagesPanel: {
    width: 220,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  messageImageSingle: {
    width: 220,
    height: 220,
    backgroundColor: "#e5e7eb",
  },
  messageImage: { width: 108, height: 108, backgroundColor: "#e5e7eb" },
  messageImageFill: { width: "100%", height: "100%" },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
  },
  imageModalContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  expandedImage: { width: "100%", height: "100%" },
  imageModalClose: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 18,
    right: 18,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  imagePreviewPanel: {
    minHeight: 88,
    paddingVertical: 8,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d1d5db",
  },
  imagePreviewContent: {
    paddingHorizontal: 10,
    paddingRight: 4,
    gap: 9,
  },
  imagePreviewItem: {
    width: 72,
    height: 72,
  },
  imagePreview: { width: 72, height: 72, backgroundColor: "#e5e7eb" },
  removeImageButton: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  imagesCounter: {
    paddingHorizontal: 10,
    fontSize: 11,
    color: "#6b7280",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 5,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d1d5db",
  },
  imageButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  messageInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    fontSize: 15,
    color: "#111827",
  },
  sendButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  sendButtonDisabled: { backgroundColor: "#9ca3af" },
  sendButtonPressed: { opacity: 0.8 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  counter: { fontSize: 10, color: "#9ca3af" },
  footerText: { fontSize: 10, color: "#9ca3af" },
});
