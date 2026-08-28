import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { I18nText as Text } from "@/src/i18n";
import {
  safeAlert,
  safeConfirm,
} from "@/src/components/ui/alert/safeAlert";
import { CameraBroadcaster, CameraViewer } from "./LiveCameraWeb";

const EMPTY_FORM = {
  title: "",
  category: "",
  description: "",
  playbackUrl: "",
  thumbnailUrl: "",
};

function Playback({ channel }) {
  if (!channel?.playbackUrl) {
    return (
      <View style={[styles.player, styles.playerEmpty]}>
        <Ionicons name="videocam-off-outline" size={45} color="#64748B" />
        <Text style={styles.emptyTitle}>Emisión no configurada</Text>
        <Text style={styles.emptyText}>
          El creador todavía no ha añadido la URL de reproducción.
        </Text>
      </View>
    );
  }

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.player, styles.playerEmpty]}>
        <Ionicons name="desktop-outline" size={42} color="#64748B" />
        <Text style={styles.emptyTitle}>Reproductor web</Text>
        <Text style={styles.emptyText}>
          Esta primera versión de Shopp Live está preparada para la PWA.
        </Text>
      </View>
    );
  }

  const url = channel.playbackUrl;
  const isDirectVideo = /\.(m3u8|mp4)(?:[?#]|$)/i.test(url);
  if (isDirectVideo) {
    return React.createElement("video", {
      src: url,
      controls: true,
      autoPlay: channel.status === "live",
      playsInline: true,
      style: styles.webMedia,
    });
  }

  return React.createElement("iframe", {
    src: url,
    title: channel.title,
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
    allowFullScreen: true,
    style: styles.webMedia,
  });
}

function ChannelCard({ channel, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.channelCard, selected && styles.channelSelected]}
    >
      <View style={styles.thumbnailWrap}>
        {channel.thumbnailUrl ? (
          <Image
            source={{ uri: channel.thumbnailUrl }}
            style={styles.thumbnail}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailFallback]}>
            <Ionicons name="radio-outline" size={30} color="#94A3B8" />
          </View>
        )}
        {channel.status === "live" ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>EN DIRECTO</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.channelCopy}>
        <Text style={styles.channelTitle} numberOfLines={2}>
          {channel.title}
        </Text>
        <Text style={styles.channelCategory} numberOfLines={1}>
          {channel.category || "Sin categoría"}
        </Text>
      </View>
    </Pressable>
  );
}

function LiveChat({ channelId }) {
  const messages = useQuery(
    api.live.listMessages,
    channelId ? { channelId } : "skip",
  );
  const sendMessage = useMutation(api.live.sendMessage);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await sendMessage({ channelId, text: value });
      setText("");
    } catch (error) {
      safeAlert("Chat", error?.message || "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.chatPanel}>
      <Text style={styles.panelTitle}>Chat en directo</Text>
      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages === undefined ? (
          <ActivityIndicator />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay mensajes.</Text>
        ) : (
          messages.map((message) => (
            <View key={message._id} style={styles.messageRow}>
              <Text style={styles.messageUser}>{message.username}</Text>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ))
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje"
          placeholderTextColor="#999"
          maxLength={280}
          onSubmitEditing={send}
          style={styles.composerInput}
        />
        <Pressable
          onPress={send}
          disabled={sending || !text.trim()}
          style={styles.sendButton}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}


function RtcDataPanel({ connected, messages, onSend }) {
  const [text, setText] = useState("");

  const sendPayload = (payload) => {
    try {
      onSend?.(payload);
    } catch (error) {
      safeAlert("RTCDataChannel", error?.message || "No se pudo enviar el mensaje P2P.");
    }
  };

  const sendText = () => {
    const value = text.trim();
    if (!value) return;
    sendPayload({ type: "MESSAGE", text: value });
    setText("");
  };

  return (
    <View style={styles.rtcPanel}>
      <View style={styles.rtcHeader}>
        <View>
          <Text style={styles.panelTitle}>RTCDataChannel</Text>
          <Text style={styles.rtcHelp}>Mensajes P2P sin pasar por Convex.</Text>
        </View>
        <View style={[styles.rtcState, connected && styles.rtcStateConnected]}>
          <Text style={[styles.rtcStateText, connected && styles.rtcStateTextConnected]}>
            {connected ? "CONECTADO" : "DESCONECTADO"}
          </Text>
        </View>
      </View>

      <View style={styles.rtcActions}>
        <Pressable
          disabled={!connected}
          onPress={() => sendPayload({ type: "PING" })}
          style={[styles.rtcActionButton, !connected && styles.rtcActionDisabled]}
        >
          <Text style={styles.rtcActionText}>PING</Text>
        </Pressable>
        <Pressable
          disabled={!connected}
          onPress={() => sendPayload({ type: "HELP", text: "Solicitud de ayuda" })}
          style={[styles.rtcActionButton, !connected && styles.rtcActionDisabled]}
        >
          <Text style={styles.rtcActionText}>HELP</Text>
        </Pressable>
        <Pressable
          disabled={!connected}
          onPress={() => sendPayload({ type: "FIRE_ALERT", text: "Alerta de incendio" })}
          style={[styles.rtcDangerButton, !connected && styles.rtcActionDisabled]}
        >
          <Text style={styles.rtcDangerText}>FIRE_ALERT</Text>
        </Pressable>
      </View>

      <View style={styles.rtcComposer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Mensaje P2P"
          placeholderTextColor="#94A3B8"
          onSubmitEditing={sendText}
          style={styles.rtcInput}
        />
        <Pressable
          disabled={!connected || !text.trim()}
          onPress={sendText}
          style={[styles.rtcSendButton, (!connected || !text.trim()) && styles.rtcActionDisabled]}
        >
          <Ionicons name="send" size={17} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.rtcMessages} contentContainerStyle={styles.rtcMessagesContent}>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>Aún no se han recibido mensajes P2P.</Text>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={styles.rtcMessageRow}>
              <Text style={styles.rtcMessageType}>{message.type || "MESSAGE"}</Text>
              <Text style={styles.rtcMessageBody}>
                {message.text || JSON.stringify(message.payload || {})}
              </Text>
              <Text style={styles.rtcMessageTime}>
                {new Date(message.receivedAt || message.timestamp || Date.now()).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ChannelEditor({ channel, onClose }) {
  const createChannel = useMutation(api.live.createChannel);
  const updateChannel = useMutation(api.live.updateChannel);
  const deleteChannel = useMutation(api.live.deleteChannel);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm(
      channel
        ? {
            title: channel.title || "",
            category: channel.category || "",
            description: channel.description || "",
            playbackUrl: channel.playbackUrl || "",
            thumbnailUrl: channel.thumbnailUrl || "",
          }
        : EMPTY_FORM,
    );
  }, [channel]);

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const values = {
        title: form.title,
        category: form.category || undefined,
        description: form.description || undefined,
        playbackUrl: form.playbackUrl || undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
      };
      if (channel) await updateChannel({ channelId: channel._id, ...values });
      else await createChannel(values);
      onClose();
    } catch (error) {
      safeAlert("Shopp Live", error?.message || "No se pudo guardar el canal.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!channel || deleting) return;
    safeConfirm(
      "Eliminar canal",
      `¿Quieres eliminar «${channel.title}»? También se borrarán los mensajes del chat de este canal.`,
      async () => {
        setDeleting(true);
        try {
          await deleteChannel({ channelId: channel._id });
          onClose();
        } catch (error) {
          safeAlert(
            "Shopp Live",
            error?.message || "No se pudo eliminar el canal.",
          );
        } finally {
          setDeleting(false);
        }
      },
      { confirmText: "Eliminar", destructive: true },
    );
  };

  return (
    <View style={styles.editor}>
      <View style={styles.editorHeader}>
        <Text style={styles.panelTitle}>
          {channel ? "Editar canal" : "Nuevo canal"}
        </Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={24} color="#475569" />
        </Pressable>
      </View>
      <TextInput
        value={form.title}
        onChangeText={(v) => setField("title", v)}
        placeholder="Título"
        placeholderTextColor="#999"

        style={styles.field}
      />
      <TextInput
        value={form.category}
        onChangeText={(v) => setField("category", v)}
        placeholder="Categoría"
        placeholderTextColor="#999"
        style={styles.field}
      />
      <TextInput
        value={form.description}
        onChangeText={(v) => setField("description", v)}
        placeholder="Descripción"
        placeholderTextColor="#999"
        multiline
        style={[styles.field, styles.multiline]}
      />
      <TextInput
        value={form.playbackUrl}
        onChangeText={(v) => setField("playbackUrl", v)}
        placeholder="URL HTTPS de reproducción o iframe"
        placeholderTextColor="#999"
        autoCapitalize="none"
        style={styles.field}
      />
      <TextInput
        value={form.thumbnailUrl}
        onChangeText={(v) => setField("thumbnailUrl", v)}
        placeholder="URL HTTPS de portada (opcional)"
        placeholderTextColor="#999"
        autoCapitalize="none"
        style={styles.field}
      />
      <Text style={styles.help}>
        La URL de reproducción es pública. No pegues aquí la clave privada de
        OBS.
      </Text>
      <Pressable onPress={save} disabled={saving} style={styles.primaryButton}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Guardar canal</Text>
        )}
      </Pressable>
      {channel ? (
        <Pressable
          onPress={confirmDelete}
          disabled={saving || deleting}
          style={styles.deleteButton}
        >
          {deleting ? (
            <ActivityIndicator color="#B91C1C" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color="#B91C1C" />
              <Text style={styles.deleteButtonText}>Eliminar canal</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ShoppLiveScreen() {
  const { width } = useWindowDimensions();
  const currentUser = useQuery(api.users.current);
  const channels = useQuery(api.live.listChannels);
  const setLiveStatus = useMutation(api.live.setLiveStatus);
  const startCameraBroadcast = useMutation(api.live.startCameraBroadcast);
  const stopCameraBroadcast = useMutation(api.live.stopCameraBroadcast);
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorChannel, setEditorChannel] = useState(null);
  const [rtcMessages, setRtcMessages] = useState([]);
  const [rtcSend, setRtcSend] = useState(null);
  const [rtcConnected, setRtcConnected] = useState(false);
  const deviceBroadcasterId = useMemo(() => {
    if (Platform.OS !== "web") return "native-device";
    const key = "shopp-live-broadcaster-id";
    let value = window.sessionStorage.getItem(key);
    if (!value) {
      value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      window.sessionStorage.setItem(key, value);
    }
    return value;
  }, []);

  useEffect(() => {
    if (
      channels?.length &&
      (!selectedId || !channels.some((channel) => channel._id === selectedId))
    ) {
      setSelectedId(channels[0]._id);
    }
    if (channels?.length === 0 && selectedId) setSelectedId(null);
  }, [channels, selectedId]);

  const selected = useMemo(
    () => channels?.find((item) => item._id === selectedId) || channels?.[0],
    [channels, selectedId],
  );
  const wide = width >= 900;
  const compact = width < 640;

  useEffect(() => {
    setRtcMessages([]);
    setRtcSend(null);
    setRtcConnected(false);
  }, [selected?._id]);

  const toggleStatus = async () => {
    try {
      await setLiveStatus({
        channelId: selected._id,
        status: selected.status === "live" ? "offline" : "live",
      });
    } catch (error) {
      safeAlert(
        "Shopp Live",
        error?.message || "No se pudo cambiar el estado.",
      );
    }
  };

  const startCamera = async () => {
    if (Platform.OS !== "web" || !navigator.mediaDevices?.getUserMedia) {
      safeAlert(
        "Shopp Live",
        "La cámara en directo requiere abrir Shopp como PWA en un navegador compatible.",
      );
      return;
    }
    try {
      await startCameraBroadcast({
        channelId: selected._id,
        broadcasterId: deviceBroadcasterId,
      });
    } catch (error) {
      safeAlert("Shopp Live", error?.message || "No se pudo iniciar la cámara.");
    }
  };

  const stopCamera = async () => {
    try {
      await stopCameraBroadcast({ channelId: selected._id });
    } catch (error) {
      safeAlert("Shopp Live", error?.message || "No se pudo detener la cámara.");
    }
  };

  const handleCameraError = useCallback((error) => {
    safeAlert(
      "Cámara y micrófono",
      error?.message || "No se pudo acceder a la cámara o al micrófono.",
    );
  }, []);

  const handleBroadcasterError = useCallback(
    async (error) => {
      handleCameraError(error);
      if (selected?._id) {
        await stopCameraBroadcast({ channelId: selected._id }).catch(() => {});
      }
    },
    [handleCameraError, selected?._id, stopCameraBroadcast],
  );

  const handleRtcMessage = useCallback((message) => {
    setRtcMessages((current) => [
      {
        ...message,
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      },
      ...current,
    ].slice(0, 30));
  }, []);

  const handleRtcSenderReady = useCallback((send, connected) => {
    setRtcSend(() => send || null);
    setRtcConnected(Boolean(connected && send));
  }, []);

  const sendRtcMessage = useCallback((message) => {
    if (!rtcSend) {
      throw new Error("El RTCDataChannel no está conectado.");
    }
    rtcSend(message);
  }, [rtcSend]);

  if (channels === undefined || currentUser === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Shopp Live</Text>
          <Text style={styles.heroSubtitle}>
            Retransmisiones y conversación en tiempo real
          </Text>
        </View>
        {currentUser?.isAdmin ? (
          <Pressable
            onPress={() => {
              setEditorChannel(null);
              setEditorOpen(true);
            }}
            style={[
              styles.primaryButton,
              compact && styles.newChannelButtonCompact,
            ]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Nuevo canal</Text>
          </Pressable>
        ) : null}
      </View>

      {editorOpen ? (
        <ChannelEditor
          channel={editorChannel}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}

      {channels.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="radio-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No hay canales todavía</Text>
          <Text style={styles.emptyText}>
            {currentUser?.isAdmin
              ? "Crea el primer canal para comenzar."
              : "Un administrador debe crear el primer canal."}
          </Text>
          {currentUser?.isAdmin ? (
            <Pressable
              onPress={() => setEditorOpen(true)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Crear canal</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.channelList}
          >
            {channels.map((channel) => (
              <ChannelCard
                key={channel._id}
                channel={channel}
                selected={channel._id === selected?._id}
                onPress={() => setSelectedId(channel._id)}
              />
            ))}
          </ScrollView>

          <View style={[styles.liveLayout, wide && styles.liveLayoutWide]}>
            <View style={styles.videoColumn}>
              {selected.status === "live" && selected.broadcastMode === "camera" ? (
                selected.cameraBroadcasterId === deviceBroadcasterId ? (
                  <CameraBroadcaster
                    channelId={selected._id}
                    onError={handleBroadcasterError}
                    onDataMessage={handleRtcMessage}
                    onDataSenderReady={handleRtcSenderReady}
                  />
                ) : (
                  <CameraViewer
                    channelId={selected._id}
                    onError={handleCameraError}
                    onDataMessage={handleRtcMessage}
                    onDataSenderReady={handleRtcSenderReady}
                  />
                )
              ) : (
                <Playback channel={selected} />
              )}
              <View style={styles.streamInfo}>
                <View style={styles.streamTitleRow}>
                  <View style={styles.streamTitleCopy}>
                    <Text style={styles.streamTitle}>{selected.title}</Text>
                    <Text style={styles.streamMeta}>
                      {selected.category || "Sin categoría"}
                    </Text>
                  </View>
                  {selected.status === "live" ? (
                    <View style={styles.liveBadgeStatic}>
                      <Text style={styles.liveBadgeText}>EN DIRECTO</Text>
                    </View>
                  ) : (
                    <Text style={styles.offlineBadge}>DESCONECTADO</Text>
                  )}
                </View>
                {selected.description ? (
                  <Text style={styles.description}>{selected.description}</Text>
                ) : null}
                {currentUser?.isAdmin ? (
                  <View style={styles.adminActions}>
                    <Pressable
                      onPress={() => {
                        setEditorChannel(selected);
                        setEditorOpen(true);
                      }}
                      style={styles.editButton}
                    >
                      <Ionicons
                        name="create-outline"
                        size={19}
                        color="#475569"
                      />
                      <Text style={styles.editButtonText}>Editar canal</Text>
                    </Pressable>
                    <Pressable
                      onPress={
                        selected.status === "live" &&
                        selected.broadcastMode === "camera"
                          ? stopCamera
                          : toggleStatus
                      }
                      style={[
                        styles.statusButton,
                        selected.status === "live" && styles.stopButton,
                      ]}
                    >
                      <Ionicons
                        name={
                          selected.status === "live"
                            ? "stop-circle-outline"
                            : "radio-outline"
                        }
                        size={19}
                        color="#FFFFFF"
                      />
                      <Text style={styles.primaryButtonText}>
                        {selected.status === "live"
                          ? "Finalizar emisión"
                          : "Marcar en directo"}
                      </Text>
                    </Pressable>
                    {selected.status === "offline" ? (
                      <Pressable onPress={startCamera} style={styles.cameraButton}>
                        <Ionicons name="videocam-outline" size={19} color="#FFFFFF" />
                        <Text style={styles.primaryButtonText}>Emitir con cámara</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {selected.status === "live" && selected.broadcastMode === "camera" ? (
                <RtcDataPanel
                  connected={rtcConnected}
                  messages={rtcMessages}
                  onSend={sendRtcMessage}
                />
              ) : null}
            </View>
            <LiveChat channelId={selected._id} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F3FF" },
  page: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 44,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  heroCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  heroSubtitle: { color: "#64748B", marginTop: 3 },
  primaryButton: {
    minHeight: 42,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: "#7C3AED",
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  newChannelButtonCompact: { width: "100%" },
  deleteButton: {
    minHeight: 42,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FEF2F2",
  },
  deleteButtonText: { color: "#B91C1C", fontWeight: "700" },
  channelList: { gap: 10, paddingBottom: 16 },
  channelCard: {
    width: 190,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  channelSelected: { borderColor: "#7C3AED", borderWidth: 2 },
  thumbnailWrap: { height: 104, backgroundColor: "#0F172A" },
  thumbnail: { width: "100%", height: "100%", resizeMode: "cover" },
  thumbnailFallback: { alignItems: "center", justifyContent: "center" },
  liveBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    backgroundColor: "#E11D48",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  liveBadgeStatic: {
    backgroundColor: "#E11D48",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  liveBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  channelCopy: { padding: 10 },
  channelTitle: { color: "#1E293B", fontWeight: "700" },
  channelCategory: { marginTop: 3, color: "#7C3AED", fontSize: 12 },
  liveLayout: { gap: 14 },
  liveLayoutWide: { flexDirection: "row", alignItems: "stretch" },
  videoColumn: { flex: 1, minWidth: 0 },
  player: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  webMedia: {
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    border: 0,
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  playerEmpty: { alignItems: "center", justifyContent: "center", padding: 24 },
  streamInfo: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  streamTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  streamTitleCopy: { flex: 1 },
  streamTitle: { color: "#1E293B", fontSize: 21, fontWeight: "800" },
  streamMeta: { color: "#7C3AED", marginTop: 3 },
  offlineBadge: {
    color: "#64748B",
    fontWeight: "800",
    fontSize: 11,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  description: { color: "#475569", marginTop: 12, lineHeight: 20 },
  adminActions: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  editButton: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    borderRadius: 9,
    paddingHorizontal: 14,
    minHeight: 40,
    backgroundColor: "#F1F5F9",
  },
  editButtonText: { color: "#475569", fontWeight: "700" },
  statusButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    borderRadius: 9,
    paddingHorizontal: 14,
    minHeight: 40,
    backgroundColor: "#E11D48",
  },
  stopButton: { backgroundColor: "#334155" },
  cameraButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    borderRadius: 9,
    paddingHorizontal: 14,
    minHeight: 40,
    backgroundColor: "#7C3AED",
  },
  chatPanel: {
    width: "100%",
    maxWidth: 380,
    minHeight: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
  },
  panelTitle: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  messages: { flex: 1, minHeight: 310, maxHeight: 510, marginVertical: 12 },
  messagesContent: { gap: 9 },
  messageRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  messageUser: { color: "#7C3AED", fontWeight: "800" },
  messageText: { color: "#334155", flexShrink: 1 },
  composer: { flexDirection: "row", gap: 8, alignItems: "center" },
  composerInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    paddingHorizontal: 12,
    outlineStyle: "none",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  editor: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  field: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    outlineStyle: "none",
  },
  multiline: { minHeight: 78, textAlignVertical: "top" },
  help: { fontSize: 12, color: "#64748B" },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 40,
    minHeight: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
  },
  emptyTitle: {
    color: "#334155",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 8,
  },
  emptyText: { color: "#64748B", textAlign: "center" },

  rtcPanel: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  rtcHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rtcHelp: { color: "#64748B", fontSize: 12, marginTop: 2 },
  rtcState: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  rtcStateConnected: { backgroundColor: "#DCFCE7" },
  rtcStateText: { color: "#64748B", fontSize: 10, fontWeight: "800" },
  rtcStateTextConnected: { color: "#166534" },
  rtcActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rtcActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
  },
  rtcActionText: { color: "#5B21B6", fontSize: 12, fontWeight: "800" },
  rtcDangerButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  rtcDangerText: { color: "#B91C1C", fontSize: 12, fontWeight: "800" },
  rtcActionDisabled: { opacity: 0.42 },
  rtcComposer: { flexDirection: "row", gap: 8 },
  rtcInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    paddingHorizontal: 10,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  rtcSendButton: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#7C3AED",
  },
  rtcMessages: { maxHeight: 180 },
  rtcMessagesContent: { gap: 6 },
  rtcMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  rtcMessageType: {
    minWidth: 72,
    color: "#5B21B6",
    fontSize: 11,
    fontWeight: "800",
  },
  rtcMessageBody: { flex: 1, color: "#334155", fontSize: 12 },
  rtcMessageTime: { color: "#94A3B8", fontSize: 10 },
});
