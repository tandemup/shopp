import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRoute } from "@react-navigation/native";

import { api } from "@/convex/_generated/api";
import CustomYouTubePlaylistPlayer from "@/src/components/chat/CustomYouTubePlaylistPlayer";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { safeAlert, safeConfirm } from "@/src/components/ui/alert/safeAlert";
import { parseYouTubeUrl } from "@/src/services/urlSafety";
import { ROUTES } from "@/src/navigation/ROUTES";

import TutorialTransferScreen from "./TutorialTransferScreen";
import EditorVideoPreview from "./EditorVideoPreview";
import { MAX_TUTORIAL_ITEMS } from "@/convex/lib/tutorialItems";
import {
  getLocalLyrics,
  saveLocalLyrics,
  removeLocalLyrics,
} from "@/src/storage/lyricsStorage";

const CLIENT_ID_KEY = "shopp-playlist-client-id";
const normalizeSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const initialTracks = () => {
  const first = {
    kind: "single",
    title: "",
    url: "",
    lyrics: null,
  };
  return [first];
};

function createClientId() {
  if (typeof globalThis?.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  return `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getWebClientId() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const saved = window.localStorage?.getItem(CLIENT_ID_KEY);
    if (saved) return saved;
    const next = createClientId();
    window.localStorage?.setItem(CLIENT_ID_KEY, next);
    return next;
  } catch {
    return createClientId();
  }
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function safeFileName(value) {
  return (
    String(value || "playlist")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "playlist"
  );
}

function jsonFileName(value, fallback) {
  const baseName = String(value || "")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\.json$/i, "");
  return `${baseName || fallback}.json`;
}

function toExportedPlaylist(playlist, type = "shopp-youtube-playlist") {
  return {
    version: 1,
    type,
    title: playlist.title,
    ...(playlist.collectionType === "classical"
      ? {
          collectionType: "classical",
          composer: playlist.composer || "",
          performer: playlist.performer || "",
          conductor: playlist.conductor || "",
          orchestra: playlist.orchestra || "",
          period: playlist.period || "",
          year: playlist.year || "",
        }
      : {}),
    exportedAt: new Date().toISOString(),
    tracks: playlist.tracks.map((track) => ({
      kind: track.kind === "album" ? "album" : "single",
      title: track.title,
      url:
        track.url ||
        (track.playlistId
          ? `https://www.youtube.com/playlist?list=${track.playlistId}`
          : `https://www.youtube.com/watch?v=${track.videoId}`),
      ...(track.lyricsFileName ? { lyricsFileName: track.lyricsFileName } : {}),
    })),
  };
}

async function saveJsonFile(fileName, data) {
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const FileSystem = await import("expo-file-system/legacy");
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Share.share({
    title: fileName,
    url: uri,
    message: Platform.OS === "android" ? json : undefined,
  });
}

function normalizeNewsImportPayload(value) {
  const toNewsItem = (item, index) => {
    const title = String(item?.title || `Noticia ${index + 1}`).trim();
    const url = String(item?.url || item?.youtubeUrl || "").trim();
    return {
      version: 1,
      type: "shopp-youtube-news-item",
      title,
      tracks: [
        {
          kind: "single",
          title,
          url,
        },
      ],
    };
  };

  // Formato sencillo de lista: [{ title, url }].
  if (Array.isArray(value)) {
    return {
      version: 1,
      type: "shopp-youtube-news",
      playlists: value.map(toNewsItem),
    };
  }

  // Formato anterior: una única noticia contenía todos los vídeos. Cada vídeo
  // pasa a ser una noticia independiente, que es el nuevo modelo de Noticias.
  if (
    value?.type === "shopp-youtube-news-item" &&
    Array.isArray(value.tracks) &&
    value.tracks.length > 1
  ) {
    return {
      version: 1,
      type: "shopp-youtube-news",
      playlists: value.tracks.map((track, index) =>
        toNewsItem(
          {
            title: track?.title || `Noticia ${index + 1}`,
            url: track?.url,
          },
          index,
        ),
      ),
    };
  }

  return value;
}

function parseImportedPayload(
  value,
  collectionType = "shopp-youtube-playlist",
  collectionListType = "shopp-youtube-playlists",
  minimumTracks = 1,
  maximumTracks = 20,
  compatibleItemTypes = [],
  compatibleListTypes = [],
) {
  const acceptedItemTypes = [collectionType, ...compatibleItemTypes];
  const acceptedListTypes = [collectionListType, ...compatibleListTypes];
  const candidates =
    acceptedListTypes.includes(value?.type) && Array.isArray(value.playlists)
      ? value.playlists
      : [value];
  return candidates.map((playlist, playlistIndex) => {
    if (
      !acceptedItemTypes.includes(playlist?.type) ||
      !String(playlist.title || "").trim()
    ) {
      throw new Error(
        `La playlist ${playlistIndex + 1} no tiene un formato compatible.`,
      );
    }
    if (
      !Array.isArray(playlist.tracks) ||
      playlist.tracks.length < minimumTracks ||
      playlist.tracks.length > maximumTracks
    ) {
      throw new Error(
        `«${playlist.title}» debe contener entre ${minimumTracks} y ${maximumTracks} elementos.`,
      );
    }
    const tracks = playlist.tracks.map((track, index) => {
      const kind = track.kind === "album" ? "album" : "single";
      const parsed = parseYouTubeUrl(String(track.url || ""));
      if (
        !parsed.isValid ||
        (kind === "album" ? !parsed.playlistId : !parsed.videoId)
      ) {
        throw new Error(
          `El elemento ${index + 1} de «${playlist.title}» no es válido.`,
        );
      }
      return {
        kind,
        videoId: parsed.videoId || undefined,
        playlistId: parsed.playlistId || undefined,
        title: String(track.title || "").trim() || `Elemento ${index + 1}`,
      };
    });
    return {
      title: String(playlist.title).trim(),
      tracks,
      ...(collectionType === "shopp-youtube-classical-playlist"
        ? {
            collectionType: "classical",
            composer: String(playlist.composer || "").trim(),
            performer: String(playlist.performer || "").trim(),
            conductor: String(playlist.conductor || "").trim(),
            orchestra: String(playlist.orchestra || "").trim(),
            period: String(playlist.period || "").trim(),
            year: String(playlist.year || "").trim(),
          }
        : {}),
    };
  });
}

export default function PlayListScreen() {
  const route = useRoute();
  const isTutorials = route.name === ROUTES.TUTORIALS;
  const isNews = route.name === ROUTES.NEWS;
  const isTutorialStyle = isTutorials || isNews;
  const isClassical = route.name === ROUTES.CLASSICAL_MUSIC;
  const contentApi = isTutorialStyle ? api.tutorials : api.playlists;
  const collectionLabel = isNews
    ? "noticia"
    : isTutorials
      ? "tutorial"
      : isClassical
        ? "colección clásica"
        : "playlist";
  const collectionTitle = isNews
    ? "Mis noticias"
    : isTutorials
      ? "Mis tutoriales"
      : isClassical
        ? "Mis playlists classic"
        : "Mis playlists";
  const itemLabel = isTutorialStyle ? "vídeo" : "elemento";
  const exportType = isNews
    ? "shopp-youtube-news"
    : isTutorials
      ? "shopp-youtube-tutorials"
      : isClassical
        ? "shopp-youtube-classical-playlists"
        : "shopp-youtube-playlists";
  const minimumTracks = 1;
  // Noticias se guarda como una noticia por registro: título descriptivo y
  // un único enlace de YouTube. Tutoriales conserva sus colecciones.
  const maximumTracks = isNews ? 1 : isTutorialStyle ? MAX_TUTORIAL_ITEMS : 20;
  const [transferVisible, setTransferVisible] = useState(false);
  const exportItemType = isNews
    ? "shopp-youtube-news-item"
    : isTutorials
      ? "shopp-youtube-tutorial"
      : isClassical
        ? "shopp-youtube-classical-playlist"
        : "shopp-youtube-playlist";
  const [clientId, setClientId] = useState(getWebClientId);
  const playlists = useQuery(
    contentApi.listMine,
    clientId
      ? isTutorialStyle
        ? { clientId, contentType: isNews ? "news" : "tutorial" }
        : { clientId, collectionType: isClassical ? "classical" : "playlist" }
      : "skip",
  );
  const createPlaylist = useMutation(contentApi.create);
  const replacePlaylists = useMutation(contentApi.replaceMine);
  const updatePlaylist = useMutation(contentApi.update);
  const removePlaylist = useMutation(contentApi.remove);
  const refreshNewsYouTubePublishedDates = useAction(
    api.tutorials.refreshNewsYouTubePublishedDates,
  );
  const refreshNewsDatesInFlight = useRef(false);
  const [newsDatesRefreshCycle, setNewsDatesRefreshCycle] = useState(0);
  const generateUploadUrl = useMutation(contentApi.generateUploadUrl);
  const [editorVisible, setEditorVisible] = useState(false);
  const { width } = useWindowDimensions();
  const canEditLyricsLocally =
    Platform.OS === "web" && width >= 960 && !isTutorialStyle;
  const [lyricsEditorIndex, setLyricsEditorIndex] = useState(null);
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [lyricsFileName, setLyricsFileName] = useState("lyrics.lrc");
  const [lyricsEditorVisible, setLyricsEditorVisible] = useState(false);
  const [lyricsEditorLoading, setLyricsEditorLoading] = useState(false);
  const [previewKey, setPreviewKey] = useState(null);
  useEffect(() => {
    if (!editorVisible) setPreviewKey(null);
  }, [editorVisible]);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [classicalDetails, setClassicalDetails] = useState({
    composer: "",
    performer: "",
    conductor: "",
    orchestra: "",
    period: "",
    year: "",
  });
  const [classicalDetailsExpanded, setClassicalDetailsExpanded] =
    useState(true);
  const [tracks, setTracks] = useState(initialTracks);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importModeVisible, setImportModeVisible] = useState(false);
  const [pendingImportAsset, setPendingImportAsset] = useState(null);
  const [exportNameVisible, setExportNameVisible] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [exportTarget, setExportTarget] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [searchText, setSearchText] = useState("");
  const searchTerms = useMemo(
    () => normalizeSearchText(searchText).split(/\s+/).filter(Boolean),
    [searchText],
  );
  const filteredPlaylists = useMemo(() => {
    const items = playlists ?? [];
    if (!searchTerms.length) return items;
    return items.filter((item) => {
      const text = normalizeSearchText(
        [
          item.title,
          item.composer,
          item.performer,
          item.conductor,
          item.orchestra,
          item.period,
          item.year,
          ...(item.tracks ?? []).map((track) => track.title),
        ].join(" "),
      );
      return searchTerms.every((term) => text.includes(term));
    });
  }, [playlists, searchTerms]);

  useEffect(() => {
    setSearchText("");
  }, [isClassical, isNews, isTutorials]);

  useEffect(() => {
    const hasPendingNewsDates = (playlists || []).some(
      (item) => !item.youtubePublishedCheckedAt,
    );
    if (
      !isNews ||
      !clientId ||
      !hasPendingNewsDates ||
      refreshNewsDatesInFlight.current
    )
      return;

    refreshNewsDatesInFlight.current = true;
    refreshNewsYouTubePublishedDates({ clientId })
      .then((result) => {
        // Cada acción procesa como máximo doce vídeos. El ciclo continúa solo
        // cuando se han encontrado registros pendientes.
        if (result?.checked) setNewsDatesRefreshCycle((value) => value + 1);
      })
      .catch((error) =>
        console.warn("No se pudieron actualizar las fechas de YouTube", error),
      )
      .finally(() => {
        refreshNewsDatesInFlight.current = false;
      });
  }, [
    clientId,
    isNews,
    newsDatesRefreshCycle,
    playlists,
    refreshNewsYouTubePublishedDates,
  ]);

  useEffect(() => {
    if (Platform.OS === "web" || clientId) return;
    let active = true;
    AsyncStorage.getItem(CLIENT_ID_KEY)
      .then(async (saved) => {
        const next = saved || createClientId();
        if (!saved) await AsyncStorage.setItem(CLIENT_ID_KEY, next);
        if (active) setClientId(next);
      })
      .catch(() => {
        if (active) setClientId(createClientId());
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  const canSave = useMemo(
    () =>
      Boolean(title.trim()) &&
      tracks.length >= minimumTracks &&
      tracks.length <= maximumTracks &&
      tracks.every((track) => {
        const parsed = parseYouTubeUrl(track.url.trim());
        if (isNews) return parsed.isValid && Boolean(parsed.videoId);
        return (
          parsed.isValid &&
          (track.kind === "album"
            ? Boolean(parsed.playlistId)
            : Boolean(parsed.videoId))
        );
      }) &&
      !saving,
    [isNews, minimumTracks, maximumTracks, saving, title, tracks],
  );

  const openNew = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setClassicalDetails({
      composer: "",
      performer: "",
      conductor: "",
      orchestra: "",
      period: "",
      year: "",
    });
    setTracks(initialTracks());
    setClassicalDetailsExpanded(true);
    setEditorVisible(true);
  }, [isTutorialStyle]);

  const openEdit = useCallback(
    async (item) => {
      setEditingId(item._id);
      setTitle(
        isNews
          ? item.tracks?.[0]?.title || item.title || ""
          : item.title || "",
      );
      setClassicalDetails({
        composer: item.composer || "",
        performer: item.performer || "",
        conductor: item.conductor || "",
        orchestra: item.orchestra || "",
        period: item.period || "",
        year: item.year || "",
      });
      setClassicalDetailsExpanded(false);
      const baseTracks = item.tracks.map((track, index) => ({
        kind: track.kind === "album" ? "album" : "single",
        title:
          track.title ||
          `${isTutorialStyle ? "Vídeo" : "Elemento"} ${index + 1}`,
        url:
          track.url ||
          (track.playlistId
            ? `https://www.youtube.com/playlist?list=${track.playlistId}`
            : `https://www.youtube.com/watch?v=${track.videoId || ""}`),
        lyrics: track.lyricsStorageId
          ? {
              existing: true,
              storageId: track.lyricsStorageId,
              fileName: track.lyricsFileName || "lyrics.lrc",
              mimeType: track.lyricsMimeType || "text/plain",
              size: track.lyricsSize || 0,
              sourceUri: track.lyricsUrl || track.lyricsUri || null,
            }
          : null,
        localLyrics: null,
      }));
      if (Platform.OS === "web" && !isTutorialStyle) {
        const hydrated = await Promise.all(
          baseTracks.map(async (track) => {
            try {
              const parsed = parseYouTubeUrl(track.url.trim());
              const local = await getLocalLyrics({
                kind: track.kind,
                videoId: parsed.videoId,
                playlistId: parsed.playlistId,
                url: track.url,
              });
              return local ? { ...track, localLyrics: local } : track;
            } catch {
              return track;
            }
          }),
        );
        setTracks(hydrated);
      } else {
        setTracks(baseTracks);
      }
      setEditorVisible(true);
    },
    [isNews, isTutorialStyle],
  );

  const updateTrack = useCallback((index, field, value) => {
    setTracks((current) =>
      current.map((track, currentIndex) =>
        currentIndex === index ? { ...track, [field]: value } : track,
      ),
    );
  }, []);

  const pickLyrics = useCallback(
    async (index) => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          // .lrc does not have a consistently registered MIME type. In
          // particular, iOS/iPadOS can disable valid LRC files when the picker
          // is restricted to text/plain. Allow selection here and validate the
          // extension and size below instead.
          type: "*/*",
          copyToCacheDirectory: true,
          multiple: false,
        });
        const asset = result.assets?.[0];
        if (result.canceled || !asset?.uri) return;
        const fileName = asset.name || "lyrics.lrc";
        if (!fileName.toLowerCase().endsWith(".lrc"))
          return safeAlert(
            "Formato no válido",
            "Selecciona un fichero con extensión .lrc.",
          );
        if ((asset.size || 0) > 512 * 1024)
          return safeAlert(
            "Fichero demasiado grande",
            "El fichero LRC no puede superar 512 KB.",
          );
        updateTrack(index, "lyrics", {
          uri: asset.uri,
          fileName,
          mimeType: "text/plain",
          size: asset.size || 0,
        });
      } catch (error) {
        safeAlert(
          "No se pudieron añadir las letras",
          error?.message || "Inténtalo de nuevo.",
        );
      }
    },
    [updateTrack],
  );

  const openLocalLyricsEditor = useCallback(
    async (index) => {
      const editorTrack = tracks[index];
      if (!editorTrack) return;
      const parsed = parseYouTubeUrl(editorTrack.url.trim());
      if (
        !parsed.isValid ||
        (editorTrack.kind === "album" ? !parsed.playlistId : !parsed.videoId)
      ) {
        safeAlert(
          "Enlace de YouTube requerido",
          "Introduce primero un enlace válido para esta canción.",
        );
        return;
      }
      setLyricsEditorIndex(index);
      setLyricsEditorVisible(true);
      setLyricsEditorLoading(true);
      try {
        const identity = {
          kind: editorTrack.kind,
          videoId: parsed.videoId,
          playlistId: parsed.playlistId,
          url: editorTrack.url,
        };
        const local = await getLocalLyrics(identity);
        if (local?.text != null) {
          setLyricsDraft(local.text);
          setLyricsFileName(local.fileName || "lyrics.lrc");
          return;
        }
        const sourceUri =
          editorTrack.lyrics?.uri || editorTrack.lyrics?.sourceUri;
        if (sourceUri) {
          const response = await fetch(sourceUri);
          const sourceText = response.ok ? await response.text() : "";
          setLyricsDraft(sourceText);
          setLyricsFileName(editorTrack.lyrics?.fileName || "lyrics.lrc");
        } else {
          setLyricsDraft("");
          setLyricsFileName(editorTrack.lyrics?.fileName || "lyrics.lrc");
        }
      } catch (error) {
        safeAlert(
          "No se pudo abrir la letra",
          error?.message || "Inténtalo de nuevo.",
        );
      } finally {
        setLyricsEditorLoading(false);
      }
    },
    [tracks],
  );

  const importLyricsIntoEditor = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
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
      const response = await fetch(asset.uri);
      setLyricsDraft(await response.text());
      setLyricsFileName(fileName);
    } catch (error) {
      safeAlert(
        "No se pudo importar la letra",
        error?.message || "Inténtalo de nuevo.",
      );
    }
  }, []);

  const saveLyricsEditor = useCallback(async () => {
    if (lyricsEditorIndex == null) return;
    const editorTrack = tracks[lyricsEditorIndex];
    if (!editorTrack) return;
    const parsed = parseYouTubeUrl(editorTrack.url.trim());
    if (!parsed.isValid) return;
    try {
      const identity = {
        kind: editorTrack.kind,
        videoId: parsed.videoId,
        playlistId: parsed.playlistId,
        url: editorTrack.url,
      };
      const record = await saveLocalLyrics(identity, lyricsDraft, {
        fileName: lyricsFileName || "lyrics.lrc",
      });
      setTracks((current) =>
        current.map((item, index) =>
          index === lyricsEditorIndex ? { ...item, localLyrics: record } : item,
        ),
      );
      setLyricsEditorVisible(false);
    } catch (error) {
      safeAlert(
        "No se pudo guardar la letra",
        error?.message || "Inténtalo de nuevo.",
      );
    }
  }, [lyricsDraft, lyricsEditorIndex, lyricsFileName, tracks]);

  const removeLocalLyricsFromEditor = useCallback(async () => {
    if (lyricsEditorIndex == null) return;
    const editorTrack = tracks[lyricsEditorIndex];
    if (!editorTrack) return;
    const parsed = parseYouTubeUrl(editorTrack.url.trim());
    if (!parsed.isValid) return;
    await removeLocalLyrics({
      kind: editorTrack.kind,
      videoId: parsed.videoId,
      playlistId: parsed.playlistId,
      url: editorTrack.url,
    });
    setTracks((current) =>
      current.map((item, index) =>
        index === lyricsEditorIndex ? { ...item, localLyrics: null } : item,
      ),
    );
    setLyricsDraft("");
    setLyricsEditorVisible(false);
  }, [lyricsEditorIndex, tracks]);

  const addTrack = useCallback(
    () =>
      setTracks((current) =>
        current.length >= maximumTracks
          ? current
          : [
              ...current,
              {
                kind: "single",
                title: `${isTutorialStyle ? "Vídeo" : isClassical ? "Obra" : "Single"} ${current.length + 1}`,
                url: "",
                lyrics: null,
              },
            ],
      ),
    [isClassical, isTutorialStyle, maximumTracks],
  );
  const removeTrack = useCallback(
    (index) => {
      const track = tracks[index];
      if (!track || saving || tracks.length <= minimumTracks) return;
      const trackTitle =
        track.title?.trim() ||
        `${isTutorialStyle ? "Vídeo" : "Elemento"} ${index + 1}`;
      safeAlert(
        isTutorialStyle
          ? isNews
            ? "Quitar vídeo de noticias"
            : "Quitar vídeo del tutorial"
          : "Quitar elemento de la playlist",
        `¿Quieres quitar «${trackTitle}»? El cambio se aplicará cuando guardes.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Borrar",
            style: "destructive",
            onPress: () =>
              setTracks((current) =>
                current.length <= minimumTracks
                  ? current
                  : current.filter((item) => item !== track),
              ),
          },
        ],
      );
    },
    [isNews, isTutorialStyle, minimumTracks, saving, tracks],
  );
  const moveTrack = useCallback((index, direction) => {
    setTracks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }, []);
  const dropTrack = useCallback(
    (targetIndex) => {
      if (draggingIndex === null || draggingIndex === targetIndex) return;
      setTracks((current) => {
        const next = [...current];
        const [moved] = next.splice(draggingIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
      setDraggingIndex(null);
    },
    [draggingIndex],
  );

  const uploadLyrics = useCallback(
    async (lyrics, index) => {
      if (!lyrics) return {};
      if (lyrics.existing)
        return {
          lyricsStorageId: lyrics.storageId,
          lyricsFileName: lyrics.fileName,
          lyricsMimeType: lyrics.mimeType,
          lyricsSize: lyrics.size,
        };
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(lyrics.uri);
      const blob = await response.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": lyrics.mimeType || "text/plain" },
        body: blob,
      });
      if (!uploadResponse.ok)
        throw new Error(
          `No se pudieron subir las letras del elemento ${index + 1}.`,
        );
      const { storageId } = await uploadResponse.json();
      return {
        lyricsStorageId: storageId,
        lyricsFileName: lyrics.fileName,
        lyricsMimeType: lyrics.mimeType || "text/plain",
        lyricsSize: lyrics.size || blob.size || 0,
      };
    },
    [generateUploadUrl],
  );

  const save = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const normalizedTracks = [];
      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index];
        const parsed = parseYouTubeUrl(track.url.trim());
        const lyrics = await uploadLyrics(track.lyrics, index);
        normalizedTracks.push({
          kind: isNews ? "single" : track.kind === "album" ? "album" : "single",
          videoId: parsed.videoId || undefined,
          playlistId: parsed.playlistId || undefined,
          title:
            (isNews ? title.trim() : track.title.trim()) ||
            `${track.kind === "album" ? "Álbum" : "Single"} ${index + 1}`,
          ...lyrics,
        });
      }
      const args = {
        clientId,
        ...(isTutorialStyle
          ? { contentType: isNews ? "news" : "tutorial" }
          : {}),
        title: title.trim(),
        tracks: normalizedTracks,
        ...(!isTutorialStyle
          ? {
              collectionType: isClassical ? "classical" : "playlist",
              ...(isClassical ? classicalDetails : {}),
            }
          : {}),
      };
      if (editingId) await updatePlaylist({ playlistId: editingId, ...args });
      else await createPlaylist(args);
      setEditorVisible(false);
    } catch (error) {
      safeAlert(
        isNews ? "No se pudo guardar la noticia" : `No se pudo guardar el ${collectionLabel}`,
        error?.message || "Revisa los enlaces de YouTube.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    classicalDetails,
    clientId,
    collectionLabel,
    createPlaylist,
    editingId,
    isClassical,
    isNews,
    isTutorialStyle,
    title,
    tracks,
    updatePlaylist,
    uploadLyrics,
  ]);

  const confirmRemove = useCallback(
    (item) =>
      safeConfirm(
        `Borrar ${collectionLabel}`,
        isNews
          ? `¿Quieres borrar «${item.title}»? Esta acción no se puede deshacer.`
          : `¿Quieres borrar «${item.title}» y todos sus elementos? Esta acción no se puede deshacer.`,
        async () => {
          setDeletingId(item._id);
          try {
            await removePlaylist({
              playlistId: item._id,
              clientId,
              ...(isTutorialStyle
                ? { contentType: isNews ? "news" : "tutorial" }
                : {}),
            });
          } catch (error) {
            safeAlert(
              "No se pudo borrar",
              error?.message || "Inténtalo de nuevo.",
            );
          } finally {
            setDeletingId(null);
          }
        },
        { confirmText: "Borrar", destructive: true },
      ),
    [clientId, collectionLabel, isNews, isTutorialStyle, removePlaylist],
  );

  const exportPlaylist = useCallback(
    async (item, fileName) => {
      try {
        await saveJsonFile(
          jsonFileName(fileName, safeFileName(item.title)),
          toExportedPlaylist(item, exportItemType),
        );
      } catch (error) {
        safeAlert(
          "No se pudo exportar",
          error?.message || "Inténtalo de nuevo.",
        );
      }
    },
    [exportItemType],
  );

  const defaultExportName = isNews
    ? "Noticias"
    : isTutorials
      ? "Tutoriales"
      : isClassical
        ? "Classic playlist"
        : "Music playlist";

  const exportAll = useCallback(
    async (fileName) => {
      try {
        await saveJsonFile(jsonFileName(fileName, defaultExportName), {
          version: 1,
          type: exportType,
          exportedAt: new Date().toISOString(),
          playlists: (playlists || []).map((item) =>
            toExportedPlaylist(item, exportItemType),
          ),
        });
      } catch (error) {
        safeAlert(
          "No se pudo exportar",
          error?.message || "Inténtalo de nuevo.",
        );
      }
    },
    [defaultExportName, exportItemType, exportType, playlists],
  );

  const openExportAll = useCallback(() => {
    setExportTarget(null);
    setExportFileName(defaultExportName);
    setExportNameVisible(true);
  }, [defaultExportName]);

  const openExportPlaylist = useCallback((item) => {
    setExportTarget(item);
    setExportFileName(item.title || "playlist");
    setExportNameVisible(true);
  }, []);

  const confirmExport = useCallback(async () => {
    const fileName = exportFileName.trim();
    if (!fileName) {
      safeAlert("Nombre requerido", "Escribe un nombre para el fichero JSON.");
      return;
    }
    setExportNameVisible(false);
    if (exportTarget) await exportPlaylist(exportTarget, fileName);
    else await exportAll(fileName);
  }, [exportAll, exportFileName, exportPlaylist, exportTarget]);
  const reorderPlaylist = useCallback(
    async (item, nextTracks) => {
      try {
        await updatePlaylist({
          playlistId: item._id,
          clientId,
          ...(isTutorialStyle
            ? { contentType: isNews ? "news" : "tutorial" }
            : {}),
          title: item.title,
          ...(!isTutorialStyle
            ? {
                collectionType: isClassical ? "classical" : "playlist",
                ...(isClassical
                  ? {
                      composer: item.composer,
                      performer: item.performer,
                      conductor: item.conductor,
                      orchestra: item.orchestra,
                      period: item.period,
                      year: item.year,
                    }
                  : {}),
              }
            : {}),
          tracks: nextTracks.map((track) => ({
            kind: track.kind === "album" ? "album" : "single",
            videoId: track.videoId || undefined,
            playlistId: track.playlistId || undefined,
            title: track.title,
            ...(track.lyricsStorageId
              ? {
                  lyricsStorageId: track.lyricsStorageId,
                  lyricsFileName: track.lyricsFileName,
                  lyricsMimeType: track.lyricsMimeType,
                  lyricsSize: track.lyricsSize,
                }
              : {}),
          })),
        });
      } catch (error) {
        safeAlert(
          "No se pudo reordenar",
          error?.message || "Inténtalo de nuevo.",
        );
      }
    },
    [clientId, isClassical, isNews, isTutorialStyle, updatePlaylist],
  );

  const importJsonFile = useCallback(async (asset, importMode = "combine") => {
    setImporting(true);
    try {
      if (!asset?.uri) return;
      const response = await fetch(asset.uri);
      const payload = JSON.parse(await response.text());
      const imported = parseImportedPayload(
        isNews ? normalizeNewsImportPayload(payload) : payload,
        exportItemType,
        exportType,
        minimumTracks,
        maximumTracks,
        isNews ? ["shopp-youtube-tutorial"] : [],
        isNews ? ["shopp-youtube-tutorials"] : [],
      );

      if (importMode === "replace") {
        await replacePlaylists({
          clientId,
          ...(isTutorialStyle
            ? { contentType: isNews ? "news" : "tutorial" }
            : { collectionType: isClassical ? "classical" : "playlist" }),
          items: imported,
        });
        safeAlert(
          "Importación terminada",
          `${imported.length} ${
            isNews
              ? "noticia"
              : isTutorials
                ? "tutorial"
                : isClassical
                  ? "colección"
                  : "playlist"
          }${
            imported.length === 1 ? "" : isClassical ? "es" : "s"
          } importada${imported.length === 1 ? "" : "s"}. Los elementos anteriores de esta utilidad se han reemplazado.`,
        );
        return;
      }

      const existingSignatures = new Set(
        (playlists || []).map(
          (item) =>
            `${item.title.toLowerCase()}|${item.tracks.map((track) => track.videoId || track.playlistId).join(",")}`,
        ),
      );
      let added = 0;
      let skipped = 0;
      for (const playlist of imported) {
        const signature = `${playlist.title.toLowerCase()}|${playlist.tracks.map((track) => track.videoId || track.playlistId).join(",")}`;
        if (existingSignatures.has(signature)) {
          skipped += 1;
          continue;
        }
        await createPlaylist({
          clientId,
          ...(isTutorialStyle
            ? { contentType: isNews ? "news" : "tutorial" }
            : {}),
          ...playlist,
        });
        existingSignatures.add(signature);
        added += 1;
      }
      safeAlert(
        "Importación terminada",
        `${added} ${
          isNews
            ? "noticia"
            : isTutorials
              ? "tutorial"
              : isClassical
                ? "colección"
                : "playlist"
        }${
          added === 1 ? "" : isClassical ? "es" : "s"
        } importada${added === 1 ? "" : "s"}.${
          skipped
            ? ` ${skipped} duplicada${
                skipped === 1 ? "" : "s"
              } omitida${skipped === 1 ? "" : "s"}.`
            : ""
        }`,
      );
    } catch (error) {
      safeAlert(
        "No se pudo importar",
        error instanceof SyntaxError
          ? "El fichero no contiene un JSON válido."
          : error?.message || "Revisa el fichero seleccionado.",
      );
    } finally {
      setImporting(false);
    }
  }, [
    clientId,
    createPlaylist,
    exportItemType,
    exportType,
    isClassical,
    isNews,
    isTutorialStyle,
    isTutorials,
    minimumTracks,
    maximumTracks,
    playlists,
    replacePlaylists,
  ]);

  const importJson = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;

      setPendingImportAsset(asset);
      setImportModeVisible(true);
    } catch (error) {
      safeAlert(
        "No se pudo importar",
        error?.message || "Revisa el fichero seleccionado.",
      );
    }
  }, []);

  const chooseImportMode = useCallback(
    async (importMode) => {
      const asset = pendingImportAsset;
      setImportModeVisible(false);
      setPendingImportAsset(null);
      await importJsonFile(asset, importMode);
    },
    [importJsonFile, pendingImportAsset],
  );

  const searchHeader = (
    <View style={styles.searchSection}>
      <View style={styles.searchBar}>
        <View style={styles.searchIcon}>
          <Ionicons name="search-outline" size={21} color="#64748b" />
        </View>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder={
            isNews
              ? "Buscar noticias…"
              : isTutorials
                ? "Buscar tutoriales…"
                : isClassical
                  ? "Buscar música clásica…"
                  : "Buscar playlists…"
          }
          accessibilityLabel={
            isNews
              ? "Buscar noticias"
              : isTutorials
                ? "Buscar tutoriales"
                : isClassical
                  ? "Buscar música clásica"
                  : "Buscar playlists"
          }
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searchText.length > 0 ? (
          <Pressable
            onPress={() => setSearchText("")}
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda"
            style={styles.clearSearchButton}
          >
            <Ionicons name="close-circle" size={21} color="#64748b" />
          </Pressable>
        ) : (
          <View style={styles.searchIcon} />
        )}
      </View>
      <Text style={styles.searchHint}>
        {isClassical
          ? "Busca por obra, compositor, intérprete, director, orquesta o periodo."
          : isNews
            ? "Busca por el título descriptivo."
            : "Busca en el título de la lista y de sus elementos."}
      </Text>
      {playlists !== undefined ? (
        <Text style={styles.searchCount} accessibilityLiveRegion="polite">
          {searchTerms.length
            ? `${filteredPlaylists.length} ${filteredPlaylists.length === 1 ? "coincidencia" : "coincidencias"} de ${playlists.length}`
            : `${playlists.length} ${isNews ? "noticias" : isTutorials ? "tutoriales" : isClassical ? "colecciones" : "playlists"}`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{collectionTitle}</Text>
          <Text style={styles.subtitle}>
            {isNews
              ? "Guarda un enlace de YouTube con un título descriptivo. Se ordenan por fecha de publicación."
              : isTutorials
                ? "Organiza vídeos y series de YouTube para aprender a tu ritmo."
                : isClassical
                  ? "Organiza obras, conciertos, intérpretes y grabaciones de YouTube."
                  : "Combina canciones individuales y álbumes de YouTube."}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {isTutorials ? (
            <Pressable
              onPress={() => setTransferVisible(true)}
              style={styles.secondaryButton}
            >
              <Ionicons name="copy-outline" size={21} color="#2563eb" />
              <Text style={styles.secondaryButtonText}>
                Copiar entre listas
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={importJson}
            disabled={importing}
            style={styles.secondaryButton}
          >
            <Ionicons name="download-outline" size={21} color="#2563eb" />
            <Text style={styles.secondaryButtonText}>
              {importing ? "Importando…" : "Importar"}
            </Text>
          </Pressable>
          {playlists?.length ? (
            <Pressable onPress={openExportAll} style={styles.secondaryButton}>
              <Ionicons name="share-outline" size={21} color="#2563eb" />
              <Text style={styles.secondaryButtonText}>
                {isNews ? "Exportar" : "Exportar todo"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={openNew} style={styles.newButton}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.newButtonText}>
              {isNews
                ? "Añadir noticia"
                : isTutorials
                  ? "Nuevo tutorial"
                  : isClassical
                    ? "Nueva colección"
                    : "Nueva playlist"}
            </Text>
          </Pressable>
        </View>
      </View>
      {playlists === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator color="#dc2626" />
        </View>
      ) : (
        <FlatList
          data={filteredPlaylists}
          ListHeaderComponent={searchHeader}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.list,
            !filteredPlaylists.length && styles.emptyList,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <View style={styles.playerCard}>
              <CustomYouTubePlaylistPlayer
                playlist={item}
                userName={
                  isNews
                    ? "Mis noticias"
                    : isTutorials
                      ? "Mis tutoriales"
                      : isClassical
                        ? [item.composer, item.performer]
                            .filter(Boolean)
                            .join(" · ") || "Música clásica"
                        : "Mi playlist"
                }
                isTutorial={isTutorialStyle}
                isNews={isNews}
                dateLabel={formatDate(
                  isNews ? item.youtubePublishedAt || item.updatedAt : item.updatedAt,
                )}
                canEdit
                canDelete
                deleting={deletingId === item._id}
                onEdit={() => openEdit(item)}
                onDelete={() => confirmRemove(item)}
                onExport={() => openExportPlaylist(item)}
                onReorder={(nextTracks) => reorderPlaylist(item, nextTracks)}
              />
            </View>
          )}
          ListEmptyComponent={
            searchTerms.length ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={46} color="#64748b" />
                <Text style={styles.emptyTitle}>No hay coincidencias</Text>
                <Text style={styles.emptyText}>
                  Prueba con otras palabras o limpia la búsqueda para ver todas
                  las listas.
                </Text>
                <Pressable
                  onPress={() => setSearchText("")}
                  accessibilityRole="button"
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Limpiar búsqueda</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="logo-youtube" size={46} color="#dc2626" />
                <Text style={styles.emptyTitle}>
                  {isNews
                    ? "Todavía no hay noticias"
                    : isTutorials
                      ? "Todavía no hay tutoriales"
                      : isClassical
                        ? "Todavía no hay música clásica"
                        : "Todavía no hay playlists"}
                </Text>
                <Text style={styles.emptyText}>
                  {isNews
                    ? "Añade una noticia con su título y enlace de YouTube, o importa una lista JSON."
                    : isTutorials
                      ? "Crea una colección con vídeos o series de YouTube."
                      : isClassical
                        ? "Crea una colección de obras o conciertos mediante sus enlaces de YouTube."
                        : "Crea una combinando singles o álbumes mediante sus enlaces de YouTube."}
                </Text>
                <Pressable onPress={openNew} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>
                    {isNews
                      ? "Añadir noticia"
                      : isTutorials
                        ? "Nuevo tutorial"
                        : isClassical
                          ? "Nueva colección"
                          : "Nueva playlist"}
                  </Text>
                </Pressable>
              </View>
            )
          }
        />
      )}
      {isTutorialStyle && transferVisible ? (
        <TutorialTransferScreen
          tutorials={playlists}
          clientId={clientId}
          contentType={isNews ? "news" : "tutorial"}
          collectionName={isNews ? "noticias" : "tutoriales"}
          onClose={() => setTransferVisible(false)}
        />
      ) : null}
      <Modal
        visible={importModeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!importing) {
            setImportModeVisible(false);
            setPendingImportAsset(null);
          }
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.importModeCard}>
            <Text style={styles.editorTitle}>Importar {collectionTitle}</Text>
            <Text style={styles.editorSubtitle}>
              Elige cómo incorporar el contenido del fichero JSON.
            </Text>
            <Pressable
              onPress={() => chooseImportMode("combine")}
              style={styles.importModeButton}
            >
              <Ionicons name="git-merge-outline" size={20} color="#2563eb" />
              <View style={styles.importModeButtonText}>
                <Text style={styles.importModeTitle}>Combinar</Text>
                <Text style={styles.importModeDescription}>
                  Conserva los elementos actuales y añade los nuevos. Los duplicados se omiten.
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => chooseImportMode("replace")}
              style={[styles.importModeButton, styles.importModeReplaceButton]}
            >
              <Ionicons name="trash-outline" size={20} color="#b91c1c" />
              <View style={styles.importModeButtonText}>
                <Text style={[styles.importModeTitle, styles.importModeReplaceTitle]}>
                  Reescribir todo
                </Text>
                <Text style={styles.importModeDescription}>
                  Elimina los elementos actuales de esta utilidad y los sustituye por los del fichero.
                </Text>
              </View>
            </Pressable>
            <View style={styles.importModeActions}>
              <Pressable
                onPress={() => {
                  setImportModeVisible(false);
                  setPendingImportAsset(null);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={exportNameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportNameVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.exportNameCard}>
            <Text style={styles.editorTitle}>
              {exportTarget
                ? `Exportar «${exportTarget.title}»`
                : "Nombre del fichero JSON"}
            </Text>
            <Text style={styles.editorSubtitle}>
              Escribe el nombre del fichero. Se añadirá automáticamente la
              extensión .json.
            </Text>
            <TextInput
              value={exportFileName}
              onChangeText={setExportFileName}
              placeholder={defaultExportName}
              autoFocus
              selectTextOnFocus
              style={styles.titleInput}
            />
            <View style={styles.exportNameActions}>
              <Pressable
                onPress={() => setExportNameVisible(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirmExport} style={styles.newButton}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={styles.newButtonText}>Exportar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !saving && setEditorVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.editorTitle}>
                  {isNews
                    ? editingId
                      ? "Editar noticia"
                      : "Añadir noticia"
                    : editingId
                      ? `Editar ${collectionLabel}`
                      : `Nuevo ${collectionLabel}`}
                </Text>
                <Text style={styles.editorSubtitle}>
                  {isNews
                    ? "Pega el enlace de YouTube y escribe un título descriptivo."
                    : isTutorials
                      ? "Añade vídeos y series mediante sus enlaces de YouTube."
                      : isClassical
                        ? "Añade obras o conciertos mediante sus enlaces de YouTube."
                        : "Añade singles o álbumes mediante sus enlaces de YouTube."}
                </Text>
              </View>
              <Pressable
                onPress={() => !saving && setEditorVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#475569" />
              </Pressable>
            </View>
            {!isNews ? <View style={styles.tutorialTypeHelp}>
              <View style={styles.tutorialTypeHelpItem}>
                <Ionicons
                  name={
                    isTutorialStyle
                      ? "play-circle-outline"
                      : "musical-note-outline"
                  }
                  size={21}
                  color="#2563eb"
                />
                <View style={styles.tutorialTypeHelpText}>
                  <Text style={styles.tutorialTypeHelpTitle}>
                    {isTutorialStyle
                      ? "Vídeo"
                      : isClassical
                        ? "Obra"
                        : "Single"}
                  </Text>
                  <Text style={styles.tutorialTypeHelpDescription}>
                    {isTutorialStyle
                      ? "Un único vídeo o capítulo de YouTube."
                      : isClassical
                        ? "Una obra, movimiento o interpretación individual."
                        : "Una canción o vídeo individual de YouTube."}
                  </Text>
                </View>
              </View>
              <View style={styles.tutorialTypeHelpItem}>
                <Ionicons
                  name={isTutorialStyle ? "list-outline" : "albums-outline"}
                  size={21}
                  color="#2563eb"
                />
                <View style={styles.tutorialTypeHelpText}>
                  <Text style={styles.tutorialTypeHelpTitle}>
                    {isTutorialStyle
                      ? "Serie"
                      : isClassical
                        ? "Concierto"
                        : "Álbum"}
                  </Text>
                  <Text style={styles.tutorialTypeHelpDescription}>
                    {isTutorialStyle
                      ? "Una playlist de YouTube con varios capítulos."
                      : isClassical
                        ? "Una playlist con varios movimientos u obras."
                        : "Una playlist de YouTube con varias canciones."}
                  </Text>
                </View>
              </View>
            </View> : null}
            {isClassical ? (
              <View style={styles.classicalSection}>
                <Pressable
                  onPress={() => setClassicalDetailsExpanded((value) => !value)}
                  style={styles.classicalSectionHeader}
                  accessibilityRole="button"
                  accessibilityLabel={
                    classicalDetailsExpanded
                      ? "Ocultar datos de la colección"
                      : "Mostrar datos de la colección"
                  }
                >
                  <View style={styles.classicalSectionHeaderText}>
                    <Text style={styles.classicalSectionTitle}>
                      Datos de la colección
                    </Text>
                    {!classicalDetailsExpanded ? (
                      <Text
                        style={styles.classicalSectionSummary}
                        numberOfLines={1}
                      >
                        {[
                          title,
                          classicalDetails.composer,
                          classicalDetails.performer,
                          classicalDetails.period,
                          classicalDetails.year,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin datos"}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={
                      classicalDetailsExpanded ? "chevron-up" : "chevron-down"
                    }
                    size={20}
                    color="#2563eb"
                  />
                </Pressable>

                {classicalDetailsExpanded ? (
                  <View style={styles.classicalSectionBody}>
                    <Text style={styles.label}>
                      Nombre de la obra o colección
                    </Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      maxLength={120}
                      placeholder="Concierto para piano n.º 5"
                      style={styles.titleInput}
                    />
                    <View style={styles.classicalDetails}>
                      {[
                        ["composer", "Compositor", "Ludwig van Beethoven"],
                        ["performer", "Intérprete", "Daniel Barenboim"],
                        ["conductor", "Director", "Nombre del director"],
                        ["orchestra", "Orquesta", "Nombre de la orquesta"],
                        ["period", "Periodo", "Clasicismo"],
                        ["year", "Año", "1809"],
                      ].map(([field, label, placeholder]) => (
                        <View key={field} style={styles.classicalField}>
                          <Text style={styles.label}>{label}</Text>
                          <TextInput
                            value={classicalDetails[field]}
                            onChangeText={(value) =>
                              setClassicalDetails((current) => ({
                                ...current,
                                [field]: value,
                              }))
                            }
                            maxLength={field === "year" ? 20 : 120}
                            placeholder={placeholder}
                            style={styles.compactClassicalInput}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : isNews ? (
              <View style={styles.newsEditorFields}>
                <Text style={styles.label}>Título descriptivo</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                  placeholder="Ej.: Análisis de la actualidad económica"
                  style={styles.titleInput}
                />
                <Text style={styles.label}>Enlace de YouTube</Text>
                <TextInput
                  value={tracks[0]?.url || ""}
                  onChangeText={(value) => updateTrack(0, "url", value)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://youtu.be/..."
                  style={styles.trackInput}
                />
              </View>
            ) : (
              <>
                <Text style={styles.label}>
                  {isNews
                    ? "Nombre de la colección de noticias"
                    : isTutorials
                      ? "Nombre del curso o colección"
                      : "Nombre del concierto o playlist"}
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                  placeholder={
                    isNews
                      ? "Actualidad nacional · Septiembre"
                      : isTutorials
                        ? "React Native · Curso de iniciación"
                        : "Mozart · Concierto para piano · Daniel Barenboim"
                  }
                  style={styles.titleInput}
                />
              </>
            )}
            {!isNews ? <ScrollView
              style={styles.tracksScroll}
              keyboardShouldPersistTaps="handled"
            >
              {tracks.map((track, index) => (
                <View
                  key={`track-${index}`}
                  draggable={Platform.OS === "web"}
                  onDragStart={() => setDraggingIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropTrack(index)}
                  style={[
                    styles.trackEditor,
                    draggingIndex === index && styles.trackEditorDragging,
                  ]}
                >
                  <View style={styles.trackHeader}>
                    <Text style={styles.trackNumber}>ELEMENTO {index + 1}</Text>
                    <View style={styles.trackOrderActions}>
                      <Pressable
                        onPress={() => moveTrack(index, -1)}
                        disabled={index === 0}
                        style={styles.orderButton}
                        accessibilityLabel="Subir elemento"
                      >
                        <Ionicons
                          name="chevron-up"
                          size={18}
                          color={index === 0 ? "#cbd5e1" : "#2563eb"}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => moveTrack(index, 1)}
                        disabled={index === tracks.length - 1}
                        style={styles.orderButton}
                        accessibilityLabel="Bajar elemento"
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={
                            index === tracks.length - 1 ? "#cbd5e1" : "#2563eb"
                          }
                        />
                      </Pressable>
                      {tracks.length > minimumTracks ? (
                        <Pressable
                          onPress={() => removeTrack(index)}
                          style={styles.removeButton}
                          accessibilityLabel="Eliminar elemento"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#dc2626"
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.kindRow}>
                    <Pressable
                      onPress={() => updateTrack(index, "kind", "single")}
                      style={[
                        styles.kindButton,
                        track.kind !== "album" && styles.kindActive,
                      ]}
                    >
                      <Ionicons
                        name={
                          isTutorialStyle
                            ? "play-circle-outline"
                            : "musical-note-outline"
                        }
                        size={16}
                        color={track.kind !== "album" ? "#fff" : "#475569"}
                      />
                      <Text
                        style={[
                          styles.kindText,
                          track.kind !== "album" && styles.kindTextActive,
                        ]}
                      >
                        {isTutorialStyle
                          ? "Vídeo"
                          : isClassical
                            ? "Obra"
                            : "Single"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateTrack(index, "kind", "album")}
                      style={[
                        styles.kindButton,
                        track.kind === "album" && styles.kindActive,
                      ]}
                    >
                      <Ionicons
                        name={
                          isTutorialStyle ? "list-outline" : "albums-outline"
                        }
                        size={16}
                        color={track.kind === "album" ? "#fff" : "#475569"}
                      />
                      <Text
                        style={[
                          styles.kindText,
                          track.kind === "album" && styles.kindTextActive,
                        ]}
                      >
                        {isTutorialStyle
                          ? "Serie"
                          : isClassical
                            ? "Concierto"
                            : "Álbum"}
                      </Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={track.title}
                    onChangeText={(value) => updateTrack(index, "title", value)}
                    maxLength={120}
                    placeholder={
                      isTutorialStyle
                        ? track.kind === "album"
                          ? "Título de la serie"
                          : "Título del vídeo"
                        : track.kind === "album"
                          ? isClassical
                            ? "Título del concierto o ciclo"
                            : "Título del álbum"
                          : isClassical
                            ? "I. Allegro"
                            : "Título del single"
                    }
                    style={styles.trackInput}
                  />
                  <TextInput
                    value={track.url}
                    onChangeText={(value) => updateTrack(index, "url", value)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={
                      track.kind === "album"
                        ? "https://youtube.com/playlist?list=..."
                        : "https://youtu.be/..."
                    }
                    style={styles.trackInput}
                  />
                  {isTutorialStyle && editorVisible ? (
                    <EditorVideoPreview
                      track={track}
                      active={
                        previewKey === `${index}:${track.kind}:${track.url}`
                      }
                      disabled={saving}
                      onToggle={() => {
                        const key = `${index}:${track.kind}:${track.url}`;
                        setPreviewKey((current) =>
                          current === key ? null : key,
                        );
                      }}
                    />
                  ) : null}
                  {!isTutorialStyle ? (
                    <View style={styles.lyricsRow}>
                      <Pressable
                        onPress={() =>
                          canEditLyricsLocally
                            ? openLocalLyricsEditor(index)
                            : pickLyrics(index)
                        }
                        style={styles.lyricsButton}
                      >
                        <Ionicons
                          name={
                            track.localLyrics
                              ? "create-outline"
                              : "document-text-outline"
                          }
                          size={20}
                          color="#2563eb"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lyricsTitle} numberOfLines={1}>
                            {track.localLyrics?.fileName ||
                              track.lyrics?.fileName ||
                              (canEditLyricsLocally
                                ? "Editar letra local"
                                : "Añadir letras .lrc")}
                          </Text>
                          <Text style={styles.lyricsHint}>
                            {track.localLyrics
                              ? "Guardada en IndexedDB · privada en este navegador"
                              : canEditLyricsLocally
                                ? "Crear, pegar o importar .lrc · guardado local"
                                : "Opcional · máximo 512 KB"}
                          </Text>
                        </View>
                      </Pressable>
                      {canEditLyricsLocally ? (
                        <Pressable
                          onPress={() => openLocalLyricsEditor(index)}
                          style={styles.removeLyrics}
                          accessibilityLabel="Editar letra"
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={20}
                            color="#2563eb"
                          />
                        </Pressable>
                      ) : track.lyrics ? (
                        <Pressable
                          onPress={() => updateTrack(index, "lyrics", null)}
                          style={styles.removeLyrics}
                        >
                          <Ionicons
                            name="close-circle"
                            size={21}
                            color="#dc2626"
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}
              {tracks.length < maximumTracks ? (
                <Pressable onPress={addTrack} style={styles.addButton}>
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#dc2626"
                  />
                  <Text style={styles.addText}>Añadir elemento</Text>
                </Pressable>
              ) : null}
            </ScrollView> : null}
            {!isNews ? <Text style={styles.editorSubtitle}>
              {tracks.length} / {maximumTracks} elementos
            </Text> : null}
            <View style={styles.actions}>
              <Pressable
                onPress={() => setEditorVisible(false)}
                disabled={saving}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={!canSave}
                style={[styles.saveButton, !canSave && styles.disabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>
                    {editingId ? "Guardar cambios" : `Crear ${collectionLabel}`}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={lyricsEditorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLyricsEditorVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.lyricsEditorCard}>
            <View style={styles.editorHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.editorTitle}>Editar letra .lrc</Text>
                <Text style={styles.editorSubtitle} numberOfLines={1}>
                  {lyricsEditorIndex != null
                    ? tracks[lyricsEditorIndex]?.title
                    : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => setLyricsEditorVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#475569" />
              </Pressable>
            </View>
            <TextInput
              value={lyricsFileName}
              onChangeText={setLyricsFileName}
              placeholder="lyrics.lrc"
              style={styles.trackInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              value={lyricsDraft}
              onChangeText={setLyricsDraft}
              multiline
              textAlignVertical="top"
              editable={!lyricsEditorLoading}
              placeholder={"[00:00.00]Primera línea\n[00:05.20]Segunda línea"}
              style={styles.lyricsTextArea}
            />
            <View style={styles.lyricsEditorActions}>
              <Pressable
                onPress={importLyricsIntoEditor}
                style={styles.lyricsSecondaryButton}
              >
                <Ionicons
                  name="folder-open-outline"
                  size={18}
                  color="#2563eb"
                />
                <Text style={styles.lyricsSecondaryText}>Importar .lrc</Text>
              </Pressable>
              <Pressable
                onPress={removeLocalLyricsFromEditor}
                style={styles.lyricsSecondaryButton}
              >
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
                <Text
                  style={[styles.lyricsSecondaryText, { color: "#dc2626" }]}
                >
                  Borrar local
                </Text>
              </Pressable>
              <Pressable
                onPress={saveLyricsEditor}
                style={styles.lyricsSaveButton}
              >
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.lyricsSaveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  classicalDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  classicalField: { flexGrow: 1, flexBasis: 210, minWidth: 180 },
  trackOrderActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  trackEditorDragging: {
    opacity: 0.55,
    borderColor: "#2563eb",
    borderStyle: "dashed",
  },
  orderButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  screen: { flex: 1, backgroundColor: "#f4f7fb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
    flexWrap: "wrap",
  },
  headerText: { flex: 1, minWidth: 220 },
  heading: { fontSize: 22, fontWeight: "900", color: "#111827" },
  subtitle: { marginTop: 3, fontSize: 12, color: "#64748b" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  secondaryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "800", color: "#2563eb" },
  newButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    backgroundColor: "#dc2626",
  },
  newButtonText: { fontWeight: "800", color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchSection: {
    width: 560,
    maxWidth: "100%",
    alignSelf: "center",
    paddingBottom: 14,
    gap: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingHorizontal: 10,
    color: "#111827",
    fontSize: 15,
    textAlign: "left",
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  },
  searchIcon: {
    width: 44,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  clearSearchButton: {
    width: 44,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  searchHint: { fontSize: 12, color: "#64748b", textAlign: "center" },
  searchCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textAlign: "center",
  },
  list: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 14 },
  playerCard: { alignItems: "center" },
  emptyList: { flexGrow: 1 },
  empty: { alignItems: "center", padding: 24 },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  emptyText: {
    maxWidth: 410,
    marginTop: 7,
    textAlign: "center",
    color: "#64748b",
  },
  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: "#dc2626",
  },
  emptyButtonText: { fontWeight: "800", color: "#fff" },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  editorCard: {
    width: "100%",
    maxWidth: 750,
    // A fixed available height lets the internal list shrink and scroll instead
    // of pushing the Cancel/Save actions below the viewport on web or mobile.
    height: "92%",
    maxHeight: "92%",
    padding: 14,
    backgroundColor: "#fff",
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  editorTitle: { fontSize: 20, fontWeight: "900", color: "#111827" },
  editorSubtitle: { marginTop: 3, fontSize: 12, color: "#64748b" },
  newsEditorFields: { gap: 8, paddingTop: 8, paddingBottom: 12 },
  tutorialTypeHelp: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: -4,
    marginBottom: 14,
  },
  tutorialTypeHelpItem: {
    flex: 1,
    minWidth: 245,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  tutorialTypeHelpText: { flex: 1 },
  tutorialTypeHelpTitle: { fontSize: 12, fontWeight: "900", color: "#1d4ed8" },
  tutorialTypeHelpDescription: { marginTop: 2, fontSize: 10, color: "#475569" },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  label: { marginBottom: 7, fontSize: 12, fontWeight: "900", color: "#334155" },
  titleInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    color: "#111827",
  },
  classicalSection: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#f8fafc",
  },
  classicalSectionHeader: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  classicalSectionHeaderText: { flex: 1, minWidth: 0 },
  classicalSectionTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  classicalSectionSummary: {
    marginTop: 3,
    fontSize: 11,
    color: "#64748b",
  },
  classicalSectionBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  compactClassicalInput: {
    minHeight: 40,
    marginTop: 0,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    color: "#111827",
  },
  tracksScroll: {
    marginTop: 10,
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  trackEditor: {
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#f8fafc",
  },
  trackHeader: { flexDirection: "row", alignItems: "center" },
  trackNumber: { flex: 1, fontSize: 11, fontWeight: "900", color: "#dc2626" },
  removeButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  kindRow: { flexDirection: "row", marginTop: 6 },
  kindButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  kindActive: { borderColor: "#dc2626", backgroundColor: "#dc2626" },
  kindText: { fontSize: 12, fontWeight: "800", color: "#475569" },
  kindTextActive: { color: "#fff" },
  trackInput: {
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    color: "#111827",
  },
  lyricsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  lyricsButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  lyricsTitle: { fontSize: 12, fontWeight: "800", color: "#2563eb" },
  lyricsHint: { marginTop: 2, fontSize: 10, color: "#64748b" },
  removeLyrics: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  lyricsEditorCard: {
    width: 760,
    maxWidth: "94%",
    maxHeight: "88%",
    padding: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  exportNameCard: {
    width: 460,
    maxWidth: "92%",
    gap: 12,
    padding: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  importModeCard: {
    width: 520,
    maxWidth: "92%",
    gap: 12,
    padding: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  importModeButton: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  importModeReplaceButton: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  importModeButtonText: { flex: 1, minWidth: 0 },
  importModeTitle: { fontSize: 14, fontWeight: "900", color: "#1d4ed8" },
  importModeReplaceTitle: { color: "#b91c1c" },
  importModeDescription: { marginTop: 3, fontSize: 12, color: "#475569" },
  importModeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  exportNameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  lyricsTextArea: {
    minHeight: 360,
    maxHeight: 520,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  lyricsEditorActions: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  lyricsSecondaryButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  lyricsSecondaryText: { fontSize: 12, fontWeight: "800", color: "#2563eb" },
  lyricsSaveButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    backgroundColor: "#dc2626",
  },
  lyricsSaveText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  addButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#f87171",
  },
  addText: { fontWeight: "800", color: "#b91c1c" },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
    flexShrink: 0,
  },
  cancelButton: {
    minWidth: 115,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  cancelText: { fontWeight: "800", color: "#475569" },
  saveButton: {
    minWidth: 155,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  disabled: { opacity: 0.4 },
  saveText: { fontWeight: "900", color: "#fff" },
});
