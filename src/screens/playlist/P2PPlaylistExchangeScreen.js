import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { libraryJsonApi } from "@/src/services/libraryJsonApi";
import { loadRecipes, saveRecipes, normalizeRecipe } from "@/src/services/recipesStorage";

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const P2P_CHUNK_SIZE = 48 * 1024;
const CLIENT_ID_KEY = "shopp-playlist-client-id";

// Los mensajes del RTCDataChannel se codifican explícitamente como UTF-8.
// Así evitamos que Safari/iPad interprete á, é, í, ó, ú, ñ, ü como Latin-1.
const UTF8_ENCODER = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const UTF8_DECODER = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;


function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint8Array(6))
    : Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    throw new Error("No se pudo preparar el mensaje P2P.");
  }
}

function encodeP2PMessage(value) {
  const text = safeJson(value);
  return UTF8_ENCODER ? UTF8_ENCODER.encode(text) : text;
}

async function decodeP2PMessage(data) {
  if (typeof data === "string") return data;

  let bytes = null;
  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (typeof Blob !== "undefined" && data instanceof Blob) {
    bytes = new Uint8Array(await data.arrayBuffer());
  }

  if (bytes) {
    if (UTF8_DECODER) return UTF8_DECODER.decode(bytes);
    // Fallback para runtimes antiguos sin TextDecoder.
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(binary));
  }

  return String(data ?? "");
}

function sendP2PJson(channel, value) {
  channel.send(encodeP2PMessage(value));
}

function getOrCreateDeviceId() {
  if (Platform.OS !== "web" || typeof window === "undefined") return "native-device";
  const key = "shopp-p2p-device-id";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, value);
  }
  return value;
}

function createPlaylistClientId() {
  return globalThis.crypto?.randomUUID?.() || `playlist_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getPlaylistClientId() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    let value = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!value) {
      value = createPlaylistClientId();
      window.localStorage.setItem(CLIENT_ID_KEY, value);
    }
    return value;
  } catch {
    return createPlaylistClientId();
  }
}

function toP2PPlaylist(playlist, collectionType = "playlist") {
  const isClassical = collectionType === "classical";
  return {
    version: 2,
    type: isClassical ? "shopp-youtube-classical-playlist" : "shopp-youtube-playlist",
    collectionType: isClassical ? "classical" : "playlist",
    title: String(playlist?.title || "Playlist").trim() || "Playlist",
    ...(isClassical ? {
      composer: String(playlist?.composer || "").trim(),
      performer: String(playlist?.performer || "").trim(),
      conductor: String(playlist?.conductor || "").trim(),
      orchestra: String(playlist?.orchestra || "").trim(),
      period: String(playlist?.period || "").trim(),
      year: String(playlist?.year || "").trim(),
    } : {}),
    tracks: Array.isArray(playlist?.tracks)
      ? playlist.tracks.map((track, index) => ({
          kind: track?.kind === "album" ? "album" : "single",
          title: String(track?.title || `Item ${index + 1}`).trim() || `Item ${index + 1}`,
          videoId: track?.videoId || undefined,
          playlistId: track?.playlistId || undefined,
          url:
            track?.url ||
            (track?.playlistId
              ? `https://www.youtube.com/playlist?list=${track.playlistId}`
              : `https://www.youtube.com/watch?v=${track?.videoId || ""}`),
        }))
      : [],
  };
}

function extractYouTubeIds(track) {
  const kind = track?.kind === "album" ? "album" : "single";
  let videoId = String(track?.videoId || "").trim();
  let playlistId = String(track?.playlistId || "").trim();
  const rawUrl = String(track?.url || "").trim();

  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (!playlistId) playlistId = String(url.searchParams.get("list") || "").trim();
      if (!videoId) {
        if (host === "youtu.be") {
          videoId = url.pathname.split("/").filter(Boolean)[0] || "";
        } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
          videoId = String(url.searchParams.get("v") || "").trim();
          if (!videoId) {
            const parts = url.pathname.split("/").filter(Boolean);
            if (["shorts", "embed", "live"].includes(parts[0])) videoId = parts[1] || "";
          }
        }
      }
    } catch {
      // Si la URL no es válida, los validadores posteriores darán un error claro.
    }
  }

  if (kind === "album") {
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(playlistId)) {
      throw new Error(`No se pudo identificar la playlist/álbum «${track?.title || "sin título"}».`);
    }
    return { kind, playlistId, title: String(track?.title || "Álbum").trim() || "Álbum" };
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error(`No se pudo identificar el vídeo «${track?.title || "sin título"}».`);
  }
  return { kind, videoId, title: String(track?.title || "Single").trim() || "Single" };
}

function normalizeReceivedMediaCollection(payload, contentType = "music") {
  const tracks = Array.isArray(payload?.tracks)
    ? payload.tracks.map(extractYouTubeIds)
    : [];
  if (tracks.length === 0) throw new Error("El contenido recibido no contiene items válidos.");
  const collectionType = contentType === "classical" ? "classical" : "playlist";
  return {
    title: String(payload?.title || "Contenido recibido").trim() || "Contenido recibido",
    tracks,
    collectionType,
    ...(collectionType === "classical" ? {
      composer: String(payload?.composer || "").trim(),
      performer: String(payload?.performer || "").trim(),
      conductor: String(payload?.conductor || "").trim(),
      orchestra: String(payload?.orchestra || "").trim(),
      period: String(payload?.period || "").trim(),
      year: String(payload?.year || "").trim(),
    } : {}),
  };
}

function toP2PTutorial(item, contentType = "tutorial") {
  return {
    version: 1,
    type: contentType === "news" ? "shopp-youtube-news-item" : "shopp-youtube-tutorial",
    title: String(item?.title || (contentType === "news" ? "Noticia" : "Tutorial")).trim(),
    tracks: Array.isArray(item?.tracks) ? item.tracks.map((track, index) => ({
      kind: track?.kind === "album" ? "album" : "single",
      title: String(track?.title || `Item ${index + 1}`).trim() || `Item ${index + 1}`,
      videoId: track?.videoId || undefined,
      playlistId: track?.playlistId || undefined,
      url: track?.url || (track?.playlistId
        ? `https://www.youtube.com/playlist?list=${track.playlistId}`
        : `https://www.youtube.com/watch?v=${track?.videoId || ""}`),
    })) : [],
  };
}

function contentSignature(item) {
  if (item?.youtubeUrl) return `recipe:${String(item.title || "").toLowerCase()}::${String(item.youtubeUrl || "")}`;
  return playlistSignature(item);
}

function playlistSignature(playlist) {
  const title = String(playlist?.title || "").trim().toLocaleLowerCase();
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const media = tracks.map((track) => {
    const kind = track?.kind === "album" ? "album" : "single";
    return kind === "album"
      ? `album:${String(track?.playlistId || "").trim()}`
      : `single:${String(track?.videoId || "").trim()}`;
  });
  return `${title}::${media.join("|")}`;
}

function downloadJson(payload) {
  const text = JSON.stringify(payload, null, 2);
  if (Platform.OS !== "web" || typeof document === "undefined") {
    safeAlert("Playlist recibida", "La prueba ha recibido el JSON correctamente.");
    return;
  }
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "shopp-contenido-p2p.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Status({ tone = "neutral", children }) {
  return <View style={[styles.status, styles[`status_${tone}`]]}><Text style={[styles.statusText, styles[`statusText_${tone}`]]}>{children}</Text></View>;
}

const P2P_CHANNELS = [
  "idiomas", "tutoriales", "literatura", "deportes",
  "musica", "clasica", "recetas", "noticias",
  "ingenieria", "programacion", "ciencia", "historia",
];

export default function P2PPlaylistExchangeScreen() {
  const [alias, setAlias] = useState("");
  const [channels, setChannels] = useState(() => new Set(["tutoriales"]));
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [playlistClientId] = useState(() => getPlaylistClientId());
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState("idle");
  const [selectedContentKeys, setSelectedContentKeys] = useState(() => new Set());
  const [receivedContent, setReceivedContent] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [librarySync, setLibrarySync] = useState(null);

  const currentUser = useQuery(api.users.current);
  const hasP2PAccess =
    currentUser?.isAdmin === true ||
    currentUser?.permissions?.p2pPlaylistExchange === true;
  const p2pQueryArgs = hasP2PAccess && deviceId ? { deviceId } : "skip";
  const musicPlaylists = useQuery(
    api.playlists.listMine,
    hasP2PAccess && playlistClientId
      ? { clientId: playlistClientId, collectionType: "playlist" }
      : "skip",
  );
  const classicalPlaylists = useQuery(
    api.playlists.listMine,
    hasP2PAccess && playlistClientId
      ? { clientId: playlistClientId, collectionType: "classical" }
      : "skip",
  );
  const tutorials = useQuery(
    api.tutorials.listMine,
    hasP2PAccess && playlistClientId
      ? { clientId: playlistClientId, contentType: "tutorial" }
      : "skip",
  );
  const newsItems = useQuery(
    api.tutorials.listMine,
    hasP2PAccess && playlistClientId
      ? { clientId: playlistClientId, contentType: "news" }
      : "skip",
  );

  const shareGroups = useMemo(() => [
    { type: "music", label: "Música", icon: "musical-notes-outline", items: musicPlaylists || [] },
    { type: "classical", label: "Música clásica", icon: "musical-note-outline", items: classicalPlaylists || [] },
    { type: "tutorial", label: "Tutoriales", icon: "school-outline", items: tutorials || [] },
    { type: "news", label: "Noticias", icon: "newspaper-outline", items: newsItems || [] },
    { type: "recipe", label: "Recetas", icon: "restaurant-outline", items: recipes || [] },
  ], [classicalPlaylists, musicPlaylists, newsItems, recipes, tutorials]);

  const selectedContent = useMemo(() => {
    const result = [];
    for (const group of shareGroups) {
      for (const item of group.items) {
        const itemId = String(item?._id || item?.id || "");
        const key = `${group.type}:${itemId}`;
        if (itemId && selectedContentKeys.has(key)) result.push({ ...group, item });
      }
    }
    return result;
  }, [selectedContentKeys, shareGroups]);

  // No se consulta presencia hasta que Convex haya confirmado una sesión y
  // el permiso. Así una cookie antigua no deja la PWA en blanco.
  const myPresence = useQuery(api.nearbyShare.getMyPresence, p2pQueryArgs);
  const peers = useQuery(api.nearbyShare.listVisiblePeers, p2pQueryArgs);
  const pairings = useQuery(api.nearbyShare.listPairings, p2pQueryArgs);
  const activePairing = useMemo(
    () => pairings?.find((item) => item.status === "accepted") || null,
    [pairings],
  );
  const signals = useQuery(
    api.nearbyShare.listSignals,
    activePairing ? { pairingId: activePairing._id, deviceId } : "skip",
  );

  const enablePresence = useMutation(api.nearbyShare.enablePresence);
  const disablePresence = useMutation(api.nearbyShare.disablePresence);
  const requestPairing = useMutation(api.nearbyShare.requestPairing);
  const respondToPairing = useMutation(api.nearbyShare.respondToPairing);
  const sendSignal = useMutation(api.nearbyShare.sendSignal);
  const closePairing = useMutation(api.nearbyShare.closePairing);
  const createPlaylist = useMutation(api.playlists.create);
  const createTutorial = useMutation(api.tutorials.create);

  const peerRef = useRef(null);
  const dataChannelRef = useRef(null);
  const appliedSignalsRef = useRef(new Set());
  const queuedIceCandidatesRef = useRef([]);
  const offerStartedForRef = useRef(null);
  const incomingLibrarySyncRef = useRef(new Map());
  const musicPlaylistsRef = useRef([]);
  const classicalPlaylistsRef = useRef([]);
  const tutorialsRef = useRef([]);
  const newsItemsRef = useRef([]);
  const recipesRef = useRef([]);
  const importedContentSignaturesRef = useRef(new Set());

  useEffect(() => { musicPlaylistsRef.current = Array.isArray(musicPlaylists) ? musicPlaylists : []; }, [musicPlaylists]);
  useEffect(() => { classicalPlaylistsRef.current = Array.isArray(classicalPlaylists) ? classicalPlaylists : []; }, [classicalPlaylists]);
  useEffect(() => { tutorialsRef.current = Array.isArray(tutorials) ? tutorials : []; }, [tutorials]);
  useEffect(() => { newsItemsRef.current = Array.isArray(newsItems) ? newsItems : []; }, [newsItems]);
  useEffect(() => { recipesRef.current = recipes; }, [recipes]);
  useEffect(() => {
    let disposed = false;
    loadRecipes().then((items) => { if (!disposed) setRecipes(items); }).catch(() => {});
    return () => { disposed = true; };
  }, []);

  const closePeer = useCallback(() => {
    dataChannelRef.current?.close?.();
    peerRef.current?.close?.();
    dataChannelRef.current = null;
    peerRef.current = null;
    appliedSignalsRef.current.clear();
    queuedIceCandidatesRef.current = [];
    offerStartedForRef.current = null;
    setConnection("idle");
  }, []);

  const sendLibrarySnapshot = useCallback(async (phase = "offer", syncId = randomCode()) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      throw new Error("La conexión P2P todavía no está lista.");
    }
    const snapshot = await libraryJsonApi.getSyncSnapshot();
    const payload = JSON.stringify(snapshot);
    const totalChunks = Math.max(1, Math.ceil(payload.length / P2P_CHUNK_SIZE));
    sendP2PJson(channel, {
      type: "LIBRARY_SYNC_START",
      syncId,
      phase,
      totalChunks,
      linkCount: snapshot.links.length,
      folderCount: snapshot.folders.length,
    });
    for (let index = 0; index < totalChunks; index += 1) {
      const chunk = payload.slice(index * P2P_CHUNK_SIZE, (index + 1) * P2P_CHUNK_SIZE);
      sendP2PJson(channel, { type: "LIBRARY_SYNC_CHUNK", syncId, phase, index, chunk });
      // Deja respirar al DataChannel y evita llenar su buffer con bibliotecas grandes.
      if (index % 8 === 7) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    sendP2PJson(channel, { type: "LIBRARY_SYNC_END", syncId, phase });
    setLibrarySync((current) => ({
      ...(current || {}),
      syncId,
      state: phase === "offer" ? "sent" : "reply-sent",
      sentLinks: snapshot.links.length,
      sentChunks: totalChunks,
    }));
    return syncId;
  }, []);

  const handleLibraryMessage = useCallback(async (message) => {
    const key = `${message.syncId}:${message.phase}`;
    if (message.type === "LIBRARY_SYNC_START") {
      incomingLibrarySyncRef.current.set(key, {
        totalChunks: Number(message.totalChunks) || 0,
        chunks: [],
        linkCount: Number(message.linkCount) || 0,
      });
      setLibrarySync({
        syncId: message.syncId,
        state: "receiving",
        receivingLinks: Number(message.linkCount) || 0,
        receivedChunks: 0,
        totalChunks: Number(message.totalChunks) || 0,
      });
      return true;
    }
    if (message.type === "LIBRARY_SYNC_CHUNK") {
      const transfer = incomingLibrarySyncRef.current.get(key);
      if (!transfer) return true;
      transfer.chunks[Number(message.index)] = message.chunk || "";
      const receivedChunks = transfer.chunks.filter((chunk) => typeof chunk === "string").length;
      setLibrarySync((current) => ({ ...(current || {}), state: "receiving", receivedChunks, totalChunks: transfer.totalChunks }));
      return true;
    }
    if (message.type === "LIBRARY_SYNC_END") {
      const transfer = incomingLibrarySyncRef.current.get(key);
      if (!transfer) return true;
      incomingLibrarySyncRef.current.delete(key);
      if (transfer.chunks.filter((chunk) => typeof chunk === "string").length !== transfer.totalChunks) {
        throw new Error("La Biblioteca P2P llegó incompleta. Vuelve a sincronizar.");
      }
      const snapshot = JSON.parse(transfer.chunks.join(""));
      setLibrarySync((current) => ({ ...(current || {}), state: "merging" }));
      const result = await libraryJsonApi.applySyncSnapshot(snapshot);
      setLibrarySync((current) => ({ ...(current || {}), state: "merged", result }));
      if (message.phase === "offer") {
        await sendLibrarySnapshot("reply", message.syncId);
      } else {
        safeAlert(
          "Biblioteca sincronizada",
          `Sincronización completada. ${result.linksCreated} nuevos, ${result.linksUpdated} actualizados y ${result.archivedApplied} archivados aplicados.`,
        );
      }
      return true;
    }
    return false;
  }, [sendLibrarySnapshot]);

  const bindDataChannel = useCallback((channel) => {
    dataChannelRef.current = channel;
    channel.onopen = () => {
      setConnection("connected");
      sendP2PJson(channel, { type: "PROFILE", profile: { displayName: alias.trim() || myPresence?.displayName || "Shopp", channels: [...channels] } });
    };
    channel.onclose = () => setConnection("closed");
    channel.onerror = () => setConnection("failed");
    channel.binaryType = "arraybuffer";
    channel.onmessage = async (event) => {
      try {
        const messageText = await decodeP2PMessage(event.data);
        const message = JSON.parse(messageText);
        if (await handleLibraryMessage(message)) return;
        if (message?.type === "PROFILE") {
          setChatMessages((current) => [{ id: `profile-${Date.now()}`, kind: "profile", incoming: true, profile: message.profile }, ...current.filter((m) => m.kind !== "profile")]);
          return;
        }
        if (message?.type === "CHAT" && message.text) {
          setChatMessages((current) => [...current, { id: message.id || `chat-${Date.now()}`, incoming: true, text: String(message.text).slice(0, 1000), sentAt: message.sentAt || Date.now() }]);
          return;
        }
        const legacyPlaylist = message?.type === "PLAYLIST" && message.playlist?.tracks;
        if (message?.type === "CONTENT" || legacyPlaylist) {
          const contentType = legacyPlaylist ? "music" : String(message.contentType || "");
          const payload = legacyPlaylist ? message.playlist : message.payload;
          if (!payload) return;
          setReceivedContent((current) => [{ contentType, payload }, ...current]);

          if (contentType === "recipe") {
            const importedRecipe = normalizeRecipe(payload);
            const signature = contentSignature(importedRecipe);
            const alreadyExists = importedContentSignaturesRef.current.has(signature) ||
              recipesRef.current.some((item) => contentSignature(item) === signature);
            if (alreadyExists) {
              safeAlert("Receta ya existente", `«${importedRecipe.title}» ya está guardada.`);
              return;
            }
            importedContentSignaturesRef.current.add(signature);
            const next = [...recipesRef.current, importedRecipe];
            await saveRecipes(next);
            setRecipes(next);
            safeAlert("Receta recibida", `«${importedRecipe.title}» ya está disponible en Recetas.`);
            return;
          }

          if (!["music", "classical", "tutorial", "news"].includes(contentType)) {
            throw new Error("Shopp ha recibido un tipo de contenido P2P desconocido.");
          }

          const imported = normalizeReceivedMediaCollection(payload, contentType);
          const signature = playlistSignature(imported);
          const currentItems = contentType === "music" ? musicPlaylistsRef.current
            : contentType === "classical" ? classicalPlaylistsRef.current
              : contentType === "tutorial" ? tutorialsRef.current : newsItemsRef.current;
          const alreadyExists = importedContentSignaturesRef.current.has(`${contentType}:${signature}`) ||
            currentItems.some((item) => playlistSignature(item) === signature);
          if (alreadyExists) {
            safeAlert("Contenido ya existente", `«${imported.title}» ya está guardado. No se ha creado un duplicado.`);
            return;
          }

          importedContentSignaturesRef.current.add(`${contentType}:${signature}`);
          try {
            if (contentType === "music" || contentType === "classical") {
              await createPlaylist({
                clientId: playlistClientId || undefined,
                title: imported.title,
                tracks: imported.tracks,
                collectionType: contentType === "classical" ? "classical" : "playlist",
                ...(contentType === "classical" ? {
                  composer: imported.composer, performer: imported.performer, conductor: imported.conductor,
                  orchestra: imported.orchestra, period: imported.period, year: imported.year,
                } : {}),
              });
            } else {
              await createTutorial({
                clientId: playlistClientId || undefined,
                contentType: contentType === "news" ? "news" : "tutorial",
                title: imported.title,
                tracks: imported.tracks,
              });
            }
            const destination = contentType === "music" ? "Music playlist"
              : contentType === "classical" ? "Música clásica"
                : contentType === "tutorial" ? "Tutoriales" : "Noticias";
            safeAlert("Contenido recibido y guardado", `«${imported.title}» ya está disponible en ${destination}.`);
          } catch (error) {
            importedContentSignaturesRef.current.delete(`${contentType}:${signature}`);
            throw error;
          }
        }
      } catch (error) {
        setLibrarySync((current) => ({ ...(current || {}), state: "failed", error: error?.message }));
        safeAlert("Sincronización P2P", error?.message || "No se pudo procesar el mensaje recibido.");
      }
    };
  }, [alias, channels, createPlaylist, createTutorial, handleLibraryMessage, myPresence?.displayName, playlistClientId]);

  const createPeer = useCallback((pairing, initiator) => {
    if (peerRef.current) return peerRef.current;
    const peer = new RTCPeerConnection(RTC_CONFIG);
    peerRef.current = peer;
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === "connected") setConnection("connected");
      else if (state === "failed") setConnection("failed");
      else if (state === "closed") setConnection("closed");
    };
    peer.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      sendSignal({
        pairingId: pairing._id,
        deviceId,
        type: "ice",
        payload: JSON.stringify(candidate.toJSON()),
      }).catch(() => {});
    };
    peer.ondatachannel = (event) => bindDataChannel(event.channel);
    if (initiator) bindDataChannel(peer.createDataChannel("shopp-playlist-p2p"));
    return peer;
  }, [bindDataChannel, deviceId, sendSignal]);

  const startConnection = useCallback(async () => {
    if (!activePairing || !activePairing.isInitiator) return;
    if (offerStartedForRef.current === activePairing._id) return;
    try {
      offerStartedForRef.current = activePairing._id;
      setConnection("connecting");
      const peer = createPeer(activePairing, true);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal({
        pairingId: activePairing._id,
        deviceId,
        type: "offer",
        payload: JSON.stringify(peer.localDescription),
      });
    } catch (error) {
      setConnection("failed");
      safeAlert("Conexión P2P", error?.message || "No se pudo iniciar la conexión.");
    }
  }, [activePairing, createPeer, deviceId, sendSignal]);

  useEffect(() => {
    if (!activePairing || !signals) return;
    let disposed = false;
    const processSignals = async () => {
      const applyQueuedIceCandidates = async (peer) => {
        const queued = queuedIceCandidatesRef.current;
        queuedIceCandidatesRef.current = [];
        for (const payload of queued) {
          await peer.addIceCandidate(JSON.parse(payload));
        }
      };

      for (const signal of signals) {
        if (disposed || appliedSignalsRef.current.has(signal._id)) continue;
        try {
          if (signal.type === "offer" && !activePairing.isInitiator) {
            appliedSignalsRef.current.add(signal._id);
            setConnection("connecting");
            const receiver = createPeer(activePairing, false);
            await receiver.setRemoteDescription(JSON.parse(signal.payload));
            await applyQueuedIceCandidates(receiver);
            const answer = await receiver.createAnswer();
            await receiver.setLocalDescription(answer);
            await sendSignal({
              pairingId: activePairing._id,
              deviceId,
              type: "answer",
              payload: JSON.stringify(receiver.localDescription),
            });
          } else if (
            signal.type === "answer" &&
            activePairing.isInitiator &&
            peerRef.current
          ) {
            appliedSignalsRef.current.add(signal._id);
            await peerRef.current.setRemoteDescription(JSON.parse(signal.payload));
            await applyQueuedIceCandidates(peerRef.current);
          } else if (signal.type === "ice" && peerRef.current?.remoteDescription) {
            appliedSignalsRef.current.add(signal._id);
            await peerRef.current.addIceCandidate(JSON.parse(signal.payload));
          } else if (signal.type === "ice") {
            // WebRTC puede recibir ICE antes de la oferta/respuesta. Se guarda
            // y se aplica justo después de establecer la descripción remota.
            appliedSignalsRef.current.add(signal._id);
            queuedIceCandidatesRef.current.push(signal.payload);
          }
        } catch (error) {
          setConnection("failed");
          safeAlert("Conexión P2P", error?.message || "No se pudo procesar la conexión.");
        }
      }
    };
    processSignals();
    return () => { disposed = true; };
  }, [activePairing, createPeer, deviceId, sendSignal, signals]);

  useEffect(() => {
    if (!activePairing) closePeer();
    return undefined;
  }, [activePairing, closePeer]);

  useEffect(() => () => closePeer(), [closePeer]);

  const togglePresence = async () => {
    setBusy(true);
    try {
      if (myPresence) {
        await disablePresence({ deviceId });
      } else {
        await enablePresence({ displayName: alias.trim() || "Mi dispositivo", deviceId, channels: [...channels] });
      }
    } catch (error) {
      safeAlert("Intercambio P2P", error?.message || "No se pudo actualizar la visibilidad.");
    } finally {
      setBusy(false);
    }
  };

  const invite = async (peer) => {
    setBusy(true);
    try {
      await requestPairing({ recipientPresenceId: peer.presenceId, confirmCode: randomCode(), deviceId });
    } catch (error) {
      safeAlert("Intercambio P2P", error?.message || "No se pudo enviar la solicitud.");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (pairing, accept) => {
    setBusy(true);
    try {
      await respondToPairing({ pairingId: pairing._id, accept, deviceId });
    } catch (error) {
      safeAlert("Intercambio P2P", error?.message || "No se pudo responder.");
    } finally {
      setBusy(false);
    }
  };


  const sendChatMessage = () => {
    const text = chatText.trim();
    const channel = dataChannelRef.current;
    if (!text || !channel || channel.readyState !== "open") return;
    const message = { type: "CHAT", id: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: text.slice(0, 1000), sentAt: Date.now() };
    sendP2PJson(channel, message);
    setChatMessages((current) => [...current, { ...message, incoming: false }]);
    setChatText("");
  };

  const toggleContentSelection = (contentType, itemId) => {
    const key = `${contentType}:${String(itemId)}`;
    setSelectedContentKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllInGroup = (group) => {
    const keys = group.items.map((item) => `${group.type}:${String(item?._id || item?.id || "")}`).filter((key) => !key.endsWith(":"));
    const allSelected = keys.length > 0 && keys.every((key) => selectedContentKeys.has(key));
    setSelectedContentKeys((current) => {
      const next = new Set(current);
      for (const key of keys) allSelected ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const sendSelectedContent = async () => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      safeAlert("Intercambio P2P", "La conexión todavía no está lista.");
      return;
    }
    if (selectedContent.length === 0) {
      safeAlert("Intercambio P2P", "Selecciona al menos un contenido para compartir.");
      return;
    }
    setBusy(true);
    try {
      for (const selected of selectedContent) {
        let payload;
        if (selected.type === "music" || selected.type === "classical") {
          payload = toP2PPlaylist(selected.item, selected.type === "classical" ? "classical" : "playlist");
        } else if (selected.type === "tutorial" || selected.type === "news") {
          payload = toP2PTutorial(selected.item, selected.type);
        } else {
          payload = normalizeRecipe(selected.item);
        }
        sendP2PJson(channel, { type: "CONTENT", contentType: selected.type, payload });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      safeAlert(
        "Contenido enviado",
        `${selectedContent.length} ${selectedContent.length === 1 ? "elemento enviado" : "elementos enviados"} por P2P.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const syncLibrary = async () => {
    if (!activePairing?.sameUser) {
      safeAlert("Biblioteca privada", "La sincronización completa de Biblioteca solo está disponible entre dispositivos de la misma cuenta.");
      return;
    }
    setBusy(true);
    try {
      setLibrarySync({ state: "preparing" });
      await sendLibrarySnapshot("offer");
    } catch (error) {
      setLibrarySync({ state: "failed", error: error?.message });
      safeAlert("Sincronización P2P", error?.message || "No se pudo iniciar la sincronización.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    closePeer();
    if (!activePairing) return;
    try {
      await closePairing({ pairingId: activePairing._id, deviceId });
    } catch {
      // El vencimiento automático también elimina la sesión de prueba.
    }
  };

  if (Platform.OS !== "web") {
    return <View style={styles.center}><Ionicons name="desktop-outline" size={42} color="#64748b" /><Text style={styles.centerTitle}>Prueba P2P para la PWA</Text><Text style={styles.centerText}>Ábrela desde Safari en el iPhone y desde el navegador del Mac/PC.</Text></View>;
  }

  if (currentUser === undefined) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  if (!hasP2PAccess) {
    return <View style={styles.center}><Ionicons name="lock-closed-outline" size={42} color="#64748b" /><Text style={styles.centerTitle}>Intercambio P2P no disponible</Text><Text style={styles.centerText}>Inicia sesión de nuevo o pide al administrador que active la utilidad P2P para tu cuenta.</Text></View>;
  }

  const pendingIncoming = pairings?.filter((item) => item.status === "pending" && !item.isInitiator) || [];
  const pendingOutgoing = pairings?.filter((item) => item.status === "pending" && item.isInitiator) || [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}><Ionicons name="people-outline" size={29} color="#2563eb" /><View><Text style={styles.title}>Intercambio P2P · prueba</Text><Text style={styles.subtitle}>Solo se coordinan el alias y la conexión. El contenido seleccionado viaja directamente entre los dos dispositivos.</Text></View></View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Haz visible este dispositivo durante dos minutos</Text>
        <TextInput value={alias} onChangeText={setAlias} editable={!myPresence && !busy} maxLength={30} placeholder="Alias público, por ejemplo Joshnash" placeholderTextColor="#94a3b8" style={styles.input} />
        <Text style={styles.muted}>Suscríbete a los canales que te interesan. No se comparte ningún contenido automáticamente.</Text>
        <View style={styles.interestWrap}>{P2P_CHANNELS.map((channelName) => { const selected = channels.has(channelName); return <Pressable key={channelName} disabled={!!myPresence || busy} onPress={() => setChannels((current) => { const next = new Set(current); selected ? next.delete(channelName) : next.add(channelName); return next; })} style={[styles.interestChip, selected && styles.channelSelected]}><Text style={[styles.interestText, selected && styles.channelSelectedText]}>#{channelName}</Text></Pressable>; })}</View>
        <Pressable disabled={busy} onPress={togglePresence} style={[styles.primaryButton, myPresence && styles.stopButton]}><Ionicons name={myPresence ? "eye-off-outline" : "radio-outline"} size={18} color="#fff" /><Text style={styles.primaryButtonText}>{myPresence ? "Dejar de aparecer" : "Activar intercambio cerca"}</Text></Pressable>
        {myPresence ? <Status tone="success">Visible como {myPresence.displayName}. Caduca automáticamente.</Status> : <Status>Tu alias solo se muestra mientras dura esta prueba.</Status>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Dispositivos disponibles</Text>
        {peers === undefined ? <ActivityIndicator color="#2563eb" /> : peers.length === 0 ? <Text style={styles.muted}>Aún no hay otro usuario Shopp visible.</Text> : peers.map((peer) => <View key={peer.presenceId} style={styles.profileCard}><View style={styles.personRow}><View style={styles.personIcon}><Ionicons name="person-outline" size={20} color="#2563eb" /></View><View style={styles.playlistInfo}><Text style={styles.personName}>{peer.displayName}{peer.sameUser ? " · tu cuenta" : ""}</Text></View><Pressable disabled={busy || !!activePairing} onPress={() => invite(peer)} style={styles.smallButton}><Text style={styles.smallButtonText}>Handshake</Text></Pressable></View>{Array.isArray(peer.channels) && peer.channels.length ? <View style={styles.interestWrap}>{peer.channels.map((channelName) => <View key={channelName} style={styles.interestChip}><Text style={styles.interestText}>#{channelName}</Text></View>)}</View> : <Text style={styles.muted}>Sin canales públicos seleccionados.</Text>}</View>)}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contenido para compartir</Text>
        <Text style={styles.muted}>Selecciona qué elementos quieres enviar. No se comparte nada automáticamente al hacer Handshake.</Text>
        {shareGroups.map((group) => {
          const loading = group.type === "music" ? musicPlaylists === undefined
            : group.type === "classical" ? classicalPlaylists === undefined
              : group.type === "tutorial" ? tutorials === undefined
                : group.type === "news" ? newsItems === undefined : false;
          const keys = group.items.map((item) => `${group.type}:${String(item?._id || item?.id || "")}`).filter((key) => !key.endsWith(":"));
          const allSelected = keys.length > 0 && keys.every((key) => selectedContentKeys.has(key));
          return <View key={group.type} style={styles.contentGroup}>
            <View style={styles.playlistHeader}>
              <View style={styles.groupTitleRow}><Ionicons name={group.icon} size={20} color="#2563eb" /><Text style={styles.playlistName}>{group.label}</Text></View>
              {group.items.length > 0 ? <Pressable onPress={() => selectAllInGroup(group)} style={styles.selectAllButton}><Text style={styles.selectAllText}>{allSelected ? "Ninguno" : "Todos"}</Text></Pressable> : null}
            </View>
            {loading ? <ActivityIndicator color="#2563eb" /> : group.items.length === 0 ? <Text style={styles.muted}>No hay elementos.</Text> : <View style={styles.playlistList}>
              {group.items.map((item) => {
                const itemId = String(item?._id || item?.id || "");
                const key = `${group.type}:${itemId}`;
                const selected = selectedContentKeys.has(key);
                const itemCount = Array.isArray(item?.tracks) ? item.tracks.length : null;
                return <Pressable key={key} onPress={() => toggleContentSelection(group.type, itemId)} style={[styles.playlistRow, selected && styles.playlistRowSelected]}>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={1}>{item?.title || "Sin título"}</Text>
                    <Text style={styles.playlistMeta}>{itemCount === null ? (item?.category || "Receta") : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}</Text>
                  </View>
                  <Ionicons name={group.icon} size={20} color={selected ? "#2563eb" : "#94a3b8"} />
                </Pressable>;
              })}
            </View>}
          </View>;
        })}
        {selectedContent.length > 0 ? <Status tone="success">{selectedContent.length} elemento{selectedContent.length === 1 ? "" : "s"} seleccionado{selectedContent.length === 1 ? "" : "s"}</Status> : null}
      </View>

      {pendingIncoming.map((pairing) => <View key={pairing._id} style={styles.card}><Text style={styles.cardTitle}>{pairing.initiatorName} quiere intercambiar contenido</Text><Text style={styles.muted}>Confirmad ambos este código: <Text style={styles.code}>{pairing.confirmCode}</Text></Text><View style={styles.actions}><Pressable disabled={busy} onPress={() => respond(pairing, false)} style={styles.rejectButton}><Text style={styles.rejectText}>Rechazar</Text></Pressable><Pressable disabled={busy} onPress={() => respond(pairing, true)} style={styles.acceptButton}><Text style={styles.acceptText}>Aceptar</Text></Pressable></View></View>)}
      {pendingOutgoing.map((pairing) => <View key={pairing._id} style={styles.card}><Text style={styles.cardTitle}>Esperando a {pairing.recipientName}</Text><Text style={styles.muted}>El código que ambos deben comprobar es <Text style={styles.code}>{pairing.confirmCode}</Text>.</Text></View>)}

      {activePairing ? <View style={styles.card}><Text style={styles.cardTitle}>3. Conexión con {activePairing.friendName}</Text><Text style={styles.muted}>Código confirmado: <Text style={styles.code}>{activePairing.confirmCode}</Text></Text><Status tone={connection === "connected" ? "success" : connection === "failed" ? "danger" : "neutral"}>{connection === "connected" ? "Canal P2P conectado" : connection === "failed" ? "No se pudo conectar" : activePairing.isInitiator ? "Listo para iniciar la conexión" : "Esperando la conexión del otro dispositivo"}</Status>{activePairing.isInitiator && connection !== "connected" ? <Pressable onPress={startConnection} style={styles.primaryButton}><Ionicons name="link-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Conectar ahora</Text></Pressable> : null}{connection === "connected" ? <><Pressable disabled={busy || selectedContent.length === 0} onPress={sendSelectedContent} style={[styles.primaryButton, selectedContent.length === 0 && styles.disabledButton]}><Ionicons name="send-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Enviar seleccionados ({selectedContent.length})</Text></Pressable><Pressable disabled={busy || !activePairing.sameUser || ["preparing", "receiving", "merging"].includes(librarySync?.state)} onPress={syncLibrary} style={[styles.primaryButton, styles.librarySyncButton, !activePairing.sameUser && styles.disabledButton]}><Ionicons name="sync-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Sincronizar Biblioteca</Text></Pressable>{!activePairing.sameUser ? <Text style={styles.muted}>La Biblioteca completa solo se sincroniza entre dispositivos de tu misma cuenta.</Text> : null}{librarySync ? <Status tone={librarySync.state === "failed" ? "danger" : librarySync.state === "merged" || librarySync.state === "reply-sent" ? "success" : "neutral"}>{librarySync.state === "preparing" ? "Preparando Biblioteca…" : librarySync.state === "receiving" ? `Recibiendo ${librarySync.receivedChunks || 0}/${librarySync.totalChunks || 0} bloques…` : librarySync.state === "merging" ? "Combinando cambios…" : librarySync.state === "failed" ? `Error: ${librarySync.error || "sincronización fallida"}` : librarySync.state === "sent" ? "Biblioteca enviada; esperando respuesta…" : librarySync.state === "reply-sent" ? "Respuesta de sincronización enviada" : librarySync.state === "merged" ? "Cambios recibidos y combinados" : "Sincronización P2P"}</Status> : null}</> : null}<Pressable onPress={finish} style={styles.finishButton}><Text style={styles.finishText}>Finalizar y borrar sesión</Text></Pressable></View> : null}

      {activePairing && connection === "connected" ? <View style={styles.card}>
        <Text style={styles.cardTitle}>Conversación con {activePairing.friendName}</Text>
        <Text style={styles.muted}>Los mensajes viajan por el canal WebRTC y no se guardan en Convex.</Text>
        <View style={styles.chatBox}>
          {chatMessages.length === 0 ? <Text style={styles.muted}>Hablad de intereses y decidid qué queréis compartir.</Text> : chatMessages.map((message) => message.kind === "profile" ? <View key={message.id} style={styles.remoteProfile}><Text style={styles.playlistName}>{message.profile?.displayName || activePairing.friendName}</Text>{message.profile?.channels?.length ? <Text style={styles.playlistMeta}>Canales: {message.profile.channels.map((name) => `#${name}`).join(" · ")}</Text> : null}</View> : <View key={message.id} style={[styles.chatBubble, message.incoming ? styles.chatIncoming : styles.chatOutgoing]}><Text style={styles.chatText}>{message.text}</Text></View>)}
        </View>
        <View style={styles.chatComposer}><TextInput value={chatText} onChangeText={setChatText} onSubmitEditing={sendChatMessage} placeholder="Escribe un mensaje…" placeholderTextColor="#94a3b8" style={[styles.input, styles.chatInput]} /><Pressable onPress={sendChatMessage} disabled={!chatText.trim()} style={[styles.sendButton, !chatText.trim() && styles.disabledButton]}><Ionicons name="send" size={18} color="#fff" /></Pressable></View>
      </View> : null}

      {receivedContent.length > 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Contenido recibido por P2P</Text>{receivedContent.map((entry, index) => { const payload = entry.payload || {}; const count = Array.isArray(payload.tracks) ? payload.tracks.length : null; return <View key={`${entry.contentType}-${payload.title || "contenido"}-${index}`} style={styles.receivedRow}><View style={styles.playlistInfo}><Text style={styles.playlistName} numberOfLines={1}>{payload.title || "Contenido"}</Text><Text style={styles.playlistMeta}>{entry.contentType}{count !== null ? ` · ${count} items` : ""}</Text></View><Pressable onPress={() => downloadJson({ type: entry.contentType, data: payload })} style={styles.downloadButton}><Ionicons name="download-outline" size={18} color="#1d4ed8" /><Text style={styles.downloadButtonText}>JSON</Text></Pressable></View>; })}</View> : null}
      <Text style={styles.note}>El contenido seleccionado se envía directamente por WebRTC y se guarda en su utilidad correspondiente, evitando duplicados exactos. La sincronización completa de Biblioteca se reserva a dispositivos de la misma cuenta y combina los cambios locales de ambos.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: "#f4f7fb", gap: 12 },
  hero: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 4 },
  title: { fontSize: 21, fontWeight: "800", color: "#172033" },
  subtitle: { flex: 1, marginTop: 3, color: "#64748b", fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { color: "#172033", fontSize: 16, fontWeight: "800" },
  channelSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  channelSelectedText: { color: "#fff" },
  profileCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 10, gap: 8 },
  interestWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 46 },
  interestChip: { backgroundColor: "#f1f5f9", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  interestText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  chatBox: { minHeight: 120, maxHeight: 320, gap: 8, padding: 10, borderRadius: 12, backgroundColor: "#f8fafc" },
  remoteProfile: { padding: 10, borderRadius: 10, backgroundColor: "#eef2ff", gap: 3 },
  chatBubble: { maxWidth: "82%", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  chatIncoming: { alignSelf: "flex-start", backgroundColor: "#e2e8f0" },
  chatOutgoing: { alignSelf: "flex-end", backgroundColor: "#dbeafe" },
  chatText: { color: "#172033", fontSize: 14, lineHeight: 19 },
  chatComposer: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatInput: { flex: 1 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, minHeight: 46, paddingHorizontal: 12, color: "#172033", fontSize: 16 },
  primaryButton: { minHeight: 44, borderRadius: 10, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  stopButton: { backgroundColor: "#475569" }, librarySyncButton: { backgroundColor: "#0f766e" }, primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  muted: { color: "#64748b", fontSize: 14, lineHeight: 20 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  personIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" }, personName: { flex: 1, color: "#172033", fontSize: 16, fontWeight: "700" },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#dbeafe" }, smallButtonText: { color: "#1d4ed8", fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10 }, rejectButton: { flex: 1, minHeight: 42, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#fee2e2" }, rejectText: { color: "#b91c1c", fontWeight: "800" }, acceptButton: { flex: 1, minHeight: 42, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#dcfce7" }, acceptText: { color: "#15803d", fontWeight: "800" },
  status: { alignSelf: "flex-start", backgroundColor: "#f1f5f9", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, statusText: { color: "#475569", fontWeight: "700", fontSize: 13 }, status_success: { backgroundColor: "#dcfce7" }, statusText_success: { color: "#15803d" }, status_danger: { backgroundColor: "#fee2e2" }, statusText_danger: { color: "#b91c1c" },
  code: { color: "#1d4ed8", fontWeight: "900", letterSpacing: 1 },
  disabledButton: { opacity: 0.45 },
  playlistHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  contentGroup: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 8 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  playlistHeaderText: { flex: 1, minWidth: 0 },
  selectAllButton: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, backgroundColor: "#eff6ff" },
  selectAllText: { color: "#1d4ed8", fontSize: 13, fontWeight: "800" },
  playlistList: { gap: 7 },
  playlistRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, backgroundColor: "#fff" },
  playlistRowSelected: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxSelected: { borderColor: "#2563eb", backgroundColor: "#2563eb" },
  playlistInfo: { flex: 1, minWidth: 0 },
  playlistName: { color: "#172033", fontSize: 15, fontWeight: "800" },
  playlistMeta: { marginTop: 2, color: "#64748b", fontSize: 12 },
  receivedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  downloadButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: "#dbeafe" },
  downloadButtonText: { color: "#1d4ed8", fontWeight: "800", fontSize: 12 },
  finishButton: { alignItems: "center", paddingVertical: 8 }, finishText: { color: "#64748b", fontWeight: "700" }, note: { color: "#64748b", fontSize: 13, lineHeight: 19, textAlign: "center", paddingHorizontal: 8 },
  center: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }, centerTitle: { marginTop: 14, color: "#172033", fontSize: 20, fontWeight: "800" }, centerText: { marginTop: 8, color: "#64748b", fontSize: 15, textAlign: "center", lineHeight: 22 },
});
