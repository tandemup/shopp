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

export default function P2PPlaylistExchangeScreen() {
  const [alias, setAlias] = useState("");
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [playlistClientId] = useState(() => getPlaylistClientId());
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState("idle");
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

  const selectedPlaylists = useMemo(() => {
    if (!Array.isArray(musicPlaylists)) return [];
    return musicPlaylists.filter((playlist) => selectedPlaylistIds.has(String(playlist._id)));
  }, [musicPlaylists, selectedPlaylistIds]);

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

  const peerRef = useRef(null);
  const dataChannelRef = useRef(null);
  const appliedSignalsRef = useRef(new Set());
  const queuedIceCandidatesRef = useRef([]);
  const offerStartedForRef = useRef(null);
  const incomingLibrarySyncRef = useRef(new Map());
  const musicPlaylistsRef = useRef([]);
  const importedPlaylistSignaturesRef = useRef(new Set());

  useEffect(() => {
    musicPlaylistsRef.current = Array.isArray(musicPlaylists) ? musicPlaylists : [];
  }, [musicPlaylists]);

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
    channel.onopen = () => setConnection("connected");
    channel.onclose = () => setConnection("closed");
    channel.onerror = () => setConnection("failed");
    channel.binaryType = "arraybuffer";
    channel.onmessage = async (event) => {
      try {
        const messageText = await decodeP2PMessage(event.data);
        const message = JSON.parse(messageText);
        if (await handleLibraryMessage(message)) return;
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
  }, [createPlaylist, handleLibraryMessage, playlistClientId]);

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
        await enablePresence({ displayName: alias.trim() || "Mi dispositivo", deviceId });
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
    if (selectedPlaylistIds.size === musicPlaylists.length) {
      setSelectedPlaylistIds(new Set());
      return;
    }
    setSelectedPlaylistIds(new Set(musicPlaylists.map((playlist) => String(playlist._id))));
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
      <View style={styles.hero}><Ionicons name="people-outline" size={29} color="#2563eb" /><View><Text style={styles.title}>Intercambio P2P · prueba</Text><Text style={styles.subtitle}>Solo se coordinan el alias y la conexión. Los enlaces viajan directamente entre los dos dispositivos.</Text></View></View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Haz visible este dispositivo durante dos minutos</Text>
        <TextInput value={alias} onChangeText={setAlias} editable={!myPresence && !busy} maxLength={30} placeholder="Nombre del dispositivo, por ejemplo iPad" placeholderTextColor="#94a3b8" style={styles.input} />
        <Pressable disabled={busy} onPress={togglePresence} style={[styles.primaryButton, myPresence && styles.stopButton]}><Ionicons name={myPresence ? "eye-off-outline" : "radio-outline"} size={18} color="#fff" /><Text style={styles.primaryButtonText}>{myPresence ? "Dejar de aparecer" : "Activar intercambio cerca"}</Text></Pressable>
        {myPresence ? <Status tone="success">Visible como {myPresence.displayName}. Caduca automáticamente.</Status> : <Status>Tu alias solo se muestra mientras dura esta prueba.</Status>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Dispositivos disponibles</Text>
        {peers === undefined ? <ActivityIndicator color="#2563eb" /> : peers.length === 0 ? <Text style={styles.muted}>Aún no hay otro dispositivo Shopp visible. Activa esta pantalla también en el otro dispositivo con la misma cuenta.</Text> : peers.map((peer) => <View key={peer.presenceId} style={styles.personRow}><View style={styles.personIcon}><Ionicons name="person-outline" size={20} color="#2563eb" /></View><Text style={styles.personName}>{peer.displayName}{peer.sameUser ? " · tu cuenta" : ""}</Text><Pressable disabled={busy || !!activePairing} onPress={() => invite(peer)} style={styles.smallButton}><Text style={styles.smallButtonText}>Invitar</Text></Pressable></View>)}
      </View>

      <View style={styles.card}>
        <View style={styles.playlistHeader}>
          <View style={styles.playlistHeaderText}>
            <Text style={styles.cardTitle}>Listas de música para compartir</Text>
            <Text style={styles.muted}>Selecciona las playlists de “Mis playlists” que quieres enviar al otro dispositivo.</Text>
          </View>
          {Array.isArray(musicPlaylists) && musicPlaylists.length > 0 ? (
            <Pressable onPress={selectAllPlaylists} style={styles.selectAllButton}>
              <Text style={styles.selectAllText}>{selectedPlaylistIds.size === musicPlaylists.length ? "Ninguna" : "Todas"}</Text>
            </Pressable>
          ) : null}
        </View>
        {musicPlaylists === undefined ? (
          <ActivityIndicator color="#2563eb" />
        ) : musicPlaylists.length === 0 ? (
          <Text style={styles.muted}>No hay playlists de música en “Mis playlists”.</Text>
        ) : (
          <View style={styles.playlistList}>
            {musicPlaylists.map((playlist) => {
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

      {pendingIncoming.map((pairing) => <View key={pairing._id} style={styles.card}><Text style={styles.cardTitle}>{pairing.initiatorName} quiere intercambiar una playlist</Text><Text style={styles.muted}>Confirmad ambos este código: <Text style={styles.code}>{pairing.confirmCode}</Text></Text><View style={styles.actions}><Pressable disabled={busy} onPress={() => respond(pairing, false)} style={styles.rejectButton}><Text style={styles.rejectText}>Rechazar</Text></Pressable><Pressable disabled={busy} onPress={() => respond(pairing, true)} style={styles.acceptButton}><Text style={styles.acceptText}>Aceptar</Text></Pressable></View></View>)}
      {pendingOutgoing.map((pairing) => <View key={pairing._id} style={styles.card}><Text style={styles.cardTitle}>Esperando a {pairing.recipientName}</Text><Text style={styles.muted}>El código que ambos deben comprobar es <Text style={styles.code}>{pairing.confirmCode}</Text>.</Text></View>)}

      {activePairing ? <View style={styles.card}><Text style={styles.cardTitle}>3. Conexión con {activePairing.friendName}</Text><Text style={styles.muted}>Código confirmado: <Text style={styles.code}>{activePairing.confirmCode}</Text></Text><Status tone={connection === "connected" ? "success" : connection === "failed" ? "danger" : "neutral"}>{connection === "connected" ? "Canal P2P conectado" : connection === "failed" ? "No se pudo conectar" : activePairing.isInitiator ? "Listo para iniciar la conexión" : "Esperando la conexión del otro dispositivo"}</Status>{activePairing.isInitiator && connection !== "connected" ? <Pressable onPress={startConnection} style={styles.primaryButton}><Ionicons name="link-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Conectar ahora</Text></Pressable> : null}{connection === "connected" ? <><Pressable disabled={busy || selectedPlaylists.length === 0} onPress={sendSelectedPlaylists} style={[styles.primaryButton, selectedPlaylists.length === 0 && styles.disabledButton]}><Ionicons name="send-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Enviar seleccionadas ({selectedPlaylists.length})</Text></Pressable><Pressable disabled={busy || ["preparing", "receiving", "merging"].includes(librarySync?.state)} onPress={syncLibrary} style={[styles.primaryButton, styles.librarySyncButton]}><Ionicons name="sync-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Sincronizar Biblioteca</Text></Pressable>{librarySync ? <Status tone={librarySync.state === "failed" ? "danger" : librarySync.state === "merged" || librarySync.state === "reply-sent" ? "success" : "neutral"}>{librarySync.state === "preparing" ? "Preparando Biblioteca…" : librarySync.state === "receiving" ? `Recibiendo ${librarySync.receivedChunks || 0}/${librarySync.totalChunks || 0} bloques…` : librarySync.state === "merging" ? "Combinando cambios…" : librarySync.state === "failed" ? `Error: ${librarySync.error || "sincronización fallida"}` : librarySync.state === "sent" ? "Biblioteca enviada; esperando respuesta…" : librarySync.state === "reply-sent" ? "Respuesta de sincronización enviada" : librarySync.state === "merged" ? "Cambios recibidos y combinados" : "Sincronización P2P"}</Status> : null}</> : null}<Pressable onPress={finish} style={styles.finishButton}><Text style={styles.finishText}>Finalizar y borrar sesión</Text></Pressable></View> : null}

      {receivedPlaylists.length > 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Playlists recibidas por P2P</Text>{receivedPlaylists.map((playlist, index) => <View key={`${playlist.title || "playlist"}-${index}`} style={styles.receivedRow}><View style={styles.playlistInfo}><Text style={styles.playlistName} numberOfLines={1}>{playlist.title || "Playlist"}</Text><Text style={styles.playlistMeta}>{playlist.tracks?.length || 0} items</Text></View><Pressable onPress={() => downloadJson(playlist)} style={styles.downloadButton}><Ionicons name="download-outline" size={18} color="#1d4ed8" /><Text style={styles.downloadButtonText}>JSON</Text></Pressable></View>)}</View> : null}
      <Text style={styles.note}>Las playlists seleccionadas se envían directamente por WebRTC. Al recibirlas, Shopp las guarda automáticamente en “Music playlist” del usuario receptor y evita duplicados exactos. La opción “Sincronizar Biblioteca” combina la Biblioteca local de ambos dispositivos.</Text>
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
