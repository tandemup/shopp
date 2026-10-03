import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { libraryJsonApi } from "@/src/services/libraryJsonApi";

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

function toP2PPlaylist(playlist) {
  return {
    version: 1,
    type: "shopp-youtube-playlist",
    title: String(playlist?.title || "Playlist").trim() || "Playlist",
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

function normalizeReceivedPlaylist(playlist) {
  const tracks = Array.isArray(playlist?.tracks)
    ? playlist.tracks.map(extractYouTubeIds)
    : [];
  if (tracks.length === 0) throw new Error("La playlist recibida no contiene items válidos.");
  return {
    title: String(playlist?.title || "Playlist recibida").trim() || "Playlist recibida",
    tracks,
    collectionType: "playlist",
  };
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
  anchor.download = "shopp-playlist-p2p.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Status({ tone = "neutral", children }) {
  return <View style={[styles.status, styles[`status_${tone}`]]}><Text style={[styles.statusText, styles[`statusText_${tone}`]]}>{children}</Text></View>;
}

const P2P_CHANNELS = ["musica", "recetas"];
const P2P_CHANNEL_SET = new Set(P2P_CHANNELS);

export default function P2PPlaylistExchangeScreen() {
  const [alias, setAlias] = useState("");
  const [channels, setChannels] = useState(() => new Set(P2P_CHANNELS));
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [playlistClientId] = useState(() => getPlaylistClientId());
  const [busy, setBusy] = useState(false);
  const handshakeInFlightRef = useRef(false);
  const [connection, setConnection] = useState("idle");
  const [clock, setClock] = useState(() => Date.now());
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState(() => new Set());
  const [receivedPlaylists, setReceivedPlaylists] = useState([]);
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

  const shareablePlaylists = useMemo(
    () => Array.isArray(musicPlaylists)
      ? musicPlaylists.filter((playlist) => playlist.shareable === true)
      : [],
    [musicPlaylists],
  );

  const selectedPlaylists = useMemo(() => {
    return shareablePlaylists.filter((playlist) => selectedPlaylistIds.has(String(playlist._id)));
  }, [shareablePlaylists, selectedPlaylistIds]);

  // No se consulta presencia hasta que Convex haya confirmado una sesión y
  // el permiso. Así una cookie antigua no deja la PWA en blanco.
  const myPresence = useQuery(api.nearbyShare.getMyPresence, p2pQueryArgs);
  const peers = useQuery(api.nearbyShare.listVisiblePeers, p2pQueryArgs);
  const pairings = useQuery(api.nearbyShare.listPairings, p2pQueryArgs);
  const activePairing = useMemo(
    () => pairings?.find((item) => item.status === "accepted") || null,
    [pairings],
  );
  // El contador solo es local: no genera consultas adicionales a Convex.
  useEffect(() => {
    if (!pairings?.some((item) => item.status === "pending")) return undefined;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pairings]);

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

  const peerRef = useRef(null);
  const dataChannelRef = useRef(null);
  const appliedSignalsRef = useRef(new Set());
  const queuedIceCandidatesRef = useRef([]);
  const offerStartedForRef = useRef(null);
  const incomingLibrarySyncRef = useRef(new Map());
  const musicPlaylistsRef = useRef([]);
  const importedPlaylistSignaturesRef = useRef(new Set());
  const pairingsRef = useRef([]);
  const sentInvitationRef = useRef(new Set());
  const intentionalCloseRef = useRef(false);
  const disconnectTimerRef = useRef(null);
  const shutdownInFlightRef = useRef(false);
  const screenFocusedRef = useRef(false);

  useEffect(() => {
    musicPlaylistsRef.current = Array.isArray(musicPlaylists) ? musicPlaylists : [];
  }, [musicPlaylists]);

  useEffect(() => {
    pairingsRef.current = Array.isArray(pairings) ? pairings : [];
  }, [pairings]);

  const clearDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }, []);

  const closePeer = useCallback(() => {
    intentionalCloseRef.current = true;
    clearDisconnectTimer();
    dataChannelRef.current?.close?.();
    peerRef.current?.close?.();
    dataChannelRef.current = null;
    peerRef.current = null;
    appliedSignalsRef.current.clear();
    queuedIceCandidatesRef.current = [];
    offerStartedForRef.current = null;
    setConnection("idle");
    // onclose puede dispararse de forma asíncrona después de close().
    setTimeout(() => { intentionalCloseRef.current = false; }, 750);
  }, [clearDisconnectTimer]);

  const shutdownP2P = useCallback(async ({ hidePresence = true } = {}) => {
    if (shutdownInFlightRef.current) return;
    shutdownInFlightRef.current = true;

    closePeer();
    handshakeInFlightRef.current = false;
    incomingLibrarySyncRef.current.clear();
    setLibrarySync(null);

    try {
      // Cerramos todas las invitaciones de este dispositivo, tanto pendientes
      // como aceptadas. Al borrarlas en Convex, el otro extremo recibe el
      // cambio reactivamente y cierra su RTCPeerConnection.
      const currentPairings = [...pairingsRef.current];
      await Promise.allSettled(
        currentPairings.map((pairing) =>
          closePairing({ pairingId: pairing._id, deviceId }),
        ),
      );

      if (hidePresence) {
        await disablePresence({ deviceId });
      }
    } catch {
      // Si el navegador se está cerrando o la red ya se ha perdido, las
      // mutaciones pueden no llegar. La presencia y los pairings conservan
      // su TTL como red de seguridad y caducan automáticamente.
    } finally {
      shutdownInFlightRef.current = false;
    }
  }, [closePairing, closePeer, deviceId, disablePresence]);

  const handleUnexpectedDisconnect = useCallback(() => {
    if (intentionalCloseRef.current || shutdownInFlightRef.current) return;
    void shutdownP2P({ hidePresence: true });
  }, [shutdownP2P]);

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
      // Solo el emisor transfiere las playlists de la invitación aceptada.
      const invitation = pairingsRef.current.find((item) => item.status === "accepted" && item.isInitiator);
      if (invitation?.offeredPlaylists?.length && !sentInvitationRef.current.has(String(invitation._id))) {
        sentInvitationRef.current.add(String(invitation._id));
        void (async () => {
          try {
            for (const offered of invitation.offeredPlaylists) {
              const playlist = musicPlaylistsRef.current.find((item) => String(item._id) === offered.id && item.shareable === true);
              if (!playlist) throw new Error(`La playlist «${offered.title}» ya no está disponible para compartir.`);
              sendP2PJson(channel, { type: "PLAYLIST", playlist: toP2PPlaylist(playlist) });
              await new Promise((resolve) => setTimeout(resolve, 40));
            }
          } catch (error) {
            safeAlert("Handshake", error?.message || "No se pudieron transferir las playlists.");
          }
        })();
      }
    };
    channel.onclose = () => {
      setConnection("closed");
      handleUnexpectedDisconnect();
    };
    channel.onerror = () => {
      setConnection("failed");
      handleUnexpectedDisconnect();
    };
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
        if (message?.type === "PLAYLIST" && message.playlist?.tracks) {
          const imported = normalizeReceivedPlaylist(message.playlist);
          const signature = playlistSignature(imported);
          const alreadyExists =
            importedPlaylistSignaturesRef.current.has(signature) ||
            musicPlaylistsRef.current.some((playlist) => playlistSignature(playlist) === signature);

          setReceivedPlaylists((current) => [message.playlist, ...current]);

          if (alreadyExists) {
            safeAlert(
              "Playlist ya existente",
              `«${imported.title}» ya está guardada en Music playlist. No se ha creado un duplicado.`,
            );
            return;
          }

          importedPlaylistSignaturesRef.current.add(signature);
          try {
            await createPlaylist({
              clientId: playlistClientId || undefined,
              title: imported.title,
              tracks: imported.tracks,
              collectionType: "playlist",
            });
            safeAlert(
              "Playlist recibida y guardada",
              `«${imported.title}» · ${imported.tracks.length} items. Ya está disponible en Music playlist.`,
            );
          } catch (error) {
            importedPlaylistSignaturesRef.current.delete(signature);
            throw error;
          }
        }
      } catch (error) {
        setLibrarySync((current) => ({ ...(current || {}), state: "failed", error: error?.message }));
        safeAlert("Sincronización P2P", error?.message || "No se pudo procesar el mensaje recibido.");
      }
    };
  }, [alias, channels, createPlaylist, handleLibraryMessage, handleUnexpectedDisconnect, myPresence?.displayName, playlistClientId]);

  const createPeer = useCallback((pairing, initiator) => {
    if (peerRef.current) return peerRef.current;
    const peer = new RTCPeerConnection(RTC_CONFIG);
    peerRef.current = peer;
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === "connected") {
        clearDisconnectTimer();
        setConnection("connected");
      } else if (state === "disconnected") {
        setConnection("disconnected");
        clearDisconnectTimer();
        // Un cambio de Wi-Fi o una breve suspensión puede producir un estado
        // disconnected transitorio. Damos 5 s antes de cancelar la sesión.
        disconnectTimerRef.current = setTimeout(() => {
          if (peerRef.current?.connectionState === "disconnected") {
            handleUnexpectedDisconnect();
          }
        }, 5000);
      } else if (state === "failed") {
        setConnection("failed");
        handleUnexpectedDisconnect();
      } else if (state === "closed") {
        setConnection("closed");
        handleUnexpectedDisconnect();
      }
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
  }, [bindDataChannel, clearDisconnectTimer, deviceId, handleUnexpectedDisconnect, sendSignal]);

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

  // Salir de Intercambio P2P (flecha Atrás, cambio de pantalla o pestaña de
  // navegación) cancela presencia, handshakes y conexiones de este dispositivo.
  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      return () => {
        screenFocusedRef.current = false;
        void shutdownP2P({ hidePresence: true });
      };
    }, [shutdownP2P]),
  );

  // Cierre/recarga de la PWA: intento de limpieza. No todos los navegadores
  // permiten terminar peticiones asíncronas durante pagehide, por eso el TTL
  // de Convex sigue siendo el respaldo definitivo.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
    const handlePageHide = () => {
      if (screenFocusedRef.current) void shutdownP2P({ hidePresence: true });
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [shutdownP2P]);

  useEffect(() => () => {
    clearDisconnectTimer();
    closePeer();
  }, [clearDisconnectTimer, closePeer]);

  const togglePresence = async () => {
    setBusy(true);
    try {
      if (myPresence) {
        await shutdownP2P({ hidePresence: true });
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
    // Handshake idempotente: una segunda pulsación mientras la primera
    // solicitud está en curso se ignora, incluso antes del siguiente render.
    if (handshakeInFlightRef.current || busy || activePairing || pairings?.some((item) => item.status === "pending" && item.expiresAt > Date.now())) return;
    if (selectedPlaylists.length === 0) {
      safeAlert("Handshake", "Selecciona primero las playlists que quieres compartir con este dispositivo.");
      return;
    }
    if (selectedPlaylists.length > 25 || selectedPlaylists.some((playlist) => (playlist.tracks || []).length > 100)) {
      safeAlert("Handshake", "Máximo 25 playlists y 100 canciones por playlist.");
      return;
    }
    handshakeInFlightRef.current = true;
    setBusy(true);
    try {
      const offeredPlaylists = selectedPlaylists.map((playlist) => ({
        id: String(playlist._id),
        title: String(playlist.title || "Playlist"),
        tracks: (playlist.tracks || []).map((track) => ({ title: String(track.title || "Canción"), artist: String(track.artist || track.author || "") })),
      }));
      await requestPairing({ recipientPresenceId: peer.presenceId, confirmCode: randomCode(), deviceId, offeredPlaylists });
    } catch (error) {
      safeAlert("Intercambio P2P", error?.message || "No se pudo enviar la solicitud.");
    } finally {
      handshakeInFlightRef.current = false;
      setBusy(false);
    }
  };

  const cancelInvitation = async (pairing) => {
    setBusy(true);
    try {
      await closePairing({ pairingId: pairing._id, deviceId });
    } catch (error) {
      safeAlert("Handshake", error?.message || "No se pudo cancelar la solicitud.");
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

  const togglePlaylistSelection = (playlistId) => {
    const key = String(playlistId);
    setSelectedPlaylistIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllPlaylists = () => {
    if (!Array.isArray(musicPlaylists)) return;
    if (selectedPlaylistIds.size === shareablePlaylists.length) {
      setSelectedPlaylistIds(new Set());
      return;
    }
    setSelectedPlaylistIds(new Set(shareablePlaylists.map((playlist) => String(playlist._id))));
  };

  const sendSelectedPlaylists = async () => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      safeAlert("Intercambio P2P", "La conexión todavía no está lista.");
      return;
    }
    if (selectedPlaylists.length === 0) {
      safeAlert("Intercambio P2P", "Selecciona al menos una playlist para compartir.");
      return;
    }
    setBusy(true);
    try {
      for (const playlist of selectedPlaylists) {
        sendP2PJson(channel, { type: "PLAYLIST", playlist: toP2PPlaylist(playlist) });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      safeAlert(
        "Playlists enviadas",
        `${selectedPlaylists.length} ${selectedPlaylists.length === 1 ? "playlist enviada" : "playlists enviadas"} por P2P.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const syncLibrary = async () => {
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
    await shutdownP2P({ hidePresence: true });
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

  const pendingIncoming = pairings?.filter((item) => item.status === "pending" && !item.isInitiator && item.expiresAt > clock) || [];
  const pendingOutgoing = pairings?.filter((item) => item.status === "pending" && item.isInitiator && item.expiresAt > clock) || [];
  const expiredOutgoing = pairings?.find((item) => item.isInitiator && item.status === "pending" && item.expiresAt <= clock) || null;
  const incomingInvitation = pendingIncoming[0] || null;
  const lastOutgoingResponse = pairings?.find((item) => item.isInitiator && item.status === "rejected") || null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}><Ionicons name="people-outline" size={29} color="#2563eb" /><View><Text style={styles.title}>Intercambio P2P · prueba</Text><Text style={styles.subtitle}>Solo se coordinan el alias y la conexión. Los enlaces viajan directamente entre los dos dispositivos.</Text></View></View>

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
        {peers === undefined ? <ActivityIndicator color="#2563eb" /> : peers.length === 0 ? <Text style={styles.muted}>Aún no hay otro usuario Shopp visible.</Text> : peers.map((peer) => <View key={peer.presenceId} style={styles.profileCard}><View style={styles.personRow}><View style={styles.personIcon}><Ionicons name="person-outline" size={20} color="#2563eb" /></View><View style={styles.playlistInfo}><Text style={styles.personName}>{peer.displayName}{peer.sameUser ? " · tu cuenta" : ""}</Text></View><Pressable disabled={busy || !!activePairing || pendingIncoming.length > 0 || pendingOutgoing.length > 0} onPress={() => invite(peer)} style={styles.smallButton}><Text style={styles.smallButtonText}>{activePairing ? "Conectado ✓" : busy ? "Conectando…" : "Handshake"}</Text></Pressable></View>{Array.isArray(peer.channels) && peer.channels.some((channelName) => P2P_CHANNEL_SET.has(channelName)) ? <View style={styles.interestWrap}>{peer.channels.filter((channelName) => P2P_CHANNEL_SET.has(channelName)).map((channelName) => <View key={channelName} style={styles.interestChip}><Text style={styles.interestText}>#{channelName}</Text></View>)}</View> : <Text style={styles.muted}>Sin canales públicos seleccionados.</Text>}</View>)}
      </View>

      <View style={styles.card}>
        <View style={styles.playlistHeader}>
          <View style={styles.playlistHeaderText}>
            <Text style={styles.cardTitle}>Listas de música para compartir</Text>
            <Text style={styles.muted}>Selecciona las playlists que incluirás en la invitación Handshake. El receptor verá sus canciones antes de aceptarlas.</Text>
          </View>
          {shareablePlaylists.length > 0 ? (
            <Pressable onPress={selectAllPlaylists} style={styles.selectAllButton}>
              <Text style={styles.selectAllText}>{selectedPlaylistIds.size === shareablePlaylists.length ? "Ninguna" : "Todas"}</Text>
            </Pressable>
          ) : null}
        </View>
        {musicPlaylists === undefined ? (
          <ActivityIndicator color="#2563eb" />
        ) : shareablePlaylists.length === 0 ? (
          <Text style={styles.muted}>No hay playlists autorizadas para compartir. Activa “Permitir compartir” en el menú de cada playlist.</Text>
        ) : (
          <View style={styles.playlistList}>
            {shareablePlaylists.map((playlist) => {
              const key = String(playlist._id);
              const selected = selectedPlaylistIds.has(key);
              const itemCount = Array.isArray(playlist.tracks) ? playlist.tracks.length : 0;
              return (
                <Pressable key={key} onPress={() => togglePlaylistSelection(key)} style={[styles.playlistRow, selected && styles.playlistRowSelected]}>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={1}>{playlist.title || "Playlist"}</Text>
                    <Text style={styles.playlistMeta}>{itemCount} {itemCount === 1 ? "item" : "items"}</Text>
                  </View>
                  <Ionicons name="musical-notes-outline" size={20} color={selected ? "#2563eb" : "#94a3b8"} />
                </Pressable>
              );
            })}
          </View>
        )}
        {selectedPlaylistIds.size > 0 ? <Status tone="success">{selectedPlaylistIds.size} seleccionada{selectedPlaylistIds.size === 1 ? "" : "s"}</Status> : null}
      </View>


      {pendingOutgoing.map((pairing) => <View key={pairing._id} style={[styles.card, styles.waitingCard]}>
        <View style={styles.invitationHeading}><ActivityIndicator color="#2563eb" /><View style={styles.playlistInfo}><Text style={styles.cardTitle}>Tendiendo la mano a {pairing.recipientName}…</Text><Text style={styles.muted}>Esperando a que acepte o rechace la invitación.</Text></View></View>
        <Text style={styles.muted}>Playlists propuestas: {(pairing.offeredPlaylists || []).map((item) => item.title).join(", ")}</Text>
        <Text style={styles.muted}>Comprueba en ambos dispositivos el código <Text style={styles.code}>{pairing.confirmCode}</Text>.</Text>
        <Pressable disabled={busy} onPress={() => cancelInvitation(pairing)} style={styles.rejectButton}><Text style={styles.rejectText}>Cancelar solicitud</Text></Pressable>
      </View>)}
      {expiredOutgoing && !activePairing && pendingOutgoing.length === 0 ? <View style={styles.card}><Status tone="danger">La solicitud a {expiredOutgoing.recipientName} ha caducado. Puedes enviar otra invitación.</Status></View> : null}
      {lastOutgoingResponse && !activePairing && pendingOutgoing.length === 0 ? <View style={styles.card}><Status tone="danger">{lastOutgoingResponse.recipientName} ha rechazado el Handshake.</Status><Pressable disabled={busy} onPress={() => cancelInvitation(lastOutgoingResponse)} style={styles.finishButton}><Text style={styles.finishText}>Cerrar aviso</Text></Pressable></View> : null}

      {activePairing ? <View style={styles.card}><Text style={styles.cardTitle}>3. Conexión con {activePairing.friendName}</Text><Text style={styles.muted}>Código de verificación: <Text style={styles.code}>{activePairing.confirmCode}</Text></Text><Status tone={connection === "connected" ? "success" : connection === "failed" ? "danger" : "neutral"}>{connection === "connected" ? "Canal P2P conectado" : connection === "failed" ? "No se pudo conectar" : activePairing.isInitiator ? "Listo para iniciar la conexión" : "Esperando la conexión del otro dispositivo"}</Status>{activePairing.isInitiator && connection !== "connected" ? <Pressable onPress={startConnection} style={styles.primaryButton}><Ionicons name="link-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Conectar y enviar invitación aceptada</Text></Pressable> : null}{connection === "connected" ? <><Status tone="success">{activePairing.isInitiator ? "La transferencia de la invitación se inicia al conectar." : "Recibiendo las canciones aceptadas del otro dispositivo."}</Status><Pressable disabled={busy || ["preparing", "receiving", "merging"].includes(librarySync?.state)} onPress={syncLibrary} style={[styles.primaryButton, styles.librarySyncButton]}><Ionicons name="sync-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Sincronizar Biblioteca</Text></Pressable>{librarySync ? <Status tone={librarySync.state === "failed" ? "danger" : librarySync.state === "merged" || librarySync.state === "reply-sent" ? "success" : "neutral"}>{librarySync.state === "preparing" ? "Preparando Biblioteca…" : librarySync.state === "receiving" ? `Recibiendo ${librarySync.receivedChunks || 0}/${librarySync.totalChunks || 0} bloques…` : librarySync.state === "merging" ? "Combinando cambios…" : librarySync.state === "failed" ? `Error: ${librarySync.error || "sincronización fallida"}` : librarySync.state === "sent" ? "Biblioteca enviada; esperando respuesta…" : librarySync.state === "reply-sent" ? "Respuesta de sincronización enviada" : librarySync.state === "merged" ? "Cambios recibidos y combinados" : "Sincronización P2P"}</Status> : null}</> : null}<Pressable onPress={finish} style={styles.finishButton}><Text style={styles.finishText}>Finalizar y borrar sesión</Text></Pressable></View> : null}

      {activePairing && connection === "connected" ? <View style={styles.card}>
        <Text style={styles.cardTitle}>Conversación con {activePairing.friendName}</Text>
        <Text style={styles.muted}>Los mensajes viajan por el canal WebRTC y no se guardan en Convex.</Text>
        <View style={styles.chatBox}>
          {chatMessages.length === 0 ? <Text style={styles.muted}>Hablad de intereses y decidid qué queréis compartir.</Text> : chatMessages.map((message) => message.kind === "profile" ? <View key={message.id} style={styles.remoteProfile}><Text style={styles.playlistName}>{message.profile?.displayName || activePairing.friendName}</Text>{message.profile?.channels?.length ? <Text style={styles.playlistMeta}>Canales: {message.profile.channels.map((name) => `#${name}`).join(" · ")}</Text> : null}</View> : <View key={message.id} style={[styles.chatBubble, message.incoming ? styles.chatIncoming : styles.chatOutgoing]}><Text style={styles.chatText}>{message.text}</Text></View>)}
        </View>
        <View style={styles.chatComposer}><TextInput value={chatText} onChangeText={setChatText} onSubmitEditing={sendChatMessage} placeholder="Escribe un mensaje…" placeholderTextColor="#94a3b8" style={[styles.input, styles.chatInput]} /><Pressable onPress={sendChatMessage} disabled={!chatText.trim()} style={[styles.sendButton, !chatText.trim() && styles.disabledButton]}><Ionicons name="send" size={18} color="#fff" /></Pressable></View>
      </View> : null}

      {receivedPlaylists.length > 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Playlists recibidas por P2P</Text>{receivedPlaylists.map((playlist, index) => <View key={`${playlist.title || "playlist"}-${index}`} style={styles.receivedRow}><View style={styles.playlistInfo}><Text style={styles.playlistName} numberOfLines={1}>{playlist.title || "Playlist"}</Text><Text style={styles.playlistMeta}>{playlist.tracks?.length || 0} items</Text></View><Pressable onPress={() => downloadJson(playlist)} style={styles.downloadButton}><Ionicons name="download-outline" size={18} color="#1d4ed8" /><Text style={styles.downloadButtonText}>JSON</Text></Pressable></View>)}</View> : null}
      <Text style={styles.note}>Las playlists incluidas en una invitación aceptada se envían por WebRTC al establecerse la conexión. Al recibirlas, Shopp las guarda automáticamente en “Music playlist” del usuario receptor y evita duplicados exactos. La opción “Sincronizar Biblioteca” combina la Biblioteca local de ambos dispositivos.</Text>
      <Modal visible={!!incomingInvitation} transparent animationType="fade" onRequestClose={() => { if (incomingInvitation && !busy) void respond(incomingInvitation, false); }}>
        <View style={styles.modalBackdrop}>
          {incomingInvitation ? <View style={styles.invitationModal}>
            <View style={styles.invitationHeading}><View style={styles.handIcon}><Ionicons name="hand-left-outline" size={30} color="#2563eb" /></View><View style={styles.playlistInfo}><Text style={styles.modalTitle}>Solicitud de Handshake</Text><Text style={styles.muted}>Intercambio P2P · Shopp</Text></View></View>
            <Text style={styles.invitationTitle}>{incomingInvitation.initiatorName} está tendiendo la mano</Text>
            <Text style={styles.invitationDescription}>Quiere enviarte estas canciones. Si aceptas, se transferirán las playlists indicadas cuando se establezca la conexión WebRTC.</Text>
            <ScrollView style={styles.invitedList} nestedScrollEnabled>
              {(incomingInvitation.offeredPlaylists || []).map((playlist, index) => <View key={`${playlist.id}-${index}`} style={styles.invitedGroup}>
                <Text style={styles.playlistName}>{playlist.title} · {playlist.tracks.length} canciones</Text>
                {playlist.tracks.map((track, trackIndex) => <Text key={trackIndex} style={styles.invitedTrack}>♪ {track.title}{track.artist ? ` — ${track.artist}` : ""}</Text>)}
              </View>)}
            </ScrollView>
            <View style={styles.verificationBox}><Text style={styles.muted}>Código de verificación</Text><Text style={styles.verificationCode}>{incomingInvitation.confirmCode}</Text><Text style={styles.muted}>Comprueba que coincide en ambos dispositivos antes de aceptar.</Text></View>
            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={() => respond(incomingInvitation, false)} style={styles.rejectButton}><Text style={styles.rejectText}>Rechazar</Text></Pressable>
              <Pressable disabled={busy} onPress={() => respond(incomingInvitation, true)} style={styles.acceptButton}><Text style={styles.acceptText}>Aceptar canciones</Text></Pressable>
            </View>
          </View> : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: "#f4f7fb", gap: 12 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(15,23,42,0.64)", padding: 18 },
  invitationModal: { width: "100%", maxWidth: 430, borderRadius: 20, backgroundColor: "#fff", padding: 22, gap: 18 },
  invitationHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  handIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#172033" },
  invitationTitle: { fontSize: 20, lineHeight: 27, textAlign: "center", fontWeight: "800", color: "#172033" },
  invitedList: { maxHeight: 250 },
  invitedGroup: { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#e2e8f0", gap: 4 },
  invitedTrack: { color: "#475569", fontSize: 13, lineHeight: 19 },
  invitationDescription: { color: "#475569", lineHeight: 21, fontSize: 14, textAlign: "center" },
  verificationBox: { backgroundColor: "#f1f5f9", borderRadius: 12, padding: 16, alignItems: "center", gap: 8 },
  verificationCode: { fontSize: 28, fontWeight: "900", letterSpacing: 4, color: "#1d4ed8" },
  waitingCard: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
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
  playlistHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
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
