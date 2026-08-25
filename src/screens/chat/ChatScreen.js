// src/screens/ChatScreen.js
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
import * as DocumentPicker from "expo-document-picker";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import YouTubePlaylistPlayer from "@/src/components/chat/YouTubePlaylistPlayer";
import CustomYouTubePlaylistPlayer from "@/src/components/chat/CustomYouTubePlaylistPlayer";
import WebPreviewCard from "@/src/components/chat/WebPreviewCard";
import { extractUrlsFromText, parseYouTubeUrl } from "@/src/services/urlSafety";

const ROOMS = [
  { id: "compras", label: "Compras", icon: "cart-outline" },
  { id: "musica", label: "Música", icon: "musical-notes-outline" },
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

function getDateKey(timestamp) {
  if (!timestamp) return "unknown";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(timestamp, language = "es") {
  if (!timestamp) return language === "en" ? "Unknown date" : "Fecha desconocida";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return language === "en" ? "Unknown date" : "Fecha desconocida";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const messageDate = new Date(date);
  messageDate.setHours(0, 0, 0, 0);
  const dayDifference = Math.round(
    (today.getTime() - messageDate.getTime()) / 86400000,
  );

  if (dayDifference === 0) return language === "en" ? "Today" : "Hoy";
  if (dayDifference === 1) return language === "en" ? "Yesterday" : "Ayer";

  return date.toLocaleDateString(language === "en" ? "en-GB" : "es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function Message({
  item,
  language,
  onDelete,
  onEditAlbum,
  onEditCustomPlaylist,
  onImagePress,
  deleting,
}) {
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
  const webPreviewUrl = useMemo(() => {
    if (youtubeMedia) return null;
    return extractUrlsFromText(content.text)[0] || null;
  }, [content.text, youtubeMedia]);
  const isYouTubeAlbum =
    youtubeMedia?.playlistId?.startsWith("OLAK5uy_") === true;
  const isYouTubePlaylist = Boolean(youtubeMedia?.playlistId);
  const customPlaylist = item.customYouTubePlaylist;
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <View
        style={[
          styles.bubble,
          mine && styles.bubbleMine,
          (youtubeMedia || customPlaylist) && styles.bubbleYouTube,
          deletedForUsers && styles.bubbleDeletedAdmin,
        ]}
      >
        {!youtubeMedia && !customPlaylist ? (
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
        ) : null}
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
        {content.text && !youtubeMedia && !customPlaylist ? (
          <Text
            style={[
              styles.messageText,
              content.images.length > 0 && styles.messageTextAfterImage,
            ]}
          >
            {content.text}
          </Text>
        ) : null}
        {webPreviewUrl ? <WebPreviewCard url={webPreviewUrl} compact /> : null}
        {customPlaylist ? (
          <CustomYouTubePlaylistPlayer
            playlist={customPlaylist}
            userName={item.username || "anonymous"}
            dateLabel={formatTime(timestamp, language)}
            canDelete={item.canDelete === true}
            canEdit={item.canEditYouTubeAlbum === true}
            deleting={deleting}
            onDelete={() => onDelete?.(item)}
            onEdit={() => onEditCustomPlaylist?.(item)}
          />
        ) : null}
        {youtubeMedia ? (
          <YouTubePlaylistPlayer
            playlistId={youtubeMedia.playlistId}
            videoId={youtubeMedia.videoId}
            sourceUrl={youtubeMedia.playableUrl || youtubeMedia.sourceUrl}
            playlistTitle={item.youtubeAlbum?.title}
            thumbnailUrl={item.youtubeAlbum?.thumbnailUri}
            lyricsUrl={item.youtubeAlbum?.lyricsUri}
            userName={item.username || "anonymous"}
            dateLabel={formatTime(timestamp, language)}
            canDelete={item.canDelete === true}
            deleting={deleting}
            onDelete={() => onDelete?.(item)}
            deleteLabel={
              language === "en" ? "Delete post" : "Borrar publicación"
            }
            canEditAlbum={
              isYouTubePlaylist && item.canEditYouTubeAlbum === true
            }
            onEditAlbum={() => onEditAlbum?.(item, youtubeMedia)}
            editAlbumLabel={
              isYouTubeAlbum
                ? language === "en"
                  ? "Edit album"
                  : "Editar álbum"
                : language === "en"
                  ? "Edit playlist"
                  : "Editar playlist"
            }
          />
        ) : null}
      </View>
    </View>
  );
}

function ComputerLinkLibrary({ clientId, language }) {
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [movingLink, setMovingLink] = useState(null);
  const folders = useQuery(api.computerLinks.listFolders) || [];
  const folderId =
    folderFilter !== "all" &&
    folderFilter !== "favorites" &&
    folderFilter !== "unclassified"
      ? folderFilter
      : undefined;
  const links = useQuery(api.computerLinks.list, {
    search: search.trim() || undefined,
    folderId,
    onlyFavorites: folderFilter === "favorites" || undefined,
    onlyUnclassified: folderFilter === "unclassified" || undefined,
  });
  const ensureDefaultFolders = useMutation(
    api.computerLinks.ensureDefaultFolders,
  );
  const syncFromChat = useMutation(api.computerLinks.syncFromChat);
  const toggleFavorite = useMutation(api.computerLinks.toggleFavorite);
  const moveToFolder = useMutation(api.computerLinks.moveToFolder);
  const removeLink = useMutation(api.computerLinks.remove);

  useEffect(() => {
    ensureDefaultFolders({ clientId })
      .then(() => syncFromChat({ clientId }))
      .catch((error) =>
        console.warn("[ComputerLinkLibrary] sync failed", error),
      );
  }, [clientId, ensureDefaultFolders, syncFromChat]);

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [String(folder._id), folder])),
    [folders],
  );

  const handleMove = useCallback(
    async (folder) => {
      if (!movingLink?._id) return;
      try {
        await moveToFolder({
          linkId: movingLink._id,
          folderId: folder?._id,
        });
        setMovingLink(null);
      } catch (error) {
        safeAlert("Error", error?.message || "No se pudo mover el enlace.");
      }
    },
    [moveToFolder, movingLink],
  );

  return (
    <View style={styles.libraryRoot}>
      <View style={styles.librarySearchRow}>
        <Ionicons name="search-outline" size={19} color="#64748b" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            language === "en" ? "Search links…" : "Buscar enlaces…"
          }
          placeholderTextColor="#94a3b8"
          style={styles.librarySearchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} style={styles.searchClear}>
            <Ionicons name="close-circle" size={19} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.libraryFolders}
      >
        {[
          { _id: "all", name: "Todos", icon: "apps-outline" },
          { _id: "favorites", name: "Favoritos", icon: "star-outline" },
          {
            _id: "unclassified",
            name: "Sin clasificar",
            icon: "file-tray-outline",
          },
          ...folders,
        ].map((folder) => {
          const id = String(folder._id);
          const active = folderFilter === id;
          return (
            <Pressable
              key={id}
              onPress={() => setFolderFilter(id)}
              style={[
                styles.libraryFolderChip,
                active && styles.libraryFolderChipActive,
              ]}
            >
              <Ionicons
                name={folder.icon || "folder-outline"}
                size={14}
                color={active ? "#fff" : folder.color || "#475569"}
              />
              <Text
                style={[
                  styles.libraryFolderText,
                  active && styles.libraryFolderTextActive,
                ]}
              >
                {folder.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={links || []}
        keyExtractor={(item) => String(item._id)}
        style={styles.libraryList}
        contentContainerStyle={[
          styles.libraryListContent,
          links?.length === 0 && styles.libraryListEmpty,
        ]}
        renderItem={({ item }) => {
          const folder = item.folderId
            ? folderById.get(String(item.folderId))
            : null;
          return (
            <View style={styles.libraryLinkCard}>
              <WebPreviewCard url={item.normalizedUrl} compact />
              <View style={styles.libraryLinkMeta}>
                <View style={styles.libraryLinkFolderLabel}>
                  <Ionicons
                    name={folder?.icon || "file-tray-outline"}
                    size={13}
                    color={folder?.color || "#64748b"}
                  />
                  <Text style={styles.libraryLinkFolderText} numberOfLines={1}>
                    {folder?.name || "Sin clasificar"}
                  </Text>
                </View>
                <Text style={styles.libraryLinkAuthor} numberOfLines={1}>
                  {item.username}
                </Text>
                <Pressable
                  onPress={() => toggleFavorite({ linkId: item._id })}
                  style={styles.libraryActionButton}
                  accessibilityLabel="Favorito"
                >
                  <Ionicons
                    name={item.favorite ? "star" : "star-outline"}
                    size={18}
                    color={item.favorite ? "#eab308" : "#64748b"}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setMovingLink(item)}
                  style={styles.libraryActionButton}
                  accessibilityLabel="Mover a carpeta"
                >
                  <Ionicons name="folder-open-outline" size={18} color="#2563eb" />
                </Pressable>
                <Pressable
                  onPress={() => removeLink({ linkId: item._id })}
                  style={styles.libraryActionButton}
                  accessibilityLabel="Quitar de la biblioteca"
                >
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={38} color="#94a3b8" />
            <Text style={styles.emptyTitle}>
              {links === undefined
                ? "Cargando biblioteca…"
                : "No hay enlaces en esta selección"}
            </Text>
            <Text style={styles.emptyText}>
              Publica una URL en el chat de Informática para guardarla
              automáticamente.
            </Text>
          </View>
        }
      />

      <Modal
        visible={Boolean(movingLink)}
        transparent
        animationType="fade"
        onRequestClose={() => setMovingLink(null)}
      >
        <Pressable
          style={styles.folderModalBackdrop}
          onPress={() => setMovingLink(null)}
        >
          <Pressable style={styles.folderModalCard} onPress={() => {}}>
            <Text style={styles.folderModalTitle}>Mover a carpeta</Text>
            <ScrollView style={styles.folderModalList}>
              <Pressable
                onPress={() => handleMove(null)}
                style={styles.folderModalItem}
              >
                <Ionicons name="file-tray-outline" size={20} color="#64748b" />
                <Text style={styles.folderModalItemText}>Sin clasificar</Text>
              </Pressable>
              {folders.map((folder) => (
                <Pressable
                  key={String(folder._id)}
                  onPress={() => handleMove(folder)}
                  style={styles.folderModalItem}
                >
                  <Ionicons
                    name={folder.icon || "folder-outline"}
                    size={20}
                    color={folder.color || "#475569"}
                  />
                  <Text style={styles.folderModalItemText}>{folder.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function ChatScreen() {
  const listRef = useRef(null);
  const refreshedNewsDatesRef = useRef(false);
  const { language } = useI18n();
  const [room, setRoom] = useState("compras");
  const [chatClientId] = useState(getOrCreateChatClientId);
  const [alias, setAlias] = useState(createDefaultAlias);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [expandedImageUri, setExpandedImageUri] = useState(null);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumCover, setAlbumCover] = useState(null);
  const [albumLyrics, setAlbumLyrics] = useState(null);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [editingPlaylistMessageId, setEditingPlaylistMessageId] = useState(null);
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistTracks, setPlaylistTracks] = useState([
    { kind: "single", title: "I. Allegro", url: "" },
    { kind: "single", title: "II. Andante", url: "" },
  ]);
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [computerMode, setComputerMode] = useState("chat");
  const editingIsYouTubeAlbum =
    editingAlbum?.youtubeMedia?.playlistId?.startsWith("OLAK5uy_") === true;

  const messages = useQuery(api.chat.listMessages, {
    room,
    clientId: chatClientId,
  });
  const sendMessage = useMutation(api.chat.sendMessage);
  const deleteMessage = useMutation(api.chat.deleteMessage);
  const updateYouTubeAlbum = useMutation(api.chat.updateYouTubeAlbum);
  const createCustomYouTubePlaylist = useMutation(
    api.chat.createCustomYouTubePlaylist,
  );
  const updateCustomYouTubePlaylist = useMutation(
    api.chat.updateCustomYouTubePlaylist,
  );
  const generateImageUploadUrl = useMutation(api.chat.generateImageUploadUrl);
  const refreshNewsYouTubePublishedDates = useAction(
    api.chat.refreshNewsYouTubePublishedDates,
  );

  useEffect(() => {
    if (
      room !== "noticias" ||
      messages === undefined ||
      refreshedNewsDatesRef.current
    ) {
      return;
    }

    refreshedNewsDatesRef.current = true;
    refreshNewsYouTubePublishedDates().catch((error) => {
      refreshedNewsDatesRef.current = false;
      console.warn("[Chat] No se pudieron actualizar las fechas de YouTube:", error);
    });
  }, [messages, refreshNewsYouTubePublishedDates, room]);

  const visibleMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    return [...messages].sort(
      (a, b) =>
        (a.createdAt || a._creationTime || 0) -
        (b.createdAt || b._creationTime || 0),
    );
  }, [messages]);

  const listItems = useMemo(() => {
    if (room !== "noticias") return visibleMessages;

    const newsMessages = [...visibleMessages].sort((a, b) => {
      const aPublishedAt = a.youtubePublishedAt;
      const bPublishedAt = b.youtubePublishedAt;
      if (aPublishedAt && bPublishedAt) return bPublishedAt - aPublishedAt;
      if (aPublishedAt) return -1;
      if (bPublishedAt) return 1;
      return (
        (b.createdAt || b._creationTime || 0) -
        (a.createdAt || a._creationTime || 0)
      );
    });
    const groupedItems = [];
    let previousDateKey = null;

    newsMessages.forEach((message) => {
      const timestamp =
        message.youtubePublishedAt || message.createdAt || message._creationTime;
      const dateKey = getDateKey(timestamp);

      if (dateKey !== previousDateKey) {
        groupedItems.push({
          _listType: "dateSeparator",
          _listKey: `date-${dateKey}`,
          timestamp,
          isYouTubePublishedDate: Boolean(message.youtubePublishedAt),
        });
        previousDateKey = dateKey;
      }

      groupedItems.push(message);
    });

    return groupedItems;
  }, [room, visibleMessages]);

  const cleanAlias = alias.trim() || "anonymous";
  const cleanInput = input.trim();
  const messageLengthLimit =
    room === "youtube" ? MAX_YOUTUBE_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH;
  const canSend =
    Boolean(cleanInput || selectedImages.length) &&
    cleanInput.length <= messageLengthLimit &&
    !sending;
  const playlistCanSave =
    Boolean(playlistTitle.trim()) &&
    playlistTracks.length >= 2 &&
    playlistTracks.every((track) => {
      const parsed = parseYouTubeUrl(track.url.trim());
      return (
        parsed.isValid &&
        (track.kind === "album"
          ? Boolean(parsed.playlistId)
          : Boolean(parsed.videoId))
      );
    }) &&
    !savingPlaylist;

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

  const updatePlaylistTrack = useCallback((index, field, value) => {
    setPlaylistTracks((current) =>
      current.map((track, trackIndex) =>
        trackIndex === index ? { ...track, [field]: value } : track,
      ),
    );
  }, []);

  const handlePickPlaylistLyrics = useCallback(async (index) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      const fileName = asset.name || "lyrics.lrc";
      if (!fileName.toLowerCase().endsWith(".lrc")) {
        safeAlert("Formato no válido", "Selecciona un fichero con extensión .lrc.");
        return;
      }
      if ((asset.size || 0) > 512 * 1024) {
        safeAlert("Fichero demasiado grande", "El fichero LRC no puede superar 512 KB.");
        return;
      }
      updatePlaylistTrack(index, "lyrics", {
        uri: asset.uri,
        fileName,
        mimeType: asset.mimeType || "text/plain",
        size: asset.size || 0,
      });
    } catch (error) {
      console.error("[Chat] No se pudieron seleccionar las letras:", error);
    }
  }, [updatePlaylistTrack]);

  const addPlaylistTrack = useCallback(() => {
    setPlaylistTracks((current) =>
      current.length >= 20
        ? current
        : [
            ...current,
            {
              kind: "single",
              title: `Single ${current.length + 1}`,
              url: "",
            },
          ],
    );
  }, []);

  const removePlaylistTrack = useCallback((index) => {
    setPlaylistTracks((current) =>
      current.length <= 2
        ? current
        : current.filter((_, trackIndex) => trackIndex !== index),
    );
  }, []);

  const closePlaylistCreator = useCallback(() => {
    if (savingPlaylist) return;
    setCreatingPlaylist(false);
    setEditingPlaylistMessageId(null);
  }, [savingPlaylist]);

  const openCustomPlaylistEditor = useCallback((item) => {
    const playlist = item?.customYouTubePlaylist;
    if (!playlist) return;
    setEditingPlaylistMessageId(item._id);
    setPlaylistTitle(playlist.title || "");
    setPlaylistTracks(
      playlist.tracks.map((track, index) => ({
        kind: track.kind === "album" ? "album" : "single",
        title: track.title || `Elemento ${index + 1}`,
        url: track.url || (track.playlistId
          ? `https://www.youtube.com/playlist?list=${track.playlistId}`
          : `https://www.youtube.com/watch?v=${track.videoId || ""}`),
        lyrics: track.lyricsStorageId ? {
          existing: true,
          storageId: track.lyricsStorageId,
          fileName: track.lyricsFileName || "lyrics.lrc",
          mimeType: track.lyricsMimeType || "text/plain",
          size: track.lyricsSize || 0,
        } : null,
      })),
    );
    setCreatingPlaylist(true);
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    const title = playlistTitle.trim();
    if (!title || savingPlaylist) return;
    setSavingPlaylist(true);
    try {
      const tracks = [];
      for (let index = 0; index < playlistTracks.length; index += 1) {
        const track = playlistTracks[index];
        const parsed = parseYouTubeUrl(track.url.trim());
        const isAlbum = track.kind === "album";
        if (
          !parsed.isValid ||
          (isAlbum ? !parsed.playlistId : !parsed.videoId)
        ) {
          throw new Error(
            `Revisa el enlace del ${isAlbum ? "álbum" : "single"} ${index + 1}.`,
          );
        }
        let lyrics;
        if (track.lyrics?.existing) {
          lyrics = {
            storageId: track.lyrics.storageId,
            fileName: track.lyrics.fileName,
            mimeType: track.lyrics.mimeType || "text/plain",
            size: track.lyrics.size || 0,
          };
        } else if (track.lyrics) {
          const uploadUrl = await generateImageUploadUrl();
          const lyricsResponse = await fetch(track.lyrics.uri);
          const blob = await lyricsResponse.blob();
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": track.lyrics.mimeType || "text/plain" },
            body: blob,
          });
          if (!uploadResponse.ok) {
            throw new Error(`No se pudieron subir las letras del elemento ${index + 1}.`);
          }
          const { storageId } = await uploadResponse.json();
          lyrics = {
            storageId,
            fileName: track.lyrics.fileName,
            mimeType: track.lyrics.mimeType || "text/plain",
            size: track.lyrics.size || blob.size || 0,
          };
        }
        tracks.push({
          kind: isAlbum ? "album" : "single",
          videoId: parsed.videoId || undefined,
          playlistId: parsed.playlistId || undefined,
          url: track.url.trim(),
          title:
            track.title.trim() ||
            `${isAlbum ? "Álbum" : "Single"} ${index + 1}`,
          lyrics,
        });
      }
      if (editingPlaylistMessageId) {
        await updateCustomYouTubePlaylist({
          messageId: editingPlaylistMessageId,
          clientId: chatClientId,
          title,
          tracks: tracks.map(({ lyrics, ...track }) => ({
            ...track,
            lyricsStorageId: lyrics?.storageId,
            lyricsFileName: lyrics?.fileName,
            lyricsMimeType: lyrics?.mimeType,
            lyricsSize: lyrics?.size,
          })),
        });
      } else {
        await createCustomYouTubePlaylist({
          username: cleanAlias,
          clientId: chatClientId,
          title,
          tracks,
        });
      }
      setCreatingPlaylist(false);
      setEditingPlaylistMessageId(null);
      setPlaylistTitle("");
      setPlaylistTracks([
        { kind: "single", title: "I. Allegro", url: "" },
        { kind: "single", title: "II. Andante", url: "" },
      ]);
    } catch (error) {
      safeAlert(
        editingPlaylistMessageId ? "No se pudo guardar la playlist" : "No se pudo crear la playlist",
        error?.message || "Revisa los enlaces de YouTube.",
      );
    } finally {
      setSavingPlaylist(false);
    }
  }, [
    chatClientId,
    cleanAlias,
    createCustomYouTubePlaylist,
    editingPlaylistMessageId,
    generateImageUploadUrl,
    playlistTitle,
    playlistTracks,
    savingPlaylist,
    updateCustomYouTubePlaylist,
  ]);

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
          throw new Error(
            `No se pudo subir una imagen (${uploadResponse.status}).`,
          );
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
        keepIndefinitely: true,
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

        safeAlert(language === "en" ? "Error" : "Error", message);
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
      const message = item.isDeletedByUser
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

  const openAlbumEditor = useCallback((item, youtubeMedia) => {
    setEditingAlbum({ item, youtubeMedia });
    setAlbumTitle(item?.youtubeAlbum?.title || "");
    setAlbumCover(null);
    setAlbumLyrics(null);
  }, []);

  const closeAlbumEditor = useCallback(() => {
    if (savingAlbum) return;
    setEditingAlbum(null);
    setAlbumTitle("");
    setAlbumCover(null);
    setAlbumLyrics(null);
  }, [savingAlbum]);

  const handlePickAlbumCover = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;

      const width = asset.width || 256;
      const height = asset.height || 256;
      const side = Math.min(width, height);
      const actions = [
        {
          crop: {
            originX: Math.max(0, Math.floor((width - side) / 2)),
            originY: Math.max(0, Math.floor((height - side) / 2)),
            width: side,
            height: side,
          },
        },
        { resize: { width: 256, height: 256 } },
      ];
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        actions,
        {
          compress: 0.78,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      const approximateSize = resized.base64?.length
        ? Math.ceil((resized.base64.length * 3) / 4)
        : 0;
      setAlbumCover({
        uri: resized.uri,
        width: resized.width || 256,
        height: resized.height || 256,
        mimeType: "image/jpeg",
        size: approximateSize,
      });
    } catch (error) {
      console.error("[Chat] No se pudo seleccionar la portada:", error);
    }
  }, []);

  const handlePickAlbumLyrics = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      const fileName = asset.name || "lyrics.lrc";
      if (!fileName.toLowerCase().endsWith(".lrc")) {
        safeAlert(
          "Formato no válido",
          "Selecciona un fichero con extensión .lrc.",
        );
        return;
      }
      if ((asset.size || 0) > 512 * 1024) {
        safeAlert(
          "Fichero demasiado grande",
          "El fichero LRC no puede superar 512 KB.",
        );
        return;
      }
      setAlbumLyrics({
        uri: asset.uri,
        fileName,
        mimeType: asset.mimeType || "text/plain",
        size: asset.size || 0,
      });
    } catch (error) {
      console.error("[Chat] No se pudo seleccionar el fichero LRC:", error);
    }
  }, []);

  const handleSaveAlbum = useCallback(async () => {
    const title = albumTitle.trim();
    const messageId = editingAlbum?.item?._id;
    if (!messageId || !title || savingAlbum) return;
    setSavingAlbum(true);
    try {
      let thumbnail;
      if (albumCover) {
        const uploadUrl = await generateImageUploadUrl();
        const imageResponse = await fetch(albumCover.uri);
        const blob = await imageResponse.blob();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": albumCover.mimeType },
          body: blob,
        });
        if (!uploadResponse.ok) {
          throw new Error(
            `No se pudo subir la portada (${uploadResponse.status}).`,
          );
        }
        const { storageId } = await uploadResponse.json();
        thumbnail = {
          storageId,
          mimeType: albumCover.mimeType,
          width: albumCover.width,
          height: albumCover.height,
          size: albumCover.size || blob.size || 0,
        };
      }

      let lyrics;
      if (albumLyrics && editingIsYouTubeAlbum) {
        const uploadUrl = await generateImageUploadUrl();
        const lyricsResponse = await fetch(albumLyrics.uri);
        const blob = await lyricsResponse.blob();
        if (blob.size > 512 * 1024)
          throw new Error("El fichero LRC supera 512 KB.");
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": albumLyrics.mimeType || "text/plain" },
          body: blob,
        });
        if (!uploadResponse.ok) {
          throw new Error(
            `No se pudo subir el fichero LRC (${uploadResponse.status}).`,
          );
        }
        const { storageId } = await uploadResponse.json();
        lyrics = {
          storageId,
          fileName: albumLyrics.fileName,
          mimeType: albumLyrics.mimeType || "text/plain",
          size: albumLyrics.size || blob.size || 0,
        };
      }

      await updateYouTubeAlbum({
        messageId,
        clientId: chatClientId,
        title,
        thumbnail,
        lyrics,
      });
      setEditingAlbum(null);
      setAlbumTitle("");
      setAlbumCover(null);
      setAlbumLyrics(null);
    } catch (error) {
      console.error("[Chat] No se pudo guardar YouTube:", error);
      safeAlert(
        "Error",
        error?.message ||
          (editingIsYouTubeAlbum
            ? "No se pudo guardar el álbum."
            : "No se pudo guardar la playlist."),
      );
    } finally {
      setSavingAlbum(false);
    }
  }, [
    albumCover,
    albumLyrics,
    albumTitle,
    chatClientId,
    editingAlbum,
    editingIsYouTubeAlbum,
    generateImageUploadUrl,
    savingAlbum,
    updateYouTubeAlbum,
  ]);

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

        {room === "youtube" ? (
          <View style={styles.youtubeToolsBar}>
            <Pressable
              onPress={() => {
                setEditingPlaylistMessageId(null);
                setPlaylistTitle("");
                setPlaylistTracks([
                  { kind: "single", title: "I. Allegro", url: "" },
                  { kind: "single", title: "II. Andante", url: "" },
                ]);
                setCreatingPlaylist(true);
              }}
              style={styles.createPlaylistButton}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.createPlaylistButtonText}>Nueva playlist</Text>
            </Pressable>
            <Text style={styles.youtubeToolsHint} numberOfLines={1}>
              Combina canciones individuales y álbumes
            </Text>
          </View>
        ) : null}

        {room === "informatica" ? (
          <View style={styles.computerModeBar}>
            <Pressable
              onPress={() => setComputerMode("chat")}
              style={[
                styles.computerModeButton,
                computerMode === "chat" && styles.computerModeButtonActive,
              ]}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={16}
                color={computerMode === "chat" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.computerModeText,
                  computerMode === "chat" && styles.computerModeTextActive,
                ]}
              >
                Chat
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setComputerMode("library")}
              style={[
                styles.computerModeButton,
                computerMode === "library" && styles.computerModeButtonActive,
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={16}
                color={computerMode === "library" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.computerModeText,
                  computerMode === "library" && styles.computerModeTextActive,
                ]}
              >
                Biblioteca
              </Text>
            </Pressable>
          </View>
        ) : null}

        {room === "informatica" && computerMode === "library" ? (
          <ComputerLinkLibrary clientId={chatClientId} language={language} />
        ) : (
          <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) =>
            String(item._listKey || item._id || item.id)
          }
          renderItem={({ item }) =>
            item._listType === "dateSeparator" ? (
              <View style={styles.dateSeparatorRow}>
                <View style={styles.dateSeparatorLine} />
                <Text style={styles.dateSeparatorText}>
                  {formatDateLabel(item.timestamp, language)}
                </Text>
                <View style={styles.dateSeparatorLine} />
              </View>
            ) : (
              <Message
                item={item}
                myAlias={cleanAlias}
                language={language}
                onDelete={handleDeletePost}
                onEditAlbum={openAlbumEditor}
                onEditCustomPlaylist={openCustomPlaylistEditor}
                onImagePress={setExpandedImageUri}
                deleting={deletingMessageId === item._id}
              />
            )
          }
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
                name={
                  room === "youtube"
                    ? "logo-youtube"
                    : "chatbubble-ellipses-outline"
                }
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
        )}

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
          visible={creatingPlaylist}
          transparent
          animationType="fade"
          onRequestClose={closePlaylistCreator}
        >
          <View style={styles.playlistCreatorBackdrop}>
            <View style={styles.playlistCreatorCard}>
              <View style={styles.playlistCreatorHeader}>
                <View style={styles.playlistCreatorTitleBlock}>
                  <Text style={styles.playlistCreatorTitle}>
                    {editingPlaylistMessageId ? "Editar playlist de Shopp" : "Nueva playlist de Shopp"}
                  </Text>
                  <Text style={styles.playlistCreatorSubtitle}>
                    Añade singles o álbumes mediante sus enlaces de YouTube.
                  </Text>
                </View>
                <Pressable onPress={closePlaylistCreator} style={styles.playlistCreatorClose}>
                  <Ionicons name="close" size={23} color="#475569" />
                </Pressable>
              </View>
              <Text style={styles.playlistFieldLabel}>Nombre del concierto o playlist</Text>
              <TextInput
                value={playlistTitle}
                onChangeText={setPlaylistTitle}
                placeholder="Mozart · Concierto para piano · Daniel Barenboim"
                placeholderTextColor="#94a3b8"
                style={styles.playlistTitleInput}
                maxLength={120}
              />
              <ScrollView style={styles.playlistTracksScroll} keyboardShouldPersistTaps="handled">
                {playlistTracks.map((track, index) => (
                  <View key={`playlist-track-${index}`} style={styles.playlistTrackEditor}>
                    <View style={styles.playlistTrackHeader}>
                      <Text style={styles.playlistTrackNumber}>Elemento {index + 1}</Text>
                      {playlistTracks.length > 2 ? (
                        <Pressable onPress={() => removePlaylistTrack(index)} style={styles.playlistTrackRemove}>
                          <Ionicons name="trash-outline" size={17} color="#dc2626" />
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.playlistKindRow}>
                      <Pressable
                        onPress={() => updatePlaylistTrack(index, "kind", "single")}
                        style={[
                          styles.playlistKindButton,
                          track.kind !== "album" && styles.playlistKindButtonActive,
                        ]}
                      >
                        <Ionicons
                          name="musical-note-outline"
                          size={15}
                          color={track.kind !== "album" ? "#fff" : "#475569"}
                        />
                        <Text style={[
                          styles.playlistKindText,
                          track.kind !== "album" && styles.playlistKindTextActive,
                        ]}>Single</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => updatePlaylistTrack(index, "kind", "album")}
                        style={[
                          styles.playlistKindButton,
                          track.kind === "album" && styles.playlistKindButtonActive,
                        ]}
                      >
                        <Ionicons
                          name="albums-outline"
                          size={15}
                          color={track.kind === "album" ? "#fff" : "#475569"}
                        />
                        <Text style={[
                          styles.playlistKindText,
                          track.kind === "album" && styles.playlistKindTextActive,
                        ]}>Álbum</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={track.title}
                      onChangeText={(value) => updatePlaylistTrack(index, "title", value)}
                      placeholder={
                        track.kind === "album"
                          ? `Nombre del álbum ${index + 1}`
                          : `Nombre del single ${index + 1}`
                      }
                      placeholderTextColor="#94a3b8"
                      style={styles.playlistTrackInput}
                      maxLength={120}
                    />
                    <TextInput
                      value={track.url}
                      onChangeText={(value) => updatePlaylistTrack(index, "url", value)}
                      placeholder={
                        track.kind === "album"
                          ? "https://youtube.com/playlist?list=..."
                          : "https://youtu.be/..."
                      }
                      placeholderTextColor="#94a3b8"
                      style={styles.playlistTrackInput}
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    <View style={styles.playlistLyricsRow}>
                      <Pressable
                        onPress={() => handlePickPlaylistLyrics(index)}
                        style={styles.playlistLyricsButton}
                      >
                        <Ionicons name="document-text-outline" size={17} color="#2563eb" />
                        <View style={styles.playlistLyricsTextBlock}>
                          <Text style={styles.playlistLyricsTitle} numberOfLines={1}>
                            {track.lyrics?.fileName || "Añadir letras .lrc"}
                          </Text>
                          <Text style={styles.playlistLyricsHint}>
                            Opcional · máximo 512 KB
                          </Text>
                        </View>
                      </Pressable>
                      {track.lyrics ? (
                        <Pressable
                          onPress={() => updatePlaylistTrack(index, "lyrics", null)}
                          style={styles.playlistLyricsRemove}
                        >
                          <Ionicons name="close-circle" size={19} color="#dc2626" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
                {playlistTracks.length < 20 ? (
                  <Pressable onPress={addPlaylistTrack} style={styles.addMovementButton}>
                    <Ionicons name="add" size={18} color="#2563eb" />
                    <Text style={styles.addMovementText}>Añadir single o álbum</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
              <View style={styles.playlistCreatorActions}>
                <Pressable onPress={closePlaylistCreator} style={styles.albumCancelButton}>
                  <Text style={styles.albumCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreatePlaylist}
                  disabled={!playlistCanSave}
                  style={[styles.albumSaveButton, !playlistCanSave && styles.albumSaveButtonDisabled]}
                >
                  <Text style={styles.albumSaveText}>
                    {savingPlaylist
                      ? editingPlaylistMessageId ? "Guardando…" : "Creando…"
                      : editingPlaylistMessageId ? "Guardar cambios" : "Crear playlist"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(editingAlbum)}
          transparent
          animationType="fade"
          onRequestClose={closeAlbumEditor}
        >
          <View style={styles.albumEditorBackdrop}>
            <View style={styles.albumEditorCard}>
              <View style={styles.albumEditorHeader}>
                <Text style={styles.albumEditorTitle}>
                  {editingIsYouTubeAlbum
                    ? "Editar álbum de YouTube"
                    : "Editar playlist de YouTube"}
                </Text>
                <Pressable
                  onPress={closeAlbumEditor}
                  disabled={savingAlbum}
                  style={styles.albumEditorClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={22} color="#374151" />
                </Pressable>
              </View>

              <Pressable
                onPress={handlePickAlbumCover}
                disabled={savingAlbum}
                style={styles.albumCoverButton}
                accessibilityRole="button"
                accessibilityLabel="Seleccionar portada"
              >
                {albumCover?.uri ||
                editingAlbum?.item?.youtubeAlbum?.thumbnailUri ? (
                  <Image
                    source={{
                      uri:
                        albumCover?.uri ||
                        editingAlbum.item.youtubeAlbum.thumbnailUri,
                    }}
                    style={styles.albumCoverPreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.albumCoverPlaceholder}>
                    <View style={styles.youtubePlaylistPlaceholderIcon}>
                      <Ionicons name="logo-youtube" size={42} color="#ffffff" />
                    </View>
                    <Text style={styles.albumCoverPlaceholderText}>
                      Carátula opcional
                    </Text>
                  </View>
                )}
              </Pressable>

              <Text style={styles.albumFieldLabel}>
                {editingIsYouTubeAlbum
                  ? "Nombre del álbum"
                  : "Nombre de la playlist"}
              </Text>
              <TextInput
                value={albumTitle}
                onChangeText={(value) => setAlbumTitle(value.slice(0, 120))}
                placeholder={
                  editingIsYouTubeAlbum
                    ? "Nombre del álbum"
                    : "Nombre de la playlist"
                }
                editable={!savingAlbum}
                maxLength={120}
                style={styles.albumTitleInput}
              />

              {editingIsYouTubeAlbum ? (
                <>
                  <Text style={styles.albumFieldLabelLyrics}>
                    Letras sincronizadas
                  </Text>
                  <Pressable
                    onPress={handlePickAlbumLyrics}
                    disabled={savingAlbum}
                    style={styles.lyricsFileButton}
                    accessibilityRole="button"
                    accessibilityLabel="Seleccionar fichero LRC"
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#2563eb"
                    />
                    <View style={styles.lyricsFileText}>
                      <Text style={styles.lyricsFileName} numberOfLines={1}>
                        {albumLyrics?.fileName ||
                          editingAlbum?.item?.youtubeAlbum?.lyricsFileName ||
                          "Seleccionar fichero .lrc"}
                      </Text>
                      <Text style={styles.lyricsFileHint}>
                        LRC sincronizado · máximo 512 KB
                      </Text>
                    </View>
                  </Pressable>
                </>
              ) : null}

              <View style={styles.albumEditorActions}>
                <Pressable
                  onPress={closeAlbumEditor}
                  disabled={savingAlbum}
                  style={styles.albumCancelButton}
                >
                  <Text style={styles.albumCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveAlbum}
                  disabled={savingAlbum || !albumTitle.trim()}
                  style={[
                    styles.albumSaveButton,
                    (savingAlbum || !albumTitle.trim()) &&
                      styles.albumSaveButtonDisabled,
                  ]}
                >
                  <Text style={styles.albumSaveText}>
                    {savingAlbum ? "Guardando…" : "Guardar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
              accessibilityLabel={
                language === "en" ? "Close image" : "Cerrar imagen"
              }
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
  computerModeBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  computerModeButton: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  computerModeButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  computerModeText: { fontSize: 12, fontWeight: "800", color: "#475569" },
  computerModeTextActive: { color: "#fff" },
  libraryRoot: { flex: 1, backgroundColor: "#f1f5f9" },
  librarySearchRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  librarySearchInput: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
  },
  searchClear: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  libraryFolders: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  libraryFolderChip: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  libraryFolderChipActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  libraryFolderText: { fontSize: 11, fontWeight: "800", color: "#475569" },
  libraryFolderTextActive: { color: "#fff" },
  libraryList: { flex: 1 },
  libraryListContent: { paddingHorizontal: 12, paddingBottom: 14 },
  libraryListEmpty: { flexGrow: 1, justifyContent: "center" },
  libraryLinkCard: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#fff",
  },
  libraryLinkMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 7,
  },
  libraryLinkFolderLabel: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 5,
    backgroundColor: "#f1f5f9",
  },
  libraryLinkFolderText: {
    maxWidth: 120,
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  libraryLinkAuthor: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    color: "#64748b",
  },
  libraryActionButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  folderModalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  folderModalCard: {
    width: 360,
    maxWidth: "100%",
    maxHeight: "78%",
    padding: 14,
    backgroundColor: "#fff",
  },
  folderModalTitle: {
    marginBottom: 10,
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },
  folderModalList: { flexGrow: 0 },
  folderModalItem: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  folderModalItemText: { fontSize: 14, fontWeight: "700", color: "#334155" },
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
  dateSeparatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  dateSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#cbd5e1",
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "capitalize",
  },
  bubble: {
    maxWidth: "86%",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  bubbleMine: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  bubbleYouTube: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
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
  youtubeToolsBar: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  createPlaylistButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    backgroundColor: "#dc2626",
  },
  createPlaylistButtonText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  youtubeToolsHint: { flex: 1, minWidth: 0, fontSize: 10, color: "#64748b" },
  playlistCreatorBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
  },
  playlistCreatorCard: {
    width: 560,
    maxWidth: "100%",
    maxHeight: "88%",
    padding: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  playlistCreatorHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  playlistCreatorTitleBlock: { flex: 1, minWidth: 0 },
  playlistCreatorTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  playlistCreatorSubtitle: { marginTop: 3, fontSize: 11, lineHeight: 15, color: "#64748b" },
  playlistCreatorClose: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  playlistFieldLabel: { marginBottom: 5, fontSize: 12, fontWeight: "800", color: "#334155" },
  playlistTitleInput: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 13,
    color: "#111827",
  },
  playlistTracksScroll: { flexGrow: 0, marginTop: 10 },
  playlistTrackEditor: {
    marginBottom: 9,
    padding: 9,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  playlistTrackHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  playlistTrackNumber: { flex: 1, fontSize: 10, fontWeight: "900", color: "#dc2626", textTransform: "uppercase" },
  playlistTrackRemove: { width: 30, height: 26, alignItems: "center", justifyContent: "center" },
  playlistKindRow: { flexDirection: "row", gap: 6, marginBottom: 2 },
  playlistKindButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  playlistKindButtonActive: { borderColor: "#dc2626", backgroundColor: "#dc2626" },
  playlistKindText: { fontSize: 10, fontWeight: "800", color: "#475569" },
  playlistKindTextActive: { color: "#fff" },
  playlistTrackInput: {
    minHeight: 38,
    marginTop: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 12,
    color: "#111827",
  },
  playlistLyricsRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  playlistLyricsButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  playlistLyricsTextBlock: { flex: 1, minWidth: 0 },
  playlistLyricsTitle: { fontSize: 11, fontWeight: "800", color: "#1d4ed8" },
  playlistLyricsHint: { marginTop: 1, fontSize: 9, color: "#64748b" },
  playlistLyricsRemove: { width: 32, height: 38, alignItems: "center", justifyContent: "center" },
  addMovementButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  addMovementText: { fontSize: 11, fontWeight: "800", color: "#2563eb" },
  playlistCreatorActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 13 },
  albumEditorBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  albumEditorCard: {
    width: 360,
    maxWidth: "100%",
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  albumEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  albumEditorTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  albumEditorClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  albumCoverButton: {
    width: 144,
    height: 144,
    alignSelf: "center",
    marginBottom: 14,
  },
  albumCoverPreview: { width: 144, height: 144, backgroundColor: "#e5e7eb" },
  albumCoverPlaceholder: {
    width: 144,
    height: 144,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    backgroundColor: "#f8fafc",
  },
  albumCoverPlaceholderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  youtubePlaylistPlaceholderIcon: {
    width: 70,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#ef2027",
  },
  albumFieldLabel: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  albumTitleInput: {
    minHeight: 44,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
  },
  albumFieldLabelLyrics: {
    marginTop: 13,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  lyricsFileButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  lyricsFileText: { flex: 1, minWidth: 0 },
  lyricsFileName: { fontSize: 12, fontWeight: "700", color: "#1e40af" },
  lyricsFileHint: { marginTop: 2, fontSize: 10, color: "#64748b" },
  albumEditorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  albumCancelButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  albumCancelText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  albumSaveButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#2563eb",
  },
  albumSaveButtonDisabled: { opacity: 0.45 },
  albumSaveText: { fontSize: 13, fontWeight: "800", color: "#fff" },
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
