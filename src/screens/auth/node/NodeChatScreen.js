import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { nodeChatApi } from "@/src/api/providers/node/chat";

function explain(error) {
  return error?.message || "No se pudo completar la operación con el servidor.";
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

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((item) => [String(item.id), item]));
  for (const item of incoming) byId.set(String(item.id), item);
  return [...byId.values()].sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
}

export default function NodeChatScreen({ user, accessToken, onBack }) {
  const [room, setRoom] = useState("compras");
  const [rooms, setRooms] = useState([]);
  const [roomsVisible, setRoomsVisible] = useState(false);
  const [createRoomVisible, setCreateRoomVisible] = useState(false);
  const [roomDraft, setRoomDraft] = useState("");
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomSaving, setRoomSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [alias, setAlias] = useState(user?.name || user?.email?.split("@")[0] || "Invitado");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("connecting");
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const historyRequestRef = useRef(0);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const result = await nodeChatApi.listRooms(accessToken);
      const next = Array.isArray(result?.rooms) ? result.rooms : [];
      setRooms(next);
      setRoom((current) => next.some((item) => item.id === current) ? current : "compras");
    } catch (err) {
      setError(explain(err));
    } finally {
      setRoomsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const loadMessages = useCallback(async () => {
    const requestId = ++historyRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await nodeChatApi.listMessages(accessToken, { room, limit: 200 });
      if (requestId === historyRequestRef.current) setMessages((current) => mergeMessages(current, Array.isArray(result?.messages) ? result.messages : []));
    } catch (err) {
      if (requestId === historyRequestRef.current) setError(explain(err));
    } finally {
      if (requestId === historyRequestRef.current) setLoading(false);
    }
  }, [accessToken, room]);

  useEffect(() => { setMessages([]); loadMessages(); }, [loadMessages]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let socket = null;

    const connect = async () => {
      if (cancelled) return;
      setConnection("connecting");
      try {
        socket = await nodeChatApi.connect(accessToken);
        if (cancelled) { socket.close(); return; }
        socketRef.current = socket;
        socket.onopen = () => {
          if (cancelled) return;
          setConnection("connected");
          nodeChatApi.subscribe(socket, [room, "global"]);
        };
        socket.onmessage = (event) => {
          let payload;
          try { payload = JSON.parse(event.data); } catch { return; }
          if (payload?.type === "chat.message.created" && payload.message?.room === room) {
            setMessages((current) => current.some((item) => String(item.id) === String(payload.message.id)) ? current : [...current, payload.message]);
          } else if (payload?.type === "chat.message.deleted" && payload.room === room) {
            setMessages((current) => current.filter((item) => String(item.id) !== String(payload.messageId)));
          } else if (payload?.type === "chat.room.created" && payload.roomData) {
            setRooms((current) => current.some((item) => item.id === payload.roomData.id) ? current : [...current, payload.roomData].sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.label.localeCompare(b.label, "es")));
          } else if (payload?.type === "chat.room.deleted" && payload.deletedRoomId) {
            setRooms((current) => current.filter((item) => item.id !== payload.deletedRoomId));
            setRoom((current) => current === payload.deletedRoomId ? "compras" : current);
          } else if (payload?.type === "chat.room.cleared" && payload.deletedRoomId === room) {
            setMessages([]);
          }
        };
        socket.onerror = () => setConnection("disconnected");
        socket.onclose = () => {
          if (socketRef.current === socket) socketRef.current = null;
          if (!cancelled) {
            setConnection("disconnected");
            retryTimer = setTimeout(connect, 3000);
          }
        };
      } catch {
        if (!cancelled) {
          setConnection("disconnected");
          retryTimer = setTimeout(connect, 3000);
        }
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socketRef.current === socket) socketRef.current = null;
      socket?.close();
    };
  }, [accessToken, room]);

  const createRoom = async () => {
    const label = roomDraft.replace(/^#+\s*/, "").trim();
    if (!label || roomSaving) return;
    setRoomSaving(true);
    setError("");
    try {
      const result = await nodeChatApi.createRoom(accessToken, label);
      if (result?.room) {
        setRooms((current) => current.some((item) => item.id === result.room.id) ? current : [...current, result.room].sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.label.localeCompare(b.label, "es")));
        setRoom(result.room.id);
      }
      setRoomDraft("");
      setCreateRoomVisible(false);
      setRoomsVisible(false);
    } catch (err) {
      setError(explain(err));
    } finally {
      setRoomSaving(false);
    }
  };

  const deleteRoom = (selectedRoom) => {
    const isBuiltin = selectedRoom.builtin === true;
    const action = async () => {
      try {
        await nodeChatApi.deleteRoom(accessToken, selectedRoom.id);
        if (isBuiltin) {
          if (room === selectedRoom.id) setMessages([]);
          await loadMessages();
        } else {
          setRooms((current) => current.filter((item) => item.id !== selectedRoom.id));
          if (room === selectedRoom.id) setRoom("compras");
        }
      } catch (err) {
        setError(explain(err));
      }
    };
    confirmAction(isBuiltin ? "Borrar mensajes" : "Borrar sala", isBuiltin ? `Se borrarán todos los mensajes de ${selectedRoom.label}. La sala seguirá disponible.` : `Se borrarán la sala ${selectedRoom.label} y todos sus mensajes para todos los usuarios.`, action);
  };

  useEffect(() => {
    if (messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const result = await nodeChatApi.sendMessage(accessToken, { room, text, username: alias.trim() || "Usuario" });
      if (result?.message) setMessages((current) => current.some((item) => String(item.id) === String(result.message.id)) ? current : [...current, result.message]);
      setInput("");
    } catch (err) {
      setError(explain(err));
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (message) => {
    try {
      await nodeChatApi.deleteMessage(accessToken, message.id);
      setMessages((current) => current.filter((item) => String(item.id) !== String(message.id)));
    } catch (err) {
      setError(explain(err));
    }
  };

  const canDelete = (message) => user?.role === "admin" || String(message.userId) === String(user?.id);
  const renderMessage = ({ item }) => (
    <View style={[styles.message, String(item.userId) === String(user?.id) && styles.ownMessage]}>
      <View style={styles.messageHeader}><Text style={styles.username}>{item.username}</Text><Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</Text></View>
      <Text style={styles.messageText}>{item.text}</Text>
      {canDelete(item) ? <Pressable accessibilityRole="button" accessibilityLabel="Eliminar mensaje" onPress={() => removeMessage(item)} style={styles.delete}><Ionicons name="trash-outline" size={15} color="#94a3b8" /></Pressable> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver a listas" onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={21} color="#1d4ed8" /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.title}>#{rooms.find((item) => item.id === room)?.label || "Chat Shopp"}</Text><Text style={styles.connection}>{connection === "connected" ? "Conectado en tiempo real" : "Reconectando…"}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Salas de chat" onPress={() => { setRoomsVisible(true); loadRooms(); }} style={styles.refresh}><Ionicons name="list-outline" size={20} color="#2563eb" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Actualizar mensajes" onPress={loadMessages} style={styles.refresh}><Ionicons name="refresh" size={20} color="#2563eb" /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomTabs}>{rooms.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => setRoom(item.id)} style={[styles.roomTab, room === item.id && styles.roomTabSelected]}><Text style={[styles.roomText, room === item.id && styles.roomTextSelected]}>{item.label}</Text></Pressable>)}</ScrollView>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => { loadRooms(); loadMessages(); }}><Text style={styles.retry}>Reintentar</Text></Pressable></View> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#2563eb" /></View> : <FlatList ref={listRef} data={messages} keyExtractor={(item) => String(item.id)} renderItem={renderMessage} contentContainerStyle={messages.length ? styles.messageList : styles.emptyList} ListEmptyComponent={<Text style={styles.emptyText}>Todavía no hay mensajes en esta sala.</Text>} />}
        <View style={styles.composer}>
          <TextInput accessibilityLabel="Alias del chat" value={alias} onChangeText={setAlias} placeholder="Tu alias" style={styles.aliasInput} maxLength={40} />
          <View style={styles.inputRow}><TextInput value={input} onChangeText={setInput} placeholder="Escribe un mensaje…" placeholderTextColor="#94a3b8" multiline maxLength={room === "youtube" ? 2048 : 280} onSubmitEditing={send} style={styles.textInput} /><Pressable accessibilityRole="button" accessibilityLabel="Enviar mensaje" disabled={!input.trim() || sending} onPress={send} style={[styles.send, (!input.trim() || sending) && styles.disabled]}>{sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}</Pressable></View>
        </View>
        <Modal visible={roomsVisible} transparent animationType="fade" onRequestClose={() => setRoomsVisible(false)}>
          <Pressable style={styles.backdrop} onPress={() => setRoomsVisible(false)}><Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Salas de chat</Text><Text style={styles.modalSubtitle}>Elige una sala o crea una nueva.</Text></View><Pressable accessibilityRole="button" onPress={() => setRoomsVisible(false)} style={styles.close}><Ionicons name="close" size={20} color="#64748b" /></Pressable></View>
            {roomsLoading ? <ActivityIndicator style={styles.loading} color="#2563eb" /> : <ScrollView style={styles.roomList}>{rooms.map((item) => <View key={item.id} style={styles.roomRow}><Pressable accessibilityRole="button" onPress={() => { setRoom(item.id); setRoomsVisible(false); }} style={styles.roomSelect}><Ionicons name={item.builtin ? "chatbubble-outline" : "chatbubble-ellipses-outline"} size={18} color="#2563eb" /><Text style={styles.roomLabel}>#{item.label}</Text><Text style={styles.roomCount}>{item.count ?? 0}</Text>{room === item.id ? <Ionicons name="checkmark-circle" size={18} color="#2563eb" /> : null}</Pressable>{user?.role === "admin" ? <Pressable accessibilityRole="button" accessibilityLabel={item.builtin ? `Borrar mensajes de ${item.label}` : `Eliminar sala ${item.label}`} onPress={() => deleteRoom(item)} style={styles.deleteRoom}><Ionicons name="trash-outline" size={17} color="#dc2626" /></Pressable> : null}</View>)}</ScrollView>}
            <Pressable accessibilityRole="button" onPress={() => { setRoomDraft(""); setError(""); setCreateRoomVisible(true); }} style={styles.createRoom}><Ionicons name="add-circle-outline" size={19} color="#2563eb" /><Text style={styles.createRoomText}>Crear sala</Text></Pressable>
          </Pressable></Pressable>
        </Modal>
        <Modal visible={createRoomVisible} transparent animationType="fade" onRequestClose={() => setCreateRoomVisible(false)}>
          <View style={styles.backdrop}><View style={styles.createCard}><Text style={styles.modalTitle}>Nueva sala</Text><Text style={styles.modalSubtitle}>El nombre se compartirá con las cuentas Node.</Text><TextInput autoFocus value={roomDraft} onChangeText={setRoomDraft} placeholder="#noticias" placeholderTextColor="#94a3b8" maxLength={60} onSubmitEditing={createRoom} style={styles.roomInput} />{error ? <Text style={styles.errorText}>{error}</Text> : null}<View style={styles.modalActions}><Pressable onPress={() => setCreateRoomVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable disabled={!roomDraft.trim() || roomSaving} onPress={createRoom} style={[styles.createButton, (!roomDraft.trim() || roomSaving) && styles.disabled]}>{roomSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Crear</Text>}</Pressable></View></View></View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f7fc" }, page: { flex: 1, width: "100%", maxWidth: 900, alignSelf: "center", backgroundColor: "#f4f7fc" },
  header: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, back: { padding: 8 }, headerCopy: { flex: 1 }, title: { color: "#172033", fontSize: 20, fontWeight: "800" }, connection: { color: "#64748b", fontSize: 11, marginTop: 2 }, refresh: { padding: 9 },
  roomTabs: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, backgroundColor: "#fff" }, roomTab: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#f1f5f9" }, roomTabSelected: { backgroundColor: "#dbeafe" }, roomText: { color: "#64748b", fontSize: 12, fontWeight: "700" }, roomTextSelected: { color: "#1d4ed8" },
  messageList: { padding: 14, paddingBottom: 20 }, emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" }, emptyText: { color: "#64748b", fontSize: 14 }, message: { alignSelf: "flex-start", maxWidth: "88%", padding: 12, marginBottom: 9, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" }, ownMessage: { alignSelf: "flex-end", backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }, messageHeader: { flexDirection: "row", alignItems: "center", gap: 9 }, username: { color: "#334155", fontSize: 12, fontWeight: "800" }, timestamp: { color: "#94a3b8", fontSize: 10 }, messageText: { marginTop: 5, color: "#1e293b", fontSize: 14, lineHeight: 20 }, delete: { alignSelf: "flex-end", padding: 5, marginRight: -5, marginBottom: -5 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" }, composer: { padding: 12, gap: 7, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0" }, aliasInput: { alignSelf: "flex-start", minWidth: 100, maxWidth: 180, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: "#f1f5f9", color: "#475569", fontSize: 12 }, inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 }, textInput: { flex: 1, minHeight: 42, maxHeight: 120, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: "#f8fafc", color: "#0f172a", fontSize: 14 }, send: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#2563eb" }, disabled: { opacity: 0.45 },
  errorBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 10, marginHorizontal: 12, marginTop: 8, borderRadius: 10, backgroundColor: "#fef2f2" }, errorText: { flex: 1, color: "#991b1b", fontSize: 12 }, retry: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  backdrop: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a88" }, modalCard: { width: "100%", maxWidth: 440, maxHeight: "82%", padding: 18, borderRadius: 18, backgroundColor: "#fff" }, modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }, modalTitle: { color: "#0f172a", fontSize: 19, fontWeight: "800" }, modalSubtitle: { marginTop: 5, color: "#64748b", fontSize: 12 }, close: { padding: 5 }, roomList: { maxHeight: 450 }, roomRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }, roomSelect: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 }, roomLabel: { flex: 1, color: "#334155", fontSize: 14, fontWeight: "700" }, roomCount: { minWidth: 28, textAlign: "center", color: "#64748b", fontSize: 12 }, deleteRoom: { padding: 12 }, createRoom: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12, borderRadius: 11, backgroundColor: "#eff6ff" }, createRoomText: { color: "#2563eb", fontSize: 13, fontWeight: "800" }, createCard: { width: "100%", maxWidth: 400, padding: 20, borderRadius: 18, backgroundColor: "#fff" }, roomInput: { minHeight: 46, marginTop: 15, paddingHorizontal: 12, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 11, color: "#0f172a" }, modalActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 16 }, cancel: { padding: 12 }, cancelText: { color: "#475569", fontWeight: "700" }, createButton: { minWidth: 82, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#2563eb" }, createButtonText: { color: "#fff", fontWeight: "800" },
});
